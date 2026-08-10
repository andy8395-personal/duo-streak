/**
 * PairUp Pro subscription via RevenueCat, wrapping native StoreKit (iOS) /
 * Play Billing (Android). Apple and Google require their own billing for
 * in-app digital subscriptions, so this — not Stripe — is what the Premium
 * page purchases against. No-ops on web (see premium.tsx for the web-only
 * fallback state).
 *
 * Entitlement identifier expected in the RevenueCat dashboard: "pro".
 * profiles.plan is kept in sync server-side by the revenuecat-webhook
 * edge function, so this module is read-only with respect to plan state —
 * it never writes profiles.plan itself, it just triggers the purchase and
 * lets the webhook (source of truth) update Supabase.
 */
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "@revenuecat/purchases-capacitor";

const ENTITLEMENT_ID = "pro";

const REVENUECAT_KEYS: Record<string, string | undefined> = {
  ios: import.meta.env.VITE_REVENUECAT_IOS_KEY,
  android: import.meta.env.VITE_REVENUECAT_ANDROID_KEY,
};

export const isNativePurchases = () => Capacitor.isNativePlatform();

let configured = false;

export async function configurePurchases(userId: string) {
  if (!isNativePurchases() || configured) return;
  const apiKey = REVENUECAT_KEYS[Capacitor.getPlatform()];
  if (!apiKey) {
    console.warn("[purchases] no RevenueCat API key set for this platform, skipping configure");
    return;
  }
  await Purchases.configure({ apiKey, appUserID: userId });
  configured = true;
}

export async function logOutPurchases() {
  if (!isNativePurchases() || !configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.error("[purchases] logOut failed", err);
  } finally {
    configured = false;
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!isNativePurchases()) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchase(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return customerInfo;
}

export async function restore(): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
}

export function isPro(info: CustomerInfo): boolean {
  return !!info.entitlements.active[ENTITLEMENT_ID];
}
