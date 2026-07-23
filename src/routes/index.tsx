import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Users, ArrowRight, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/pairup-logo.png.asset.json";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PairUp — Shared Habit Streaks for Two" },
      { name: "description", content: "PairUp is a two-person habit tracker. Set daily habits with your partner and keep a shared streak alive — only when you both show up." },
      { property: "og:title", content: "PairUp — Shared Habit Streaks for Two" },
      { property: "og:description", content: "A tiny, playful habit app built for pairs. Set 1–3 daily habits and grow one shared streak." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pb-10 pt-14">
        <div className="flex items-center justify-center">
          <img src={logo.url} alt="PairUp logo" className="h-14 w-auto" />
        </div>
        <div className="mt-10 text-center">
          <h1 className="text-balance text-[36px] font-bold leading-tight tracking-tight">
            Two people. <span className="text-primary">One streak.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[320px] text-[15px] text-muted-foreground">
            Set up to 3 daily habits with a partner. The streak only counts when you <b>both</b> show up.
          </p>
        </div>

        <div className="mt-10 flex flex-1 flex-col gap-3">
          <Link
            to="/auth"
            className="group flex items-center justify-between rounded-3xl bg-primary px-6 py-5 text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-[0.98]"
          >
            <div className="text-left">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Get started</div>
              <div className="text-lg font-bold">Create your account</div>
            </div>
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </Link>
          <Link
            to="/auth"
            className="group flex items-center justify-between rounded-3xl border-2 border-secondary/20 bg-secondary-soft px-6 py-5 text-secondary transition active:scale-[0.98]"
          >
            <div className="text-left">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Have an invite?</div>
              <div className="text-lg font-bold">Sign in</div>
            </div>
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </Link>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
              <Flame className="h-5 w-5 text-primary" />
              <div className="mt-2 text-sm font-bold">Shared streaks</div>
              <div className="mt-1 text-xs text-muted-foreground">Grow one streak, together.</div>
            </div>
            <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
              <Users className="h-5 w-5 text-secondary" />
              <div className="mt-2 text-sm font-bold">Built for pairs</div>
              <div className="mt-1 text-xs text-muted-foreground">Partners, friends, siblings.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
