import { NextResponse } from "next/server";
import {
  createPaymentIntent,
  isAirwallexServerConfigured,
} from "@/lib/airwallex-server";
import { isFirebaseConfigured } from "@/lib/firebase";
import { getProduct, normalizeAmount } from "@/lib/products";

// Node.js runtime (default). Creates an Airwallex PaymentIntent server-side so
// the amount is controlled by the server, not the browser. When the client
// sends a productId, the amount/currency are read from Firestore HERE
// (server-side, admin-written, publicly readable) — the browser only names which
// product, never the price. Returns { id, clientSecret, amount, currency } which
// the client passes to Airwallex's hosted payment page.
export async function POST(req: Request) {
  if (!isAirwallexServerConfigured) {
    return NextResponse.json(
      { error: "Airwallex is not configured on the server." },
      { status: 503 }
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const productId =
      body && typeof body.productId === "string" ? body.productId : "";
    const packageName =
      body && typeof body.packageName === "string"
        ? body.packageName.slice(0, 200)
        : "";

    let opts: {
      amount?: string;
      currency?: string;
      description?: string;
      metadata?: Record<string, string>;
    } = { metadata: packageName ? { packageName } : {} };

    if (productId && isFirebaseConfigured) {
      const product = await getProduct(productId);
      if (product && product.active) {
        const amount = normalizeAmount(product.amount);
        if (amount) {
          opts = {
            amount,
            currency: product.currency || undefined,
            description: product.name || undefined,
            metadata: { packageName: product.name || packageName },
          };
        }
      }
      // Unknown/inactive product → fall back to env defaults (never fail silently
      // with a wrong price; the env default is the legacy single product).
    }

    const intent = await createPaymentIntent(opts);
    return NextResponse.json(intent, { status: 201 });
  } catch (err) {
    console.error("[airwallex] create intent failed:", err);
    return NextResponse.json(
      { error: "Failed to create Airwallex payment intent." },
      { status: 500 }
    );
  }
}
