import { NextResponse } from "next/server";
import { captureOrder, isPayPalServerConfigured } from "@/lib/paypal-server";

// Captures (finalizes) an approved PayPal order server-side.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderID: string }> }
) {
  if (!isPayPalServerConfigured) {
    return NextResponse.json(
      { error: "PayPal is not configured on the server." },
      { status: 503 }
    );
  }
  try {
    const { orderID } = await params;
    const result = await captureOrder(orderID);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[paypal] capture failed:", err);
    return NextResponse.json(
      { error: "Failed to capture PayPal order." },
      { status: 500 }
    );
  }
}
