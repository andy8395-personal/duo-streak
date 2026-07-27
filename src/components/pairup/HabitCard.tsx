import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Pencil, Trash2, Bell, MessageCircle } from "lucide-react";
import {
  Habit, HabitLog, IconKey, ICONS, ICON_ORDER, Reaction, TIME_OF_DAY, TimeOfDay,
  REACTION_EMOJIS, haptic, timeLabel,
} from "./types";

export function HabitCard({
  habit, myLog, theirLog, partnerName, reactions, onToggle, onEdit, onDelete, onReact, onNudge,
}: {
  habit: Habit;
  myLog?: HabitLog;
  theirLog?: HabitLog;
  partnerName: string;
  reactions: Reaction[];
  onToggle: () => void;
  onEdit: (patch: { title: string; icon: IconKey; time_of_day: TimeOfDay }) => void;
  onDelete: () => void;
  onReact: (log: HabitLog, emoji: string, comment?: string) => void;
  onNudge: () => void;
}) {
  const Icon = ICONS[habit.icon as IconKey] ?? Check;
  const [burst, setBurst] = useState(false);
  const [editing, setEditing] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");

  const mine = !!myLog;
  const theirs = !!theirLog;
  const both = mine && theirs;
  const tod = TIME_OF_DAY.find((t) => t.key === habit.time_of_day) ?? TIME_OF_DAY[3];

  const handleToggle = () => {
    if (!mine) { setBurst(true); haptic(18); setTimeout(() => setBurst(false), 700); } else haptic(8);
    onToggle();
  };

  if (editing) {
    return (
      <HabitForm
        initial={{ title: habit.title, icon: (habit.icon as IconKey) ?? "check", time_of_day: (habit.time_of_day as TimeOfDay) ?? "anytime" }}
        submitLabel="Save"
        onCancel={() => setEditing(false)}
        onSubmit={(v) => { onEdit(v); setEditing(false); }}
      />
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-surface p-4 shadow-[var(--shadow-card)] transition ${both ? "ring-2 ring-success/40" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${both ? "bg-success-soft text-success" : mine ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className={`truncate text-[15px] font-bold ${mine ? "text-muted-foreground line-through" : "text-foreground"}`}>{habit.title}</div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {tod.emoji} {tod.label}
            </span>
          </div>
          <div className="mt-0.5 text-xs font-semibold">
            {theirLog ? (
              <span className="text-success">{partnerName} finished at {timeLabel(theirLog.created_at)}</span>
            ) : (
              <span className="text-secondary">Waiting on {partnerName}…</span>
            )}
          </div>
        </div>

        <button onClick={handleToggle} aria-pressed={mine}
          className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full transition active:scale-90 ${mine ? "bg-success text-success-foreground shadow-[var(--shadow-success)]" : "bg-muted text-muted-foreground"}`}>
          <motion.span key={mine ? "done" : "todo"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Check className="h-6 w-6" strokeWidth={3} />
          </motion.span>
          {burst && Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="animate-burst pointer-events-none absolute h-2 w-2 rounded-full bg-primary"
              style={{ transform: `rotate(${i * 45}deg) translateY(-26px)` }} />
          ))}
        </button>
      </div>

      {/* action row */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {theirLog ? (
          <>
            {REACTION_EMOJIS.map((e) => {
              const count = reactions.filter((r) => r.emoji === e).length;
              return (
                <button key={e} onClick={() => { haptic(); onReact(theirLog, e); }}
                  className={`rounded-full px-2.5 py-1 text-sm transition active:scale-90 ${count ? "bg-primary-soft" : "bg-muted"}`}>
                  {e}{count > 0 && <span className="ml-1 text-[11px] font-bold text-primary">{count}</span>}
                </button>
              );
            })}
            <button onClick={() => setCommenting((c) => !c)} className="grid h-7 w-7 place-items-center rounded-full bg-muted text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button onClick={onNudge} className="inline-flex items-center gap-1.5 rounded-full bg-secondary-soft px-3 py-1 text-[11px] font-bold text-secondary transition active:scale-95">
            <Bell className="h-3 w-3" /> Nudge about this
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => setEditing(true)} aria-label="Edit habit" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} aria-label="Delete habit" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {commenting && theirLog && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-2 flex gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value.slice(0, 80))} placeholder={`Say something to ${partnerName}…`}
                className="min-w-0 flex-1 rounded-full bg-muted px-4 py-2 text-sm outline-none ring-primary/40 focus:ring-4" />
              <button disabled={!comment.trim()}
                onClick={() => { onReact(theirLog, "💬", comment.trim()); setComment(""); setCommenting(false); }}
                className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {reactions.some((r) => r.comment) && (
        <div className="mt-2 space-y-1">
          {reactions.filter((r) => r.comment).map((r) => (
            <div key={r.id} className="rounded-2xl bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">💬 {r.comment}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HabitForm({
  initial, submitLabel, onCancel, onSubmit,
}: {
  initial?: { title: string; icon: IconKey; time_of_day: TimeOfDay };
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: { title: string; icon: IconKey; time_of_day: TimeOfDay }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [icon, setIcon] = useState<IconKey>(initial?.icon ?? "check");
  const [tod, setTod] = useState<TimeOfDay>(initial?.time_of_day ?? "anytime");

  return (
    <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value.slice(0, 40))} placeholder="e.g. Meditate 10 min"
        className="w-full rounded-2xl bg-muted px-4 py-3 text-[15px] font-semibold outline-none ring-primary/40 focus:ring-4" />

      <div className="mt-3 flex flex-wrap gap-2">
        {ICON_ORDER.map((k) => {
          const I = ICONS[k]; const active = k === icon;
          return (
            <button key={k} onClick={() => setIcon(k)}
              className={`grid h-10 w-10 place-items-center rounded-xl transition ${active ? "bg-primary text-primary-foreground shadow-[var(--shadow-primary)]" : "bg-muted text-muted-foreground"}`}>
              <I className="h-5 w-5" />
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {TIME_OF_DAY.map((t) => (
          <button key={t.key} onClick={() => setTod(t.key)}
            className={`rounded-xl px-2 py-2 text-[11px] font-bold transition ${tod === t.key ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
            <span className="block text-base leading-none">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground">Cancel</button>
        <button disabled={!title.trim()} onClick={() => onSubmit({ title: title.trim(), icon, time_of_day: tod })}
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export function HabitSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded-full bg-muted" />
          <div className="h-3 w-1/3 rounded-full bg-muted" />
        </div>
        <div className="h-12 w-12 rounded-full bg-muted" />
      </div>
    </div>
  );
}
