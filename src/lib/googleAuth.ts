/**
 * Google sign-in via Supabase's built-in OAuth provider — not Lovable's
 * cloud-auth-js broker, which only works when the app is served from
 * Lovable's own hosting (its /~oauth/initiate route 404s everywhere else,
 * including localhost and any self-hosted deploy).
 *
 * Web: a normal full-page redirect to Google and back.
 *
 * Native: Google blocks OAuth sign-in from embedded WebViews (which is what
 * the Capacitor app's main WebView is), so this opens the system browser via
 * @capacitor/browser instead, and catches the redirect back into the app
 * through a custom URL scheme deep link ("app.pairup.streaks://auth-callback"),
 * registered natively in Info.plist / AndroidManifest.xml.
 *
 * Requires, in the Supabase dashboard (Authentication -> Providers -> Google):
 *   - A Google Cloud OAuth client (Web application type) with client ID/secret
 *   - Redirect URLs allow-listed: the Supabase callback URL Google redirects
 *     to first (shown in the provider config screen), plus
 *     "app.pairup.streaks://auth-callback" for the native deep link back.
 */
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

const NATIVE_REDIRECT_URL = "app.pairup.streaks://auth-callback";

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  if (!Capacitor.isNativePlatform()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
    return { error };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: error ?? new Error("Failed to start Google sign-in") };

  await Browser.open({ url: data.url });
  return { error: null };
}

let listening = false;

/** Call once at app startup on native platforms. */
export function registerGoogleAuthCallback() {
  if (!Capacitor.isNativePlatform() || listening) return;
  listening = true;

  App.addListener("appUrlOpen", async (event: URLOpenListenerEvent) => {
    if (!event.url.startsWith(NATIVE_REDIRECT_URL)) return;
    await Browser.close().catch(() => {});
    const code = new URL(event.url).searchParams.get("code");
    if (!code) { console.error("[google-auth] callback missing auth code", event.url); return; }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[google-auth] failed to complete sign-in", error);
  });
}
