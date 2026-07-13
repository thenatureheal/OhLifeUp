import { NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  isAirwallexWebhookConfigured,
} from "@/lib/airwallex-server";
import { syncPaymentStatus, isWebhookWriterConfigured } from "@/lib/webhook-writer";

// Airwallex webhook receiver. Airwallex POSTs payment/refund events here; we
// verify the HMAC signature, then auto-sync the matching payment's status in
// Firestore (refund → "refunded", cancel → "cancelled"). This keeps our records
// in step with Airwallex without manual status changes — the same role the
// PayPal webhook plays. The payment itself is recorded on the return page at
// checkout, so this route does not create payments, only syncs status.
//
// Setup: register this URL (https://<domain>/api/airwallex/webhook) in the
// Airwallex dashboard (Developer → Webhooks), then set AIRWALLEX_WEBHOOK_SECRET
// + WEBHOOK_FIREBASE_EMAIL + WEBHOOK_FIREBASE_PASSWORD in the environment.

export async function POST(req: Request) {
  // Not configured → acknowledge (200) so Airwallex doesn't retry forever.
  if (!isAirwallexWebhookConfigured || !isWebhookWriterConfigured) {
    return NextResponse.json(
      { ok: false, reason: "webhook_not_configured" },
      { status: 200 }
    );
  }

  // Read the RAW body — signature is computed over the exact bytes, so we must
  // not re-serialize a parsed object.
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-timestamp") || "";
  const signature = req.headers.get("x-signature") || "";

  // 1) Verify the event really came from Airwallex.
  if (!verifyWebhookSignature(timestamp, rawBody, signature)) {
    return NextResponse.json(
      { ok: false, reason: "invalid_signature" },
      { status: 401 }
    );
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  // 2) Handle the events we care about.
  const name = String(event.name ?? "");
  const data = (event.data ?? {}) as { object?: Record<string, unknown> };
  const obj = (data.object ?? {}) as Record<string, unknown>;

  try {
    // Refund succeeded/processing → mark the source payment as refunded. The
    // refund resource carries the originating payment_intent_id, which we stored
    // as the payment's captureId at checkout.
    if (name === "refund.succeeded" || name === "refund.processing") {
      const intentId = String(obj.payment_intent_id ?? "");
      const amount = String(obj.amount ?? "");
      const result = await syncPaymentStatus({ captureId: intentId }, "refunded", {
        type: "refund",
        title: "자동 환불 반영 (Airwallex)",
        message: `Airwallex 환불 감지 (금액 ${amount}, intent ${intentId || "?"})`,
      });
      return NextResponse.json({ ok: true, name, result }, { status: 200 });
    }

    // Intent cancelled → mark the payment cancelled.
    if (name === "payment_intent.cancelled") {
      const intentId = String(obj.id ?? "");
      const result = await syncPaymentStatus({ captureId: intentId }, "cancelled", {
        type: "cancel",
        title: "자동 취소 반영 (Airwallex)",
        message: `Airwallex 취소 감지 (intent ${intentId || "?"})`,
      });
      return NextResponse.json({ ok: true, name, result }, { status: 200 });
    }

    // Other event types (e.g. payment_intent.succeeded) are acknowledged but not
    // acted on — the payment is already recorded on the return page at checkout.
    return NextResponse.json({ ok: true, name, result: "ignored" }, { status: 200 });
  } catch (err) {
    console.error("[airwallex webhook] handler error:", err);
    // 200 so Airwallex doesn't hammer retries; the error is logged for us.
    return NextResponse.json({ ok: false, reason: "handler_error" }, { status: 200 });
  }
}
