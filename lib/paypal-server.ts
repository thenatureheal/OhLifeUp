// Server-only PayPal helper. Imported ONLY by Route Handlers under
// app/api/paypal/**. Uses the PayPal Orders v2 REST API via native fetch — no
// extra npm package. The client secret lives in a server-only env var
// (PAYPAL_CLIENT_SECRET, no NEXT_PUBLIC_ prefix) so it never reaches the browser.

const PAYPAL_ENV = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";

const BASE =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// Client id may be shared with the public one (it's not secret); secret is not.
const CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";

// The server is the source of truth for the charged amount (anti-tampering).
const AMOUNT =
  process.env.PAYPAL_AMOUNT || process.env.NEXT_PUBLIC_PAYPAL_AMOUNT || "122.00";
const CURRENCY =
  process.env.PAYPAL_CURRENCY ||
  process.env.NEXT_PUBLIC_PAYPAL_CURRENCY ||
  "USD";

const DESCRIPTION = "BGI Bulk Genetic Analysis Package";

const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";

export const paypalEnv = PAYPAL_ENV;
export const isPayPalServerConfigured = Boolean(CLIENT_ID && CLIENT_SECRET);
export const isPayPalWebhookConfigured =
  isPayPalServerConfigured && Boolean(WEBHOOK_ID);

/** OAuth2 client-credentials token. */
async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface OrderOptions {
  amount?: string;
  currency?: string;
  description?: string;
}

/**
 * Create a CAPTURE order with a SERVER-controlled amount. When called with
 * options (resolved from a Firestore product on the server), those win;
 * otherwise the env defaults are used. The browser never dictates the amount.
 * Returns { id }.
 */
export async function createOrder(opts: OrderOptions = {}): Promise<{ id: string }> {
  const amount = opts.amount || AMOUNT;
  const currency = opts.currency || CURRENCY;
  const description = opts.description || DESCRIPTION;
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: currency, value: amount },
          description,
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `PayPal create-order error ${res.status}: ${JSON.stringify(data)}`
    );
  }
  return { id: data.id as string };
}

/**
 * Verify a PayPal webhook signature via PayPal's verify-webhook-signature API.
 * Returns true only when PayPal confirms the event is genuine — this is what
 * stops an attacker from POSTing fake refund events to our webhook.
 */
export async function verifyWebhookSignature(
  headers: {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
  },
  event: unknown
): Promise<boolean> {
  if (!WEBHOOK_ID) return false;
  if (
    !headers.transmissionId ||
    !headers.transmissionSig ||
    !headers.certUrl
  ) {
    return false;
  }
  try {
    const token = await getAccessToken();
    const res = await fetch(
      `${BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          transmission_id: headers.transmissionId,
          transmission_time: headers.transmissionTime,
          cert_url: headers.certUrl,
          auth_algo: headers.authAlgo,
          transmission_sig: headers.transmissionSig,
          webhook_id: WEBHOOK_ID,
          webhook_event: event,
        }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { verification_status?: string };
    return data.verification_status === "SUCCESS";
  } catch (err) {
    console.error("[paypal] webhook verify failed:", err);
    return false;
  }
}

/** Capture (finalize) an approved order. Returns the raw PayPal capture result. */
export async function captureOrder(orderID: string): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/v2/checkout/orders/${orderID}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `PayPal capture error ${res.status}: ${JSON.stringify(data)}`
    );
  }
  return data;
}
