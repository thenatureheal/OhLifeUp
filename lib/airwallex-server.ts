// Server-only Airwallex helper. Imported ONLY by Route Handlers under
// app/api/airwallex/**. Uses the Airwallex Payment Acceptance REST API via
// native fetch — no extra npm package on the server. The API key lives in a
// server-only env var (AIRWALLEX_API_KEY, no NEXT_PUBLIC_ prefix) so it never
// reaches the browser.
//
// Flow (Hosted Payment Page): the browser collects buyer info, the SERVER
// creates a PaymentIntent with a server-controlled amount, the browser redirects
// to Airwallex's hosted page with the returned client_secret, then Airwallex
// redirects back to our return page. Refund/cancel are synced via the webhook.

import crypto from "crypto";

const AIRWALLEX_ENV =
  process.env.AIRWALLEX_ENV === "prod" ? "prod" : "demo";

const BASE =
  AIRWALLEX_ENV === "prod"
    ? "https://api.airwallex.com"
    : "https://api-demo.airwallex.com";

const CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID || "";
const API_KEY = process.env.AIRWALLEX_API_KEY || "";
const WEBHOOK_SECRET = process.env.AIRWALLEX_WEBHOOK_SECRET || "";

// The server is the source of truth for the charged amount (anti-tampering).
const AMOUNT = process.env.AIRWALLEX_AMOUNT || "29.00";
const CURRENCY = process.env.AIRWALLEX_CURRENCY || "USD";

const DESCRIPTION = "BGI Bulk Genetic Analysis Package";

export const airwallexEnv = AIRWALLEX_ENV;
export const isAirwallexServerConfigured = Boolean(CLIENT_ID && API_KEY);
export const isAirwallexWebhookConfigured =
  isAirwallexServerConfigured && Boolean(WEBHOOK_SECRET);

/** Login with client id + api key → short-lived bearer token (~30 min). */
async function getAccessToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "x-client-id": CLIENT_ID,
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airwallex login error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export interface IntentOptions {
  amount?: string;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CreatedIntent {
  id: string;
  clientSecret: string;
  amount: string;
  currency: string;
}

/**
 * Create a PaymentIntent with a SERVER-controlled amount. When called with
 * options (resolved from a Firestore product on the server), those win;
 * otherwise the env defaults are used. The browser never dictates the amount.
 * Returns the intent id + client_secret needed to launch the hosted page.
 */
export async function createPaymentIntent(
  opts: IntentOptions = {}
): Promise<CreatedIntent> {
  const amount = opts.amount || AMOUNT;
  const currency = opts.currency || CURRENCY;
  const description = opts.description || DESCRIPTION;
  const token = await getAccessToken();

  const requestId = crypto.randomUUID();
  const res = await fetch(`${BASE}/api/v1/pa/payment_intents/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      request_id: requestId,
      // Airwallex takes the amount as a NUMBER (major units), unlike PayPal.
      amount: Number(amount),
      currency,
      merchant_order_id: requestId,
      descriptor: description.slice(0, 32),
      metadata: opts.metadata ?? {},
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Airwallex create-intent error ${res.status}: ${JSON.stringify(data)}`
    );
  }
  return {
    id: data.id as string,
    clientSecret: data.client_secret as string,
    amount: String(amount),
    currency,
  };
}

export interface IntentStatus {
  id: string;
  status: string; // e.g. "SUCCEEDED", "REQUIRES_PAYMENT_METHOD", "CANCELLED"
  amount: string;
  currency: string;
  cardBrand: string;
  cardLast4: string;
}

/** Fetch a PaymentIntent to verify its real status + amount (never trust the client). */
export async function getPaymentIntent(intentId: string): Promise<IntentStatus> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/api/v1/pa/payment_intents/${intentId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Airwallex get-intent error ${res.status}: ${JSON.stringify(data)}`
    );
  }
  const card =
    data?.latest_payment_attempt?.payment_method?.card ?? ({} as Record<string, unknown>);
  return {
    id: data.id as string,
    status: String(data.status ?? ""),
    amount: String(data.amount ?? ""),
    currency: String(data.currency ?? ""),
    cardBrand: String(card?.brand ?? ""),
    cardLast4: String(card?.last4 ?? ""),
  };
}

/**
 * Refund a PaymentIntent in full via the Airwallex Refunds API. Requires the
 * payment_intent id (stored as `captureId` on the payment at checkout) and the
 * amount. Returns the refund id/status.
 */
export async function refundPaymentIntent(
  paymentIntentId: string,
  amount: string,
  reason = "requested_by_customer"
): Promise<{ id: string; status: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/api/v1/pa/refunds/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      // Idempotency: retrying the same refund won't double-refund.
      request_id: `refund-${paymentIntentId}`,
      payment_intent_id: paymentIntentId,
      amount: Number(amount),
      reason,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Airwallex refund error ${res.status}: ${JSON.stringify(data)}`
    );
  }
  return { id: data.id as string, status: String(data.status ?? "") };
}

/**
 * Verify an Airwallex webhook signature. Airwallex signs each event with
 * HMAC-SHA256 over (timestamp + raw_body) using your webhook secret, sent in the
 * `x-signature` header (`x-timestamp` carries the timestamp). This is what stops
 * an attacker from POSTing fake refund events to our webhook.
 */
export function verifyWebhookSignature(
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  if (!WEBHOOK_SECRET || !timestamp || !signature) return false;
  try {
    const expected = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(timestamp + rawBody)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (err) {
    console.error("[airwallex] webhook verify failed:", err);
    return false;
  }
}
