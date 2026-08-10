/**
 * Native push notifications (iOS + Android) via Firebase Cloud Messaging,
 * bridged through @capacitor-firebase/messaging. No-ops on web — the
 * browser Notification path in notifications.ts already covers that case.
 */
import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

export const isNativePush = () => Capacitor.isNativePlatform();

let registered = false;

export async function registerPush() {
  if (!isNativePush() || registered) return;

  try {
    const perm = await FirebaseMessaging.checkPermissions();
    let receive = perm.receive;
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      receive = (await FirebaseMessaging.requestPermissions()).receive;
    }
    if (receive !== "granted") return;
    registered = true;

    const saveToken = async (token: string) => {
      const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
      const { error } = await supabase.rpc("register_device_token", {
        _token: token,
        _platform: platform,
      });
      if (error) console.error("[push] failed to register device token", error);
    };

    const { token } = await FirebaseMessaging.getToken();
    await saveToken(token);
    await FirebaseMessaging.addListener("tokenReceived", (event) => {
      void saveToken(event.token);
    });

    // Foreground delivery is already handled by the Supabase realtime
    // subscription in app.tsx (toast + haptic), so this listener is
    // intentionally a no-op — it just stops a duplicate OS banner on
    // Android. Only the tap action needs handling here: bring the user
    // back into the app when they tap a notification from the tray.
    await FirebaseMessaging.addListener("notificationReceived", () => {});
    await FirebaseMessaging.addListener("notificationActionPerformed", () => {
      window.location.assign("/app");
    });
  } catch (err) {
    console.error("[push] registration failed", err);
    registered = false;
  }
}

export async function unregisterPush() {
  if (!isNativePush()) return;
  try {
    await FirebaseMessaging.deleteToken();
  } catch (err) {
    console.error("[push] failed to delete token", err);
  } finally {
    registered = false;
  }
}

export async function sendPush(
  recipientId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const { error } = await supabase.functions.invoke("send-push", {
    body: { recipientId, title, body, data },
  });
  if (error) console.error("[push] send-push failed", error);
}
