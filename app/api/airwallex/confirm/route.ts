import { NextResponse } from "next/server";
import {
  getPaymentIntent,
  isAirwallexServerConfigured,
} from "@/lib/airwallex-server";

// Called by the Airwallex return page after the shopper is redirected back. The
// client must NOT be trusted to say "payment succeeded", so this route fetches
// the PaymentIntent from Airwallex server-side and reports its real status +
// amount + card info. The return page records the payment only when this returns
// status === "SUCCEEDED".
export async function POST(req: Request) {
  if (!isAirwallexServerConfigured) {
    return NextResponse.json(
      { ok: false, error: "Airwallex is not configured on the server." },
      { status: 503 }
    );
  }

  let body: { intentId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const intentId = body.intentId;
  if (!intentId) {
    return NextResponse.json(
      { ok: false, error: "intentId is required." },
      { status: 400 }
    );
  }

  try {
    const intent = await getPaymentIntent(intentId);
    return NextResponse.json(
      {
        ok: true,
        id: intent.id,
        status: intent.status,
        succeeded: intent.status === "SUCCEEDED",
        amount: intent.amount,
        currency: intent.currency,
        cardBrand: intent.cardBrand,
        cardLast4: intent.cardLast4,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[airwallex] confirm failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch payment intent." },
      { status: 500 }
    );
  }
}
