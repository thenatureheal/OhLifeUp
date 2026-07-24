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
    // Quantity is client-sent but only ever multiplies the SERVER-read unit
    // price. Anything outside 1–99 (or non-integer) clamps to 1.
    const rawQty = body ? Number(body.quantity) : 1;
    const quantity =
      Number.isInteger(rawQty) && rawQty >= 1 && rawQty <= 99 ? rawQty : 1;

    let opts: {
      amount?: string;
      currency?: string;
      description?: string;
      metadata?: Record<string, string>;
    } = {
      // Fallback (env-priced legacy product): quantity is NOT applied to the
      // charge, so record it as 1 to keep charge and record consistent.
      metadata: {
        ...(packageName ? { packageName } : {}),
        quantity: "1",
      },
    };

    if (productId && isFirebaseConfigured) {
      const product = await getProduct(productId);
      if (product && product.active) {
        const amount = normalizeAmount(product.amount);
        if (amount) {
          // Total = unit price × quantity, computed in integer cents to avoid
          // floating-point drift.
          const totalCents = Math.round(Number(amount) * 100) * quantity;
          opts = {
            amount: (totalCents / 100).toFixed(2),
            currency: product.currency || undefined,
            description: product.name || undefined,
            metadata: {
              packageName: product.name || packageName,
              quantity: String(quantity),
            },
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
