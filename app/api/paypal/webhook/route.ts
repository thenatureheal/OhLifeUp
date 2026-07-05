import { NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  isPayPalWebhookConfigured,
} from "@/lib/paypal-server";
import { syncPaymentStatus, isWebhookWriterConfigured } from "@/lib/webhook-writer";

// PayPal webhook receiver. PayPal POSTs payment/refund/reversal events here; we
// verify the signature, then auto-sync the matching payment's status in
// Firestore (refund → "refunded", reversal/denied → "cancelled"). This is what
// keeps our records in step with PayPal without manual status changes.
//
// Setup: register this URL (https://www.ohlifeup.com/api/paypal/webhook) in the
// PayPal developer dashboard, then set PAYPAL_WEBHOOK_ID + WEBHOOK_FIREBASE_EMAIL
// + WEBHOOK_FIREBASE_PASSWORD in the environment. See docs/ADMIN_SETUP.md.

interface PayPalLink {
  rel?: string;
  href?: string;
}

/** Pull the capture id out of a refund resource's "up" link. */
function captureIdFromLinks(links: unknown): string {
  if (!Array.isArray(links)) return "";
  const up = (links as PayPalLink[]).find(
    (l) => l?.rel === "up" && typeof l?.href === "string" && l.href.includes("/captures/")
  );
  if (!up?.href) return "";
  const m = up.href.match(/\/captures\/([^/?]+)/);
  return m ? m[1] : "";
}

export async function POST(req: Request) {
  // Not configured → acknowledge (200) so PayPal doesn't retry forever, do nothing.
  if (!isPayPalWebhookConfigured || !isWebhookWriterConfigured) {
    return NextResponse.json(
      { ok: false, reason: "webhook_not_configured" },
      { status: 200 }
    );
  }

  let event: Record<string, unknown>;
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  // 1) Verify the event really came from PayPal.
  const valid = await verifyWebhookSignature(
    {
      transmissionId: req.headers.get("paypal-transmission-id") || "",
      transmissionTime: req.headers.get("paypal-transmission-time") || "",
      certUrl: req.headers.get("paypal-cert-url") || "",
      authAlgo: req.headers.get("paypal-auth-algo") || "",
      transmissionSig: req.headers.get("paypal-transmission-sig") || "",
    },
    event
  );
  if (!valid) {
    return NextResponse.json(
      { ok: false, reason: "invalid_signature" },
      { status: 400 }
    );
  }

  // 2) Handle the events we care about.
  const type = String(event.event_type ?? "");
  const resource = (event.resource ?? {}) as Record<string, unknown>;

  try {
    if (type === "PAYMENT.CAPTURE.REFUNDED") {
      const captureId = captureIdFromLinks(resource.links);
      const amount = (resource.amount as { value?: string })?.value ?? "";
      const result = await syncPaymentStatus({ captureId }, "refunded", {
        type: "refund",
        title: "자동 환불 반영",
        message: `PayPal 환불 감지 (금액 ${amount}, capture ${captureId || "?"})`,
      });
      return NextResponse.json({ ok: true, type, result }, { status: 200 });
    }

    if (type === "PAYMENT.CAPTURE.REVERSED" || type === "PAYMENT.CAPTURE.DENIED") {
      const captureId =
        (resource.id as string) || captureIdFromLinks(resource.links);
      const result = await syncPaymentStatus({ captureId }, "cancelled", {
        type: "cancel",
        title: "자동 취소 반영",
        message: `PayPal 취소/거절 감지 (capture ${captureId || "?"})`,
      });
      return NextResponse.json({ ok: true, type, result }, { status: 200 });
    }

    // Other event types (e.g. CAPTURE.COMPLETED) are acknowledged but not acted
    // on — the payment is already recorded client-side at checkout.
    return NextResponse.json({ ok: true, type, result: "ignored" }, { status: 200 });
  } catch (err) {
    console.error("[paypal webhook] handler error:", err);
    // 200 so PayPal doesn't hammer retries; the error is logged for us.
    return NextResponse.json({ ok: false, reason: "handler_error" }, { status: 200 });
  }
}
