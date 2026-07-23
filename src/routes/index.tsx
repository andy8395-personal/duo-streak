import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Check,
  Copy,
  Share2,
  Plus,
  Trash2,
  Bell,
  Sparkles,
  Dumbbell,
  BookOpen,
  Droplet,
  Moon,
  Brain,
  Heart,
  Sun,
  ArrowRight,
  Users,
} from "lucide-react";
import logo from "@/assets/pairup-logo.png.asset.json";

export const Route = createFileRoute("/")({ component: PairUpApp });

/* ---------------------- Types & mock data ---------------------- */

type IconKey = "check" | "run" | "book" | "water" | "sleep" | "brain" | "heart" | "sun";
const ICONS: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  check: Check, run: Dumbbell, book: BookOpen, water: Droplet, sleep: Moon,
  brain: Brain, heart: Heart, sun: Sun,
};
const ICON_ORDER: IconKey[] = ["check", "run", "book", "water", "sleep", "brain", "heart", "sun"];

type Habit = { id: string; title: string; icon: IconKey };
type Screen = "onboarding" | "app";

const genCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

/* ---------------------- Root ---------------------- */

function PairUpApp() {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [inviteCode, setInviteCode] = useState<string>("");
  const [me] = useState({ name: "You", initial: "Y", color: "primary" as const });
  const [partner, setPartner] = useState({ name: "Alex", initial: "A", color: "secondary" as const });

  const [habits, setHabits] = useState<Habit[]>([
    { id: "1", title: "Morning workout", icon: "run" },
    { id: "2", title: "Read 20 minutes", icon: "book" },
    { id: "3", title: "Drink 2L water", icon: "water" },
  ]);
  const [myDone, setMyDone] = useState<Record<string, boolean>>({});
  const [partnerDone, setPartnerDone] = useState<Record<string, boolean>>({ "1": true });
  const [streak, setStreak] = useState(14);
  const [longest, setLongest] = useState(21);
  const [nudgeSent, setNudgeSent] = useState(false);

  // Simulate partner completing a habit ~8s after joining
  useEffect(() => {
    if (screen !== "app") return;
    const t = setTimeout(() => {
      setPartnerDone((p) => ({ ...p, "2": true }));
    }, 9000);
    return () => clearTimeout(t);
  }, [screen]);

  const bothCompleteAll = useMemo(
    () => habits.length > 0 && habits.every((h) => myDone[h.id] && partnerDone[h.id]),
    [habits, myDone, partnerDone],
  );

  // When both finish all → bump streak (once)
  const bumpedRef = useRef(false);
  useEffect(() => {
    if (bothCompleteAll && !bumpedRef.current) {
      bumpedRef.current = true;
      setStreak((s) => {
        const next = s + 1;
        setLongest((l) => Math.max(l, next));
        return next;
      });
    }
  }, [bothCompleteAll]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col">
        <AnimatePresence mode="wait">
          {screen === "onboarding" ? (
            <motion.div
              key="onb"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-1 flex-col"
            >
              <Onboarding
                onEnter={(code, partnerName) => {
                  setInviteCode(code);
                  if (partnerName) setPartner((p) => ({ ...p, name: partnerName, initial: partnerName[0]?.toUpperCase() ?? "P" }));
                  setScreen("app");
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="app"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col pb-28"
            >
              <Header me={me} partner={partner} inviteCode={inviteCode} />
              <StreakBanner streak={streak} longest={longest} active={bothCompleteAll} />
              <PartnerStatus me={me} partner={partner} habits={habits} myDone={myDone} partnerDone={partnerDone} />
              <HabitList
                habits={habits}
                myDone={myDone}
                partnerDone={partnerDone}
                partner={partner}
                onToggle={(id) => setMyDone((m) => ({ ...m, [id]: !m[id] }))}
                onRemove={(id) => setHabits((hs) => hs.filter((h) => h.id !== id))}
                onAdd={(h) => setHabits((hs) => (hs.length >= 3 ? hs : [...hs, h]))}
              />
              <NudgeBar
                partner={partner}
                partnerPending={habits.some((h) => !partnerDone[h.id])}
                sent={nudgeSent}
                onSend={() => {
                  setNudgeSent(true);
                  setTimeout(() => setNudgeSent(false), 2500);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------------------- Onboarding ---------------------- */

function Onboarding({ onEnter }: { onEnter: (code: string, partnerName?: string) => void }) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [code, setCode] = useState(genCode());
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex flex-1 flex-col px-6 pb-10 pt-14">
      <div className="flex items-center justify-center">
        <img src={logo.url} alt="PairUp logo" className="h-14 w-auto" />
      </div>
      <div className="mt-8 text-center">
        <h1 className="text-balance text-[34px] font-bold leading-tight tracking-tight">
          Two people. <span className="text-primary">One streak.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-[300px] text-[15px] text-muted-foreground">
          Set up to 3 daily habits with a partner. The streak only counts when you <b>both</b> show up.
        </p>
      </div>

      <div className="mt-10 flex-1">
        {mode === "choose" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode("create")}
              className="group flex items-center justify-between rounded-3xl bg-primary px-6 py-5 text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-[0.98]"
            >
              <div className="text-left">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Mode A</div>
                <div className="text-lg font-bold">Create a Pair</div>
              </div>
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => setMode("join")}
              className="group flex items-center justify-between rounded-3xl border-2 border-secondary/20 bg-secondary-soft px-6 py-5 text-secondary transition active:scale-[0.98]"
            >
              <div className="text-left">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Mode B</div>
                <div className="text-lg font-bold">Enter Invite Code</div>
              </div>
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </button>

            <div className="mt-6 rounded-2xl bg-surface p-4 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
              <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" /> Built for pairs
              </div>
              Partners, best friends, siblings — anyone who wants to keep each other honest.
            </div>
          </div>
        )}

        {mode === "create" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-card)]">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your invite code
              </div>
              <div className="mt-3 flex items-center justify-center gap-1 font-mono text-[38px] font-bold tracking-[0.2em] text-primary">
                {code.split("").map((c, i) => (
                  <span key={i} className="rounded-xl bg-primary-soft px-2.5 py-1">{c}</span>
                ))}
              </div>
              <div className="mt-4 flex justify-center gap-2">
                <button onClick={copy} className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition active:scale-95">
                  <Copy className="h-4 w-4" /> {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => setCode(genCode())}
                  className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition active:scale-95"
                >
                  <Sparkles className="h-4 w-4" /> Regenerate
                </button>
              </div>
            </div>
            <button
              onClick={() => navigator.share?.({ title: "Join me on PairUp", text: `My PairUp invite code: ${code}` }).catch(() => {})}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-4 text-sm font-bold text-secondary-foreground shadow-[var(--shadow-secondary)] transition active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" /> Share invite link
            </button>
            <button
              onClick={() => onEnter(code)}
              className="rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-[0.98]"
            >
              I'm in — start our streak
            </button>
            <button onClick={() => setMode("choose")} className="text-sm text-muted-foreground underline underline-offset-4">
              Back
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-surface p-6 shadow-[var(--shadow-card)]">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Enter 6-character invite code
              </label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="ABC123"
                className="mt-3 w-full rounded-2xl bg-muted px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.35em] text-foreground outline-none ring-primary/40 transition focus:ring-4"
              />
            </div>
            <button
              disabled={joinCode.length !== 6}
              onClick={() => onEnter(joinCode, "Alex")}
              className="rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
            >
              Join pair
            </button>
            <button onClick={() => setMode("choose")} className="text-sm text-muted-foreground underline underline-offset-4">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- Header ---------------------- */

function Header({ me, partner, inviteCode }: { me: { name: string; initial: string }; partner: { name: string; initial: string }; inviteCode: string }) {
  return (
    <div className="flex items-center justify-between px-6 pt-8">
      <div className="flex items-center gap-2">
        <img src={logo.url} alt="PairUp" className="h-8 w-auto" />
      </div>
      <div className="flex items-center gap-2">
        {inviteCode && (
          <div className="rounded-full bg-muted px-3 py-1.5 font-mono text-xs font-bold tracking-widest text-muted-foreground">
            {inviteCode}
          </div>
        )}
        <AvatarPair me={me} partner={partner} />
      </div>
    </div>
  );
}

function AvatarPair({ me, partner }: { me: { initial: string }; partner: { initial: string } }) {
  return (
    <div className="flex -space-x-2">
      <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-primary text-sm font-bold text-primary-foreground">{me.initial}</div>
      <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-secondary text-sm font-bold text-secondary-foreground">{partner.initial}</div>
    </div>
  );
}

/* ---------------------- Streak Banner ---------------------- */

function StreakBanner({ streak, longest, active }: { streak: number; longest: number; active: boolean }) {
  return (
    <div className="mx-6 mt-6 overflow-hidden rounded-[32px] bg-gradient-to-br from-primary to-[#ff8a5b] p-6 text-primary-foreground shadow-[var(--shadow-primary)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Shared streak</div>
          <div className="mt-2 flex items-end gap-2">
            <motion.div
              key={streak}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[64px] font-bold leading-none tracking-tight"
            >
              {streak}
            </motion.div>
            <div className="pb-2 text-lg font-semibold opacity-90">days</div>
          </div>
          <div className="mt-1 text-sm font-medium opacity-90">
            Longest: <b>{longest} days</b>
          </div>
        </div>
        <div className={active ? "animate-flame" : ""}>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 backdrop-blur">
            <Flame className="h-9 w-9" fill="currentColor" />
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-full bg-white/15 px-4 py-2 text-center text-xs font-semibold">
        {active ? "🔥 You both crushed today — streak +1!" : "Both partners must complete every habit today."}
      </div>
    </div>
  );
}

/* ---------------------- Partner Status ---------------------- */

function PartnerStatus({
  me, partner, habits, myDone, partnerDone,
}: {
  me: { name: string; initial: string };
  partner: { name: string; initial: string };
  habits: Habit[];
  myDone: Record<string, boolean>;
  partnerDone: Record<string, boolean>;
}) {
  const myCount = habits.filter((h) => myDone[h.id]).length;
  const pCount = habits.filter((h) => partnerDone[h.id]).length;
  const total = habits.length;

  return (
    <div className="mx-6 mt-4 grid grid-cols-2 gap-3">
      <StatusChip
        color="primary"
        initial={me.initial}
        name={me.name}
        count={myCount}
        total={total}
      />
      <StatusChip
        color="secondary"
        initial={partner.initial}
        name={partner.name}
        count={pCount}
        total={total}
      />
    </div>
  );
}

function StatusChip({ color, initial, name, count, total }: { color: "primary" | "secondary"; initial: string; name: string; count: number; total: number }) {
  const done = count === total && total > 0;
  const colorBg = color === "primary" ? "bg-primary" : "bg-secondary";
  const colorText = color === "primary" ? "text-primary-foreground" : "text-secondary-foreground";
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${colorBg} ${colorText} font-bold`}>{initial}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className={`text-xs font-semibold ${done ? "text-success" : "text-muted-foreground"}`}>
            {done ? "Done today ✓" : `${count}/${total} done`}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Habit list ---------------------- */

function HabitList({
  habits, myDone, partnerDone, partner, onToggle, onRemove, onAdd,
}: {
  habits: Habit[];
  myDone: Record<string, boolean>;
  partnerDone: Record<string, boolean>;
  partner: { name: string };
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (h: Habit) => void;
}) {
  const [adding, setAdding] = useState(false);
  const canAdd = habits.length < 3;

  return (
    <div className="mt-6 px-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Today's habits</h2>
        <span className="text-xs font-semibold text-muted-foreground">{habits.length}/3</span>
      </div>

      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {habits.map((h) => (
            <motion.div
              key={h.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 40 }}
            >
              <HabitCard
                habit={h}
                mine={!!myDone[h.id]}
                theirs={!!partnerDone[h.id]}
                partnerName={partner.name}
                onToggle={() => onToggle(h.id)}
                onRemove={() => onRemove(h.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {canAdd && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-transparent py-4 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Add a habit
          </button>
        )}
        {adding && (
          <AddHabit
            onCancel={() => setAdding(false)}
            onCreate={(h) => {
              onAdd(h);
              setAdding(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function HabitCard({
  habit, mine, theirs, partnerName, onToggle, onRemove,
}: {
  habit: Habit;
  mine: boolean;
  theirs: boolean;
  partnerName: string;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const Icon = ICONS[habit.icon] ?? Check;
  const [burst, setBurst] = useState(false);

  const handleToggle = () => {
    if (!mine) {
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
    }
    onToggle();
  };

  const both = mine && theirs;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] transition ${both ? "ring-2 ring-success/40" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${both ? "bg-success-soft text-success" : "bg-primary-soft text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[15px] font-bold ${mine ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {habit.title}
          </div>
          <div className="mt-0.5 text-xs font-semibold">
            {theirs ? (
              <span className="text-success">{partnerName} finished ✓</span>
            ) : (
              <span className="text-secondary">Waiting on {partnerName}…</span>
            )}
          </div>
        </div>

        <button
          onClick={onRemove}
          aria-label="Remove habit"
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <button
          onClick={handleToggle}
          aria-pressed={mine}
          className={`relative grid h-12 w-12 place-items-center rounded-full transition active:scale-90 ${
            mine ? "bg-success text-success-foreground shadow-[var(--shadow-success)]" : "bg-muted text-muted-foreground"
          }`}
        >
          <motion.span
            key={mine ? "done" : "todo"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Check className="h-6 w-6" strokeWidth={3} />
          </motion.span>
          {burst && (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className="animate-burst pointer-events-none absolute h-2 w-2 rounded-full bg-primary"
                  style={{ transform: `rotate(${i * 60}deg) translateY(-24px)` }}
                />
              ))}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function AddHabit({ onCancel, onCreate }: { onCancel: () => void; onCreate: (h: Habit) => void }) {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<IconKey>("check");
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 40))}
        placeholder="e.g. Meditate 10 min"
        className="w-full rounded-xl bg-muted px-4 py-3 text-[15px] font-semibold outline-none ring-primary/40 transition focus:ring-4"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {ICON_ORDER.map((k) => {
          const I = ICONS[k];
          const active = k === icon;
          return (
            <button
              key={k}
              onClick={() => setIcon(k)}
              className={`grid h-10 w-10 place-items-center rounded-xl transition ${active ? "bg-primary text-primary-foreground shadow-[var(--shadow-primary)]" : "bg-muted text-muted-foreground"}`}
            >
              <I className="h-5 w-5" />
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground">
          Cancel
        </button>
        <button
          disabled={!title.trim()}
          onClick={() => onCreate({ id: crypto.randomUUID(), title: title.trim(), icon })}
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/* ---------------------- Nudge bar (bottom, thumb zone) ---------------------- */

function NudgeBar({
  partner, partnerPending, sent, onSend,
}: {
  partner: { name: string };
  partnerPending: boolean;
  sent: boolean;
  onSend: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10">
      <div className="mx-auto max-w-[440px] px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button
          onClick={onSend}
          disabled={!partnerPending || sent}
          className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-bold shadow-[var(--shadow-primary)] transition active:scale-[0.98] ${
            !partnerPending
              ? "bg-success text-success-foreground"
              : sent
                ? "bg-secondary text-secondary-foreground"
                : "bg-primary text-primary-foreground"
          }`}
        >
          <Bell className="h-4 w-4" />
          {!partnerPending
            ? `${partner.name} is all caught up 🎉`
            : sent
              ? `Nudge sent to ${partner.name}!`
              : `Send ${partner.name} a nudge`}
        </button>
      </div>
    </div>
  );
}
