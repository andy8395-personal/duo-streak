import { motion } from "framer-motion";
import { Flame, Percent, Target, Trophy } from "lucide-react";
import { DayStat, MonthlyCalendar, WeeklyRibbon } from "./History";
import { Pair } from "./types";

function Stat({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; tone: "primary" | "secondary" | "success";
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    secondary: "bg-secondary-soft text-secondary",
    success: "bg-success-soft text-success",
  } as const;
  return (
    <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-2 text-2xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Bar({ label, pct, className }: { label: string; pct: number; className: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold">
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full rounded-full ${className}`} />
      </div>
    </div>
  );
}

export function AnalyticsView({
  stats, pair, youName, partnerName,
}: { stats: DayStat[]; pair: Pair; youName: string; partnerName: string }) {
  const active = stats.filter((s) => s.total > 0);
  const days = active.length || 1;
  const minePct = Math.round((active.reduce((a, s) => a + s.mine, 0) / (days * (active[0]?.total || 1))) * 100);
  const theirsPct = Math.round((active.reduce((a, s) => a + s.theirs, 0) / (days * (active[0]?.total || 1))) * 100);
  const perfectDays = active.filter((s) => s.mine >= s.total && s.theirs >= s.total).length;
  const together = Math.round((perfectDays / days) * 100);

  return (
    <div className="flex flex-1 flex-col pb-32">
      <div className="px-6 pt-6">
        <h1 className="text-2xl font-bold tracking-tight">Your numbers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last {active.length} tracked days with {partnerName}.</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 px-6">
        <Stat icon={Flame} label="Current streak" value={`${pair.current_streak}d`} tone="primary" />
        <Stat icon={Trophy} label="All-time best" value={`${pair.longest_streak}d`} tone="secondary" />
        <Stat icon={Target} label="Perfect days" value={`${perfectDays}`} tone="success" />
        <Stat icon={Percent} label="Done together" value={`${isFinite(together) ? together : 0}%`} tone="primary" />
      </div>

      <div className="mx-6 mt-4 space-y-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Completion rate</div>
        <Bar label={youName} pct={isFinite(minePct) ? Math.min(minePct, 100) : 0} className="bg-primary" />
        <Bar label={partnerName} pct={isFinite(theirsPct) ? Math.min(theirsPct, 100) : 0} className="bg-secondary" />
      </div>

      <WeeklyRibbon stats={stats} />
      <MonthlyCalendar stats={stats} />
    </div>
  );
}
