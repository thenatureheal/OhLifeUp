import { NextResponse } from "next/server";
import { createOrder, isPayPalServerConfigured } from "@/lib/paypal-server";
import { isFirebaseConfigured } from "@/lib/firebase";
import { getProduct, normalizeAmount } from "@/lib/products";

// Node.js runtime (default). Creates a PayPal order server-side so the amount is
// controlled by the server, not the browser. When the client sends a productId,
// the amount/currency are read from Firestore HERE (server-side, admin-written,
// publicly readable) — the browser only names which product, never the price.
export async function POST(req: Request) {
  if (!isPayPalServerConfigured) {
    return NextResponse.json(
      { error: "PayPal is not configured on the server." },
      { status: 503 }
    );
  }
  try {
    let opts: { amount?: string; currency?: string; description?: string } = {};

    const body = await req.json().catch(() => ({}));
    const productId =
      body && typeof body.productId === "string" ? body.productId : "";

    if (productId && isFirebaseConfigured) {
      const product = await getProduct(productId);
      if (product && product.active) {
        const amount = normalizeAmount(product.amount);
        if (amount) {
          opts = {
            amount,
            currency: product.currency || undefined,
            description: product.name || undefined,
          };
        }
      }
      // Unknown/inactive product → fall back to env defaults (never fail silently
      // with a wrong price; the env default is the legacy single product).
    }

    const order = await createOrder(opts);
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error("[paypal] create order failed:", err);
    return NextResponse.json(
      { error: "Failed to create PayPal order." },
      { status: 500 }
    );
  }
}
