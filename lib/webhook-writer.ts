// Server-only. Lets the Airwallex webhook write to Firestore by signing in as the
// dedicated webhook account (paypal-webhook@ohlifeup.com — legacy name, kept as-is;
// on the admin allowlist in firestore.rules) and using the Firestore REST API with
// that ID token — so the writes are still governed by security rules (no Admin SDK /
// service-account key needed). Imported ONLY by the webhook route.

import type { PaymentStatus } from "./payments";

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const EMAIL = process.env.WEBHOOK_FIREBASE_EMAIL || "";
const PASSWORD = process.env.WEBHOOK_FIREBASE_PASSWORD || "";

export const isWebhookWriterConfigured = Boolean(
  API_KEY && PROJECT && EMAIL && PASSWORD
);

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Sign in as the webhook service account → short-lived ID token (or null). */
async function signIn(): Promise<string | null> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        returnSecureToken: true,
      }),
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { idToken?: string };
  return data.idToken ?? null;
}

interface FoundPayment {
  docId: string;
  status: string;
}

/** Find one payment doc where `field == value` (via Firestore runQuery). */
async function findPaymentByField(
  idToken: string,
  field: string,
  value: string
): Promise<FoundPayment | null> {
  if (!value) return null;
  const res = await fetch(`${FS_BASE}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "payments" }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: "EQUAL",
            value: { stringValue: value },
          },
        },
        limit: 1,
      },
    }),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, { stringValue?: string }> };
  }>;
  const doc = Array.isArray(rows)
    ? rows.find((r) => r.document)?.document
    : null;
  if (!doc?.name) return null;
  return {
    docId: doc.name.split("/").pop() as string,
    status: doc.fields?.status?.stringValue ?? "",
  };
}

/** PATCH only the `status` field of a payment (rules allow status-only updates). */
async function patchStatus(
  idToken: string,
  docId: string,
  status: PaymentStatus
): Promise<boolean> {
  const res = await fetch(
    `${FS_BASE}/payments/${docId}?updateMask.fieldPaths=status`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ fields: { status: { stringValue: status } } }),
    }
  );
  return res.ok;
}

/** Create an admin notification (webhook account is admin, so any type is fine). */
async function createNotification(
  idToken: string,
  type: string,
  title: string,
  message: string,
  refId: string
): Promise<void> {
  const now = new Date().toISOString();
  await fetch(`${FS_BASE}/notifications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      fields: {
        type: { stringValue: type },
        title: { stringValue: title.slice(0, 200) },
        message: { stringValue: message.slice(0, 500) },
        refId: { stringValue: refId.slice(0, 100) },
        read: { booleanValue: false },
        createdAt: { timestampValue: now },
      },
    }),
  }).catch(() => {});
}

export type SyncResult =
  | "updated"
  | "already"
  | "not_found"
  | "error"
  | "skipped";

/**
 * Find the payment (by captureId, then orderId as fallback) and set its status,
 * recording an admin notification. Used by the webhook for refund/cancel sync.
 */
export async function syncPaymentStatus(
  match: { captureId?: string; orderId?: string },
  status: PaymentStatus,
  notif: { type: string; title: string; message: string } | null
): Promise<SyncResult> {
  if (!isWebhookWriterConfigured) return "skipped";
  const idToken = await signIn();
  if (!idToken) return "error";

  let found: FoundPayment | null = null;
  if (match.captureId)
    found = await findPaymentByField(idToken, "captureId", match.captureId);
  if (!found && match.orderId)
    found = await findPaymentByField(idToken, "orderId", match.orderId);
  if (!found) return "not_found";
  if (found.status === status) return "already";

  const ok = await patchStatus(idToken, found.docId, status);
  if (!ok) return "error";
  if (notif) {
    await createNotification(
      idToken,
      notif.type,
      notif.title,
      notif.message,
      found.docId
    );
  }
  return "updated";
}
