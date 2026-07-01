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

export const paypalEnv = PAYPAL_ENV;
export const isPayPalServerConfigured = Boolean(CLIENT_ID && CLIENT_SECRET);

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

/** Create a CAPTURE order with the server-controlled amount. Returns { id }. */
export async function createOrder(): Promise<{ id: string }> {
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
          amount: { currency_code: CURRENCY, value: AMOUNT },
          description: DESCRIPTION,
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
