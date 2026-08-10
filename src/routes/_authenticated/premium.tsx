import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Crown, Snowflake, Users, Sparkles, BarChart3, Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { PurchasesOffering, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentOffering, isNativePurchases, isPro, purchase, restore } from "@/lib/purchases";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({
    meta: [
      { title: "PairUp Pro — unlimited partners & freezes" },
      { name: "description", content: "Upgrade to PairUp Pro for unlimited partners, unlimited habits, extra streak freezes and full analytics." },
      { property: "og:title", content: "PairUp Pro — unlimited partners & freezes" },
      { property: "og:description", content: "Upgrade to PairUp Pro for unlimited partners, unlimited habits, extra streak freezes and full analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Premium,
});

const PERKS = [
  { icon: Users, title: "Unlimited partners", body: "Pair with as many accountability buddies as you like — each with their own streak." },
  { icon: Snowflake, title: "Unlimited streak freezes", body: "Life happens. Save your streak whenever you need instead of once a month." },
  { icon: Check, title: "Unlimited habits", body: "Go past 4 daily habit rows per pair, no videos required." },
  { icon: BarChart3, title: "Full history & insights", body: "Unlimited heat-map history, per-partner comparisons and exports." },
  { icon: Sparkles, title: "No rewarded videos", body: "Everything unlocked up front, ad-free forever." },
];

function Premium() {
  const navigate = useNavigate();
  const native = isNativePurchases();
  const [plan, setPlan] = useState("free");
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(native);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data } = await supabase.from("profiles").select("plan").eq("id", userData.user.id).maybeSingle();
        if (data) setPlan(data.plan);
      }
      if (native) {
        try {
          const current = await getCurrentOffering();
          setOffering(current);
          setSelected(current?.annual ?? current?.monthly ?? current?.availablePackages[0] ?? null);
        } catch (err) {
          console.error("[premium] failed to load offerings", err);
        } finally {
          setLoading(false);
        }
      }
    })();
  }, [native]);

  const buy = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const info = await purchase(selected);
      if (isPro(info)) {
        setPlan("pro");
        toast.success("Welcome to PairUp Pro! 🎉");
      }
    } catch (err: unknown) {
      const cancelled = typeof err === "object" && err !== null && "userCancelled" in err && (err as { userCancelled?: boolean }).userCancelled;
      if (!cancelled) toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  };

  const restoreClick = async () => {
    setBusy(true);
    try {
      const info = await restore();
      if (isPro(info)) { setPlan("pro"); toast.success("Pro restored!"); }
      else toast("No previous Pro purchase found on this account");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pb-12 pt-6">
        <button onClick={() => navigate({ to: "/app" })}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-bold shadow-[var(--shadow-card)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 overflow-hidden rounded-[32px] bg-gradient-to-br from-secondary to-[#2b86d9] p-6 text-secondary-foreground shadow-[var(--shadow-secondary)]">
          <Crown className="h-7 w-7" />
          <h1 className="mt-3 text-2xl font-bold leading-tight">PairUp Pro</h1>
          <p className="mt-1 text-sm opacity-95">Everything unlocked, for you and every partner you pair with.</p>
        </motion.div>

        <div className="mt-6 space-y-3">
          {PERKS.map((p) => (
            <div key={p.title} className="flex items-start gap-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-card)]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <p.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-sm font-bold">{p.title}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>

        {plan === "pro" ? (
          <div className="mt-7 rounded-3xl bg-success-soft p-5 text-center">
            <Crown className="mx-auto h-6 w-6 text-success" />
            <div className="mt-2 text-sm font-bold text-success">You're on PairUp Pro</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage or cancel anytime from your {navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad") ? "Apple ID" : "Google Play"} subscriptions.
            </p>
          </div>
        ) : !native ? (
          <div className="mt-7 rounded-3xl bg-surface p-5 text-center shadow-[var(--shadow-card)]">
            <Smartphone className="mx-auto h-6 w-6 text-secondary" />
            <div className="mt-2 text-sm font-bold">Subscribe from the PairUp app</div>
            <p className="mt-1 text-xs text-muted-foreground">
              PairUp Pro is sold as an in-app subscription through the App Store / Google Play. Install PairUp on your phone to upgrade.
            </p>
          </div>
        ) : loading ? (
          <div className="mt-7 text-center text-xs text-muted-foreground">Loading plans…</div>
        ) : !offering || offering.availablePackages.length === 0 ? (
          <div className="mt-7 rounded-3xl bg-surface p-5 text-center shadow-[var(--shadow-card)]">
            <div className="text-sm font-bold">Plans aren't available yet</div>
            <p className="mt-1 text-xs text-muted-foreground">Check back shortly — Pro plans are being set up.</p>
          </div>
        ) : (
          <>
            <div className="mt-7 grid grid-cols-2 gap-3">
              {offering.availablePackages.map((pkg) => (
                <PlanCard
                  key={pkg.identifier}
                  label={pkg.packageType === "ANNUAL" ? "Yearly" : pkg.packageType === "MONTHLY" ? "Monthly" : pkg.product.title}
                  price={pkg.product.priceString}
                  sub={pkg.product.pricePerMonthString ? `${pkg.product.pricePerMonthString} / month` : ""}
                  badge={offering.annual?.identifier === pkg.identifier ? "Best value" : undefined}
                  active={selected?.identifier === pkg.identifier}
                  onClick={() => setSelected(pkg)}
                />
              ))}
            </div>

            <button onClick={buy} disabled={busy || !selected}
              className="mt-5 w-full rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-[0.98] disabled:opacity-60">
              {busy ? "…" : `Start ${selected?.packageType === "ANNUAL" ? "yearly" : "monthly"} plan`}
            </button>
            <button onClick={restoreClick} disabled={busy} className="mt-3 text-center text-xs font-semibold text-muted-foreground underline">
              Restore purchases
            </button>
          </>
        )}

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Cancel anytime. The free plan keeps 1 partner, 3 habits and 1 streak freeze each month.
        </p>
      </div>
    </div>
  );
}

function PlanCard({ label, price, sub, badge, active, onClick }: {
  label: string; price: string; sub: string; badge?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`relative rounded-3xl p-4 text-left transition ${active ? "bg-surface ring-2 ring-primary shadow-[var(--shadow-card)]" : "bg-muted"}`}>
      {badge && (
        <span className="absolute -top-2 right-3 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-success-foreground">{badge}</span>
      )}
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{price}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </button>
  );
}
