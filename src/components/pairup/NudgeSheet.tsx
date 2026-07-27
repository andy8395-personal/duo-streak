import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, Send } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Habit, Nudge, NUDGE_PRESETS, relTime } from "./types";

export function NudgeSheet({
  open, onOpenChange, partnerName, habits, defaultHabitId, recent, userId, onSend,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerName: string;
  habits: Habit[];
  defaultHabitId: string | null;
  recent: Nudge[];
  userId: string;
  onSend: (message: string, habitId: string | null) => Promise<void>;
}) {
  const [habitId, setHabitId] = useState<string | null>(defaultHabitId);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (message: string) => {
    setBusy(true);
    await onSend(message, habitId);
    setBusy(false);
    setCustom("");
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setHabitId(defaultHabitId); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[86dvh] max-w-[440px] overflow-y-auto rounded-t-[32px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Send a nudge to {partnerName}</SheetTitle>
          <SheetDescription>Tap a button to give your partner a playful reminder. One nudge per habit per hour.</SheetDescription>
        </SheetHeader>

        {habits.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setHabitId(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${habitId === null ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
              General
            </button>
            {habits.map((h) => (
              <button key={h.id} onClick={() => setHabitId(h.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${habitId === h.id ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                {h.title}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {NUDGE_PRESETS.map((p, i) => (
            <motion.button key={p.label} whileTap={{ scale: 0.95 }} disabled={busy} onClick={() => send(p.message)}
              className={`flex flex-col items-center gap-2 rounded-3xl p-5 transition disabled:opacity-60 ${
                [ "bg-secondary-soft text-secondary", "bg-success-soft text-success", "bg-primary-soft text-primary", "bg-muted text-foreground" ][i % 4]
              }`}>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-surface text-2xl shadow-[var(--shadow-card)]">{p.emoji}</span>
              <span className="text-sm font-bold">{p.label}</span>
            </motion.button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 100))} placeholder="Write your own…"
            className="min-w-0 flex-1 rounded-full bg-muted px-4 py-3 text-sm outline-none ring-primary/40 focus:ring-4" />
          <button disabled={!custom.trim() || busy} onClick={() => send(custom.trim())}
            className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-primary)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 pb-6">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent nudges</h4>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nudges yet — be the first.</p>
          ) : (
            <div className="space-y-2">
              {recent.slice(0, 8).map((n) => (
                <div key={n.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {n.sender_id === userId ? "You sent" : `${partnerName} sent`}: {n.message}
                    </div>
                    <div className="text-xs text-muted-foreground">{relTime(n.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
