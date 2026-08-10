// Sends a push notification to every device registered for a recipient,
// via Firebase Cloud Messaging's HTTP v1 API. Used by the client right
// after a nudge is inserted (see app.tsx `sendNudge`).
//
// Required secrets (Supabase project settings -> Edge Functions -> Secrets),
// taken from a Firebase service account JSON (Firebase console -> Project
// settings -> Service accounts -> Generate new private key):
//   FCM_PROJECT_ID    - the "project_id" field
//   FCM_CLIENT_EMAIL  - the "client_email" field
//   FCM_PRIVATE_KEY   - the "private_key" field, kept exactly as-is
//                       (including the literal "\n" line breaks)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Supabase edge runtime and do not need to be set manually.

import { createClient } from "npm:@supabase/supabase-js@2";

interface SendPushRequest {
  recipientId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID");
const FCM_CLIENT_EMAIL = Deno.env.get("FCM_CLIENT_EMAIL");
const FCM_PRIVATE_KEY = Deno.env.get("FCM_PRIVATE_KEY")?.replace(/\\n/g, "\n");

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
    throw new Error("Push is not configured: missing FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY secrets");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: FCM_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput =
    base64url(new TextEncoder().encode(JSON.stringify(header))) +
    "." +
    base64url(new TextEncoder().encode(JSON.stringify(claims)));

  const pemBody = FCM_PRIVATE_KEY.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Failed to mint FCM access token: ${await res.text()}`);
  const json = await res.json();
  return json.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Missing Authorization header", { status: 401 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify the caller is a real authenticated user.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as SendPushRequest;
  if (!body.recipientId || !body.title || !body.body) {
    return new Response("recipientId, title and body are required", { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Defense in depth: only allow pushing to someone who actually shares a
  // pair with the caller (RLS already enforces this for the nudge insert
  // itself; this just stops the function being used as an open pusher).
  const { data: allowed } = await admin.rpc("shares_pair_with", {
    _other_id: body.recipientId,
    _me: userData.user.id,
  });
  if (!allowed) return new Response("Not a pair member", { status: 403 });

  const { data: tokens, error: tokensError } = await admin
    .from("device_tokens")
    .select("id, token")
    .eq("user_id", body.recipientId);
  if (tokensError) return new Response(tokensError.message, { status: 500 });
  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "content-type": "application/json" } });
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Push not configured", { status: 500 });
  }

  let sent = 0;
  const staleTokenIds: string[] = [];

  await Promise.all(
    tokens.map(async (row) => {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
          body: JSON.stringify({
            message: {
              token: row.token,
              notification: { title: body.title, body: body.body },
              data: body.data ?? {},
              apns: { payload: { aps: { sound: "default" } } },
              android: { priority: "high" },
            },
          }),
        },
      );
      if (res.ok) {
        sent++;
      } else {
        const errText = await res.text();
        if (errText.includes("UNREGISTERED") || errText.includes("NOT_FOUND") || errText.includes("INVALID_ARGUMENT")) {
          staleTokenIds.push(row.id);
        }
      }
    }),
  );

  if (staleTokenIds.length) {
    await admin.from("device_tokens").delete().in("id", staleTokenIds);
  }

  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
});
