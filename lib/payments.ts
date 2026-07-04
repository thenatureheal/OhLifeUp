import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "payments";
const DETAILS_COLLECTION = "paymentDetails";

/** Lifecycle status of a payment. Refund/cancel are recorded by an admin. */
export type PaymentStatus = "paid" | "refunded" | "cancelled";

export interface PaymentRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  orderId: string;
  amount: string;
  currency: string;
  packageName: string;
  status: PaymentStatus;
  createdAt: string | null;
}

export interface NewPayment {
  name: string;
  phone: string;
  email: string;
  orderId: string;
  amount: string;
  currency: string;
  packageName: string;
}

/**
 * Extra customer PII entered by an admin AFTER checkout. Stored in a SEPARATE
 * `paymentDetails/{paymentId}` collection that is admin-only (see
 * firestore.rules) so it is never exposed via the public payment lookup.
 */
export interface PaymentDetails {
  address: string;
  birthdate: string; // YYYY-MM-DD (free text)
  gender: string; // "male" | "female" | "other" | ""
  memo: string;
}

export const EMPTY_DETAILS: PaymentDetails = {
  address: "",
  birthdate: "",
  gender: "",
  memo: "",
};

/** Keep only digits — normalize phone numbers for reliable matching. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function toISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

/**
 * Record a completed payment so the buyer can later look it up by name + phone.
 * Called from onApprove after the PayPal order is captured. The phone is
 * normalized to digits before storing.
 */
export async function recordPayment(input: NewPayment): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    email: input.email.trim(),
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency,
    packageName: input.packageName,
    status: "paid",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

function mapPayment(id: string, data: Record<string, unknown>): PaymentRecord {
  return {
    id,
    name: data.name as string,
    phone: data.phone as string,
    email: (data.email as string) ?? "",
    orderId: (data.orderId as string) ?? "",
    amount: (data.amount as string) ?? "",
    currency: (data.currency as string) ?? "",
    packageName: (data.packageName as string) ?? "",
    status: (data.status as PaymentStatus) ?? "paid",
    createdAt: toISO(data.createdAt),
  };
}

// ─────────────────────────────────────────────────────────────
// Admin-only operations (gated by firestore.rules → isAdmin()).
// ─────────────────────────────────────────────────────────────

/** List every payment, newest first (admin only). */
export async function listAllPayments(): Promise<PaymentRecord[]> {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPayment(d.id, d.data()));
}

/** Update the lifecycle status of a payment (admin only). */
export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { status });
}

/** Read the admin-entered PII for a payment (admin only). */
export async function getPaymentDetails(
  paymentId: string
): Promise<PaymentDetails> {
  const snap = await getDoc(doc(db, DETAILS_COLLECTION, paymentId));
  if (!snap.exists()) return { ...EMPTY_DETAILS };
  const d = snap.data();
  return {
    address: d.address ?? "",
    birthdate: d.birthdate ?? "",
    gender: d.gender ?? "",
    memo: d.memo ?? "",
  };
}

/** Load PII for many payments at once → map keyed by paymentId (admin only). */
export async function listAllPaymentDetails(): Promise<
  Record<string, PaymentDetails>
> {
  const snap = await getDocs(collection(db, DETAILS_COLLECTION));
  const out: Record<string, PaymentDetails> = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    out[d.id] = {
      address: data.address ?? "",
      birthdate: data.birthdate ?? "",
      gender: data.gender ?? "",
      memo: data.memo ?? "",
    };
  });
  return out;
}

/** Create/overwrite the admin-entered PII for a payment (admin only). */
export async function savePaymentDetails(
  paymentId: string,
  details: PaymentDetails
): Promise<void> {
  await setDoc(doc(db, DETAILS_COLLECTION, paymentId), {
    address: details.address.trim().slice(0, 300),
    birthdate: details.birthdate.trim().slice(0, 40),
    gender: details.gender.trim().slice(0, 20),
    memo: details.memo.trim().slice(0, 1000),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Look up payments by exact name + normalized phone.
 *
 * SECURITY NOTE: with the "방식 A" (direct client access) design the `payments`
 * collection must be readable for this query to run, so the data is not truly
 * private. For production, move this lookup behind a server (Route Handler /
 * Admin SDK) and lock the collection down.
 */
export async function lookupPayments(
  name: string,
  phone: string
): Promise<PaymentRecord[]> {
  const q = query(
    collection(db, COLLECTION),
    where("name", "==", name.trim()),
    where("phone", "==", normalizePhone(phone)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPayment(d.id, d.data()));
}
