import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Flame, X } from "lucide-react";
import { addDays, dateStr, todayStr } from "./types";

export type DayStat = { date: string; mine: number; theirs: number; total: number };

function statusOf(d: DayStat): "gold" | "half" | "miss" | "future" | "pending" {
  const t = todayStr();
  if (d.date > t) return "future";
  if (d.total === 0) return "pending";
  const mineAll = d.mine >= d.total;
  const theirsAll = d.theirs >= d.total;
  if (mineAll && theirsAll) return "gold";
  if (mineAll || theirsAll || d.mine + d.theirs > 0) return "half";
  return d.date === t ? "pending" : "miss";
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function Badge({ d, size = 40 }: { d: DayStat; size?: number }) {
  const s = statusOf(d);
  const base = "relative grid place-items-center rounded-full text-[11px] font-bold";
  const style = { width: size, height: size };
  if (s === "gold")
    return (
      <div className={`${base} bg-gradient-to-br from-[#ffb347] to-primary text-primary-foreground shadow-[var(--shadow-primary)]`} style={style}>
        <Flame className="h-4 w-4" fill="currentColor" />
      </div>
    );
  if (s === "half")
    return (
      <div className={`${base} overflow-hidden bg-muted text-muted-foreground`} style={style}>
        <div className="absolute inset-y-0 left-0 w-1/2 bg-primary-container" />
        <span className="relative text-foreground">½</span>
      </div>
    );
  if (s === "miss")
    return (
      <div className={`${base} bg-destructive/10 text-destructive`} style={style}>
        <X className="h-4 w-4" strokeWidth={3} />
      </div>
    );
  return <div className={`${base} border-2 border-dashed border-border text-muted-foreground`} style={style} />;
}

export function WeeklyRibbon({ stats }: { stats: DayStat[] }) {
  const week = stats.slice(-7);
  return (
    <div className="mx-6 mt-4 rounded-3xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">This week</h3>
        <span className="text-[11px] font-semibold text-muted-foreground">🔥 both · ½ one · ✕ missed</span>
      </div>
      <div className="flex items-end justify-between">
        {week.map((d) => {
          const day = new Date(`${d.date}T00:00:00`);
          return (
            <motion.div key={d.date} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-1.5">
              <Badge d={d} />
              <span className={`text-[11px] font-bold ${d.date === todayStr() ? "text-primary" : "text-muted-foreground"}`}>
                {DOW[day.getDay()]}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function MonthlyCalendar({ stats }: { stats: DayStat[] }) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  const map = useMemo(() => new Map(stats.map((s) => [s.date, s])), [stats]);
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const monthLabel = base.toLocaleDateString([], { month: "long", year: "numeric" });
  const firstDow = base.getDay();
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();

  const cells: (DayStat | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const date = dateStr(addDays(base, i));
      return map.get(date) ?? { date, mine: 0, theirs: 0, total: 0 };
    }),
  ];

  const goldDays = cells.filter((c) => c && statusOf(c) === "gold").length;

  return (
    <div className="mx-6 mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-3xl bg-surface px-5 py-4 text-left shadow-[var(--shadow-card)] transition active:scale-[0.99]"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary-soft text-secondary">
            <CalendarDays className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold">Monthly heat-map</span>
            <span className="block text-xs text-muted-foreground">{goldDays} perfect days this month</span>
          </span>
        </span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
          <div className="mt-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setOffset((o) => o - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-sm font-bold">{monthLabel}</div>
              <button
                disabled={offset >= 0}
                onClick={() => setOffset((o) => Math.min(0, o + 1))}
                className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {DOW.map((d, i) => (
                <div key={i} className="text-[10px] font-bold uppercase text-muted-foreground">{d}</div>
              ))}
              {cells.map((c, i) =>
                c ? (
                  <div key={c.date} className="flex justify-center">
                    <Badge d={c} size={32} />
                  </div>
                ) : (
                  <div key={`e${i}`} />
                ),
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
