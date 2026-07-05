import { NextResponse } from "next/server";
import { refundCapture, isPayPalServerConfigured } from "@/lib/paypal-server";

// Admin-only: actually refund a payment on PayPal. The client sends the admin's
// Firebase ID token; we verify it (and the email allowlist) server-side before
// touching PayPal. The capture id is read from Firestore (not trusted from the
// client) so an admin can only refund the real capture behind that payment.

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const ADMIN_EMAILS = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS || "thenatureheal@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Validate the Firebase ID token and confirm the email is an admin. */
async function verifyAdmin(idToken: string): Promise<boolean> {
  if (!idToken || !API_KEY) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as {
      users?: Array<{ email?: string }>;
    };
    const email = data.users?.[0]?.email?.toLowerCase();
    return Boolean(email && ADMIN_EMAILS.includes(email));
  } catch {
    return false;
  }
}

/** Read a payment doc (public read) to get its real capture id + status. */
async function getPayment(
  paymentId: string
): Promise<{ captureId: string; status: string } | null> {
  const res = await fetch(`${FS_BASE}/payments/${paymentId}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const doc = (await res.json()) as {
    fields?: Record<string, { stringValue?: string }>;
  };
  const f = doc.fields ?? {};
  return {
    captureId: f.captureId?.stringValue ?? "",
    status: f.status?.stringValue ?? "",
  };
}

export async function POST(req: Request) {
  if (!isPayPalServerConfigured) {
    return NextResponse.json(
      { ok: false, error: "PayPal이 서버에 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  let body: { paymentId?: string; idToken?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const { paymentId, idToken } = body;
  if (!paymentId || !idToken) {
    return NextResponse.json(
      { ok: false, error: "필수 값이 없습니다." },
      { status: 400 }
    );
  }

  if (!(await verifyAdmin(idToken))) {
    return NextResponse.json(
      { ok: false, error: "관리자 인증에 실패했습니다." },
      { status: 403 }
    );
  }

  const pay = await getPayment(paymentId);
  if (!pay) {
    return NextResponse.json(
      { ok: false, error: "결제를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  if (!pay.captureId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "이 결제는 capture id가 없어 자동 환불이 불가합니다. PayPal에서 직접 환불해주세요.",
      },
      { status: 422 }
    );
  }
  if (pay.status !== "paid") {
    return NextResponse.json(
      { ok: false, error: `이미 '${pay.status}' 상태입니다.` },
      { status: 409 }
    );
  }

  try {
    const refund = await refundCapture(pay.captureId);
    return NextResponse.json(
      { ok: true, refundId: refund.id, status: refund.status },
      { status: 200 }
    );
  } catch (err) {
    console.error("[admin refund] failed:", err);
    return NextResponse.json(
      { ok: false, error: "PayPal 환불 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
