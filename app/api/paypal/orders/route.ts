import { NextResponse } from "next/server";
import { createOrder, isPayPalServerConfigured } from "@/lib/paypal-server";

// Node.js runtime (default). Creates a PayPal order server-side so the amount
// is controlled by the server, not the browser.
export async function POST() {
  if (!isPayPalServerConfigured) {
    return NextResponse.json(
      { error: "PayPal is not configured on the server." },
      { status: 503 }
    );
  }
  try {
    const order = await createOrder();
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error("[paypal] create order failed:", err);
    return NextResponse.json(
      { error: "Failed to create PayPal order." },
      { status: 500 }
    );
  }
}
