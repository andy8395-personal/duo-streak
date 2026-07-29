import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Crown, Snowflake, Users, Sparkles, BarChart3 } from "lucide-react";
import { toast } from "sonner";

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
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");

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

        <div className="mt-7 grid grid-cols-2 gap-3">
          <PlanCard label="Monthly" price="$4.99" sub="per month" active={plan === "monthly"} onClick={() => setPlan("monthly")} />
          <PlanCard label="Yearly" price="$39.99" sub="$3.33 / month" badge="Save 33%" active={plan === "yearly"} onClick={() => setPlan("yearly")} />
        </div>

        <button onClick={() => toast("Checkout is coming soon ✨")}
          className="mt-5 w-full rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-[0.98]">
          Start {plan === "yearly" ? "yearly" : "monthly"} plan
        </button>
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
