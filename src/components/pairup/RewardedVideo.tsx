import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, Sparkles, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

/**
 * Mock rewarded-video placement. Plays a 5s "ad", then fires onReward().
 * Swap the inner player for a real ad SDK later — the surrounding flow stays.
 *
 * Intended real backend: Yodo1 MAS rewarded video, once this app is wrapped
 * in Capacitor for iOS/Android. There is no official (or verified working
 * unofficial) Capacitor/Cordova plugin for Yodo1 as of this writing — it only
 * has first-party support for Unity, native iOS/Android, Flutter and React
 * Native. Wiring this up for real means writing a small custom Capacitor
 * plugin (Swift + Kotlin) against Yodo1's native SDK, which needs Xcode /
 * Android Studio installed locally to pull the SDK and verify the calls
 * against its real headers rather than guessing from docs alone. Do that
 * once the toolchain is available — see AGENTS.md / capacitor.config.ts for
 * the rest of the native-wrap setup already in place.
 */
export function RewardedVideoDialog({
  open, onOpenChange, title, description, rewardLabel, onReward,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  rewardLabel: string;
  onReward: () => Promise<void> | void;
}) {
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [left, setLeft] = useState(5);

  useEffect(() => {
    if (!open) { setPhase("idle"); setLeft(5); }
  }, [open]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (left <= 0) { setPhase("done"); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, left]);

  const claim = async () => {
    await onReward();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative mt-2 grid aspect-video place-items-center overflow-hidden rounded-2xl bg-foreground/90 text-background">
          {phase === "idle" && (
            <button
              onClick={() => setPhase("playing")}
              className="flex flex-col items-center gap-2 text-background/90 transition active:scale-95"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
                <Play className="h-6 w-6" fill="currentColor" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">Watch short video</span>
            </button>
          )}
          {phase === "playing" && (
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                className="h-10 w-10 rounded-full border-4 border-background/25 border-t-primary"
              />
              <div className="text-sm font-semibold">Your reward unlocks in {left}s</div>
            </div>
          )}
          {phase === "done" && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
              <div className="text-4xl">🎁</div>
              <div className="mt-2 text-sm font-bold">Reward ready!</div>
            </motion.div>
          )}
          <span className="absolute right-3 top-3 rounded-full bg-background/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Ad
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            disabled={phase !== "done"}
            onClick={claim}
            className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {rewardLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
