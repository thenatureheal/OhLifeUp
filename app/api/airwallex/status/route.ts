import { NextResponse } from "next/server";
import {
  isAirwallexServerConfigured,
  isAirwallexWebhookConfigured,
  airwallexEnv,
} from "@/lib/airwallex-server";

// Reports whether the Airwallex payment integration is configured on the server,
// so the admin UI can show a "connected" status badge. Returns ONLY booleans +
// the env name (demo/prod) — never the client id, api key, or webhook secret.
export async function GET() {
  return NextResponse.json({
    configured: isAirwallexServerConfigured,
    env: isAirwallexServerConfigured ? airwallexEnv : null,
    webhookConfigured: isAirwallexWebhookConfigured,
  });
}
