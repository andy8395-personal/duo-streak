// Keeps profiles.plan in sync with RevenueCat's server-side subscription
// state. This is the source of truth for "pro" access — the client SDK
// (src/lib/purchases.ts) only ever *initiates* a purchase; it never writes
// plan itself, since a device's local receipt state can lag or be spoofed.
//
// Setup (RevenueCat dashboard -> Project settings -> Integrations -> Webhooks):
//   URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header value: same string you set as the REVENUECAT_WEBHOOK_SECRET
//   Supabase edge function secret.
//
// The RevenueCat app_user_id must equal the Supabase auth user id — this
// holds as long as the client always calls Purchases.configure/logIn with
// the Supabase user id (see configurePurchases in src/lib/purchases.ts).

import { createClient } from "npm:@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");

const PRO_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "TRANSFER",
  "TEST",
]);
const FREE_EVENTS = new Set(["EXPIRATION"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (WEBHOOK_SECRET) {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${WEBHOOK_SECRET}` && auth !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const payload = await req.json();
  const event = payload?.event;
  const userId: string | undefined = event?.app_user_id;
  const type: string | undefined = event?.type;
  if (!userId || !type) return new Response("Malformed payload", { status: 400 });

  if (!PRO_EVENTS.has(type) && !FREE_EVENTS.has(type)) {
    // Informational events we don't act on (BILLING_ISSUE, CANCELLATION —
    // CANCELLATION just turns off auto-renew, access continues until
    // EXPIRATION fires at the end of the paid period).
    return new Response(JSON.stringify({ ignored: type }), { headers: { "content-type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const plan = PRO_EVENTS.has(type) ? "pro" : "free";
  const { error } = await admin.from("profiles").update({ plan }).eq("id", userId);
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify({ userId, plan }), { headers: { "content-type": "application/json" } });
});
