/**
 * Lightweight device notifications for nudges.
 * Uses the Notification API directly (no service worker) so it works in the
 * browser and inside a native shell that maps web notifications to local ones.
 */

export const notificationsSupported = () =>
  typeof window !== "undefined" && "Notification" in window;

export const notificationPermission = (): NotificationPermission | "unsupported" =>
  notificationsSupported() ? Notification.permission : "unsupported";

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showLocalNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "pairup-nudge" });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {
    /* some browsers require a service worker; toast fallback already shown */
  }
}
