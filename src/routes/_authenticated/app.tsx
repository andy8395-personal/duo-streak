import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, Check, Copy, Share2, Plus, Trash2, Bell, Dumbbell, BookOpen,
  Droplet, Moon, Brain, Heart, Sun, Users, LogOut, ChevronDown, UserPlus,
  Settings as SettingsIcon, X,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/pairup-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Your streak — PairUp" },
      { name: "description", content: "Check off today's habits and keep your shared streak alive with your partner." },
      { property: "og:title", content: "Your streak — PairUp" },
      { property: "og:description", content: "Check off today's habits and keep your shared streak alive with your partner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

/* ---------------------- types & icons ---------------------- */

type IconKey = "check" | "run" | "book" | "water" | "sleep" | "brain" | "heart" | "sun";
const ICONS: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  check: Check, run: Dumbbell, book: BookOpen, water: Droplet, sleep: Moon,
  brain: Brain, heart: Heart, sun: Sun,
};
const ICON_ORDER: IconKey[] = ["check", "run", "book", "water", "sleep", "brain", "heart", "sun"];
const EMOJIS = ["🙂", "😎", "🦊", "🐻", "🐼", "🐸", "🚀", "🌸", "⚡️", "🔥", "🌈", "🍀"];
const TIMEZONES = [
  "UTC", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore",
  "Asia/Kolkata", "Australia/Sydney",
];

type Profile = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  timezone: string;
  reminder_time: string | null;
  active_pair_id: string | null;
};
type Pair = {
  id: string;
  invite_code: string;
  user1_id: string;
  user2_id: string | null;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  archived: boolean;
  created_at: string;
};
type Habit = { id: string; pair_id: string; title: string; icon: string; position: number };
type HabitLog = { id: string; habit_id: string; user_id: string; log_date: string };

const today = () => new Date().toISOString().slice(0, 10);

/* ---------------------- root ---------------------- */

function Dashboard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);

  // Load session + profile
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setUserId(userData.user.id);
      const { data: p } = await supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
      if (p) setProfile(p as Profile);
    })();
  }, []);

  // Load pairs when user known
  const loadPairs = async (uid: string) => {
    const { data } = await supabase
      .from("pairs")
      .select("*")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .eq("archived", false)
      .order("created_at", { ascending: true });
    setPairs((data as Pair[] | null) ?? []);
  };
  useEffect(() => { if (userId) loadPairs(userId); }, [userId]);

  // Load partner profiles + habits + today logs for active pair
  const activePair = useMemo(
    () => pairs.find((p) => p.id === profile?.active_pair_id) ?? pairs[0] ?? null,
    [pairs, profile?.active_pair_id],
  );

  useEffect(() => {
    if (!activePair) { setHabits([]); setLogs([]); return; }
    setLoading(true);
    (async () => {
      const [habitsRes, logsRes] = await Promise.all([
        supabase.from("habits").select("*").eq("pair_id", activePair.id).order("position"),
        supabase.from("habit_logs").select("*").eq("log_date", today()),
      ]);
      setHabits((habitsRes.data as Habit[] | null) ?? []);
      setLogs((logsRes.data as HabitLog[] | null) ?? []);
      // Load partner profile
      const otherId = activePair.user1_id === userId ? activePair.user2_id : activePair.user1_id;
      if (otherId && !profiles[otherId]) {
        const { data } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
        if (data) setProfiles((prev) => ({ ...prev, [otherId]: data as Profile }));
      }
      setLoading(false);
    })();
  }, [activePair?.id, userId]);

  // Realtime for active pair
  useEffect(() => {
    if (!activePair) return;
    const channel = supabase
      .channel(`pair:${activePair.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "habits", filter: `pair_id=eq.${activePair.id}` }, () => {
        supabase.from("habits").select("*").eq("pair_id", activePair.id).order("position").then(({ data }) => setHabits((data as Habit[] | null) ?? []));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "habit_logs" }, () => {
        supabase.from("habit_logs").select("*").eq("log_date", today()).then(({ data }) => setLogs((data as HabitLog[] | null) ?? []));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pairs", filter: `id=eq.${activePair.id}` }, (payload) => {
        setPairs((prev) => prev.map((p) => (p.id === activePair.id ? { ...p, ...(payload.new as Pair) } : p)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activePair?.id]);

  const partnerId = activePair ? (activePair.user1_id === userId ? activePair.user2_id : activePair.user1_id) : null;
  const partner = partnerId ? profiles[partnerId] : null;

  const myLogs = new Set(logs.filter((l) => l.user_id === userId).map((l) => l.habit_id));
  const partnerLogs = new Set(logs.filter((l) => l.user_id === partnerId).map((l) => l.habit_id));

  const bothCompleteAll = habits.length > 0 && habits.every((h) => myLogs.has(h.id) && partnerLogs.has(h.id));

  /* actions */
  const toggleHabit = async (habit: Habit) => {
    if (!userId) return;
    const done = myLogs.has(habit.id);
    if (done) {
      await supabase.from("habit_logs").delete().eq("habit_id", habit.id).eq("user_id", userId).eq("log_date", today());
    } else {
      await supabase.from("habit_logs").insert({ habit_id: habit.id, user_id: userId, log_date: today() });
    }
    // optimistic refresh
    const { data } = await supabase.from("habit_logs").select("*").eq("log_date", today());
    setLogs((data as HabitLog[] | null) ?? []);
  };

  const addHabit = async (title: string, icon: IconKey) => {
    if (!activePair) return;
    if (habits.length >= 3) { toast.error("Max 3 habits per pair"); return; }
    const { error } = await supabase.from("habits").insert({
      pair_id: activePair.id, title, icon, position: habits.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Habit added");
  };

  const [confirmDeleteHabit, setConfirmDeleteHabit] = useState<Habit | null>(null);
  const deleteHabit = async () => {
    if (!confirmDeleteHabit) return;
    await supabase.from("habits").delete().eq("id", confirmDeleteHabit.id);
    setConfirmDeleteHabit(null);
    toast.success("Habit removed");
  };

  const copyInvite = async () => {
    if (!activePair) return;
    try {
      await navigator.clipboard.writeText(activePair.invite_code);
      toast.success("Invite code copied!");
    } catch {}
  };

  const switchPair = async (pairId: string) => {
    await supabase.rpc("switch_active_pair", { _pair_id: pairId });
    if (userId) {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (data) setProfile(data as Profile);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!userId || !profile) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col">
        {!activePair ? (
          <Onboarding
            onCreated={async () => { if (userId) await loadPairs(userId); const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle(); if (data) setProfile(data as Profile); }}
            onSettings={() => setSettingsOpen(true)}
            profile={profile}
          />
        ) : (
          <motion.div key={activePair.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col pb-28">
            <Header
              profile={profile}
              partner={partner}
              pairs={pairs}
              profiles={profiles}
              activePair={activePair}
              onSwitch={switchPair}
              onCopy={copyInvite}
              onSettings={() => setSettingsOpen(true)}
              userId={userId}
            />
            <StreakBanner streak={activePair.current_streak} longest={activePair.longest_streak} active={bothCompleteAll} />
            <PartnerStatus profile={profile} partner={partner} habits={habits} myLogs={myLogs} partnerLogs={partnerLogs} />
            {!partner && <PendingPartner code={activePair.invite_code} onCopy={copyInvite} />}
            <HabitList
              habits={habits}
              myLogs={myLogs}
              partnerLogs={partnerLogs}
              partnerName={partner?.display_name ?? "your partner"}
              onToggle={toggleHabit}
              onRequestDelete={setConfirmDeleteHabit}
              onAdd={addHabit}
              loading={loading}
            />
            {partner && (
              <NudgeBar
                partnerName={partner.display_name}
                partnerPending={habits.some((h) => !partnerLogs.has(h.id))}
                sent={nudgeSent}
                onSend={() => { setNudgeSent(true); toast.success(`Nudge sent to ${partner.display_name}!`); setTimeout(() => setNudgeSent(false), 2500); }}
              />
            )}
          </motion.div>
        )}
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        profile={profile}
        pairs={pairs}
        profiles={profiles}
        activePairId={activePair?.id ?? null}
        userId={userId}
        onProfileChanged={(p) => setProfile(p)}
        onSwitch={switchPair}
        onSignOut={signOut}
        onPairsChanged={async () => { if (userId) await loadPairs(userId); }}
        onAddPartner={async () => { if (userId) await loadPairs(userId); const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle(); if (data) setProfile(data as Profile); }}
      />

      <AlertDialog open={!!confirmDeleteHabit} onOpenChange={(o) => !o && setConfirmDeleteHabit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this habit?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDeleteHabit?.title}" and all its completion history will be deleted for both partners.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteHabit} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------------- onboarding (no pair yet) ---------------------- */

function Onboarding({
  onCreated, onSettings, profile,
}: {
  onCreated: () => Promise<void>;
  onSettings: () => void;
  profile: Profile;
}) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const createPair = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_pair");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    // fetch code
    const { data: p } = await supabase.from("pairs").select("invite_code").eq("id", data as string).single();
    setCreatedCode(p?.invite_code ?? null);
    await onCreated();
  };
  const joinPair = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("join_pair", { _code: joinCode.toUpperCase() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Joined!");
    await onCreated();
  };
  const copy = async () => {
    if (!createdCode) return;
    try { await navigator.clipboard.writeText(createdCode); toast.success("Invite code copied!"); } catch {}
  };

  return (
    <div className="flex flex-1 flex-col px-6 pb-10 pt-8">
      <div className="flex items-center justify-between">
        <img src={logo.url} alt="PairUp" className="h-8 w-auto" />
        <button onClick={onSettings} className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]">
          <div className="text-lg">{profile.avatar_emoji}</div>
        </button>
      </div>
      <div className="mt-10 text-center">
        <h1 className="text-balance text-[30px] font-bold leading-tight tracking-tight">
          Hi {profile.display_name}! <span className="block text-primary">Let's find your pair.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-[300px] text-[15px] text-muted-foreground">
          Create a code and share it, or enter one from your partner.
        </p>
      </div>

      <div className="mt-8 flex-1">
        {mode === "choose" && (
          <div className="flex flex-col gap-3">
            <button onClick={() => setMode("create")} className="group flex items-center justify-between rounded-3xl bg-primary px-6 py-5 text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-[0.98]">
              <div className="text-left">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Mode A</div>
                <div className="text-lg font-bold">Create a Pair</div>
              </div>
              <UserPlus className="h-5 w-5" />
            </button>
            <button onClick={() => setMode("join")} className="group flex items-center justify-between rounded-3xl border-2 border-secondary/20 bg-secondary-soft px-6 py-5 text-secondary transition active:scale-[0.98]">
              <div className="text-left">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Mode B</div>
                <div className="text-lg font-bold">Enter Invite Code</div>
              </div>
              <Users className="h-5 w-5" />
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="flex flex-col gap-4">
            {!createdCode ? (
              <button onClick={createPair} disabled={busy} className="rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] disabled:opacity-60">
                {busy ? "…" : "Generate invite code"}
              </button>
            ) : (
              <>
                <div className="rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow-card)]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your invite code</div>
                  <div className="mt-3 flex items-center justify-center gap-1 font-mono text-[38px] font-bold tracking-[0.2em] text-primary">
                    {createdCode.split("").map((c, i) => (
                      <span key={i} className="rounded-xl bg-primary-soft px-2.5 py-1">{c}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-center gap-2">
                    <button onClick={copy} className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold"><Copy className="h-4 w-4" /> Copy</button>
                    <button onClick={() => navigator.share?.({ title: "Join me on PairUp", text: `My PairUp invite: ${createdCode}` }).catch(() => {})} className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold"><Share2 className="h-4 w-4" /> Share</button>
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">Share this with your partner. When they join, your streak begins.</p>
              </>
            )}
            <button onClick={() => setMode("choose")} className="text-sm text-muted-foreground underline">Back</button>
          </div>
        )}

        {mode === "join" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-surface p-6 shadow-[var(--shadow-card)]">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enter 6-character invite code</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="ABC123"
                className="mt-3 w-full rounded-2xl bg-muted px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.35em] outline-none ring-primary/40 focus:ring-4"
              />
            </div>
            <button disabled={joinCode.length !== 6 || busy} onClick={joinPair} className="rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">
              {busy ? "…" : "Join pair"}
            </button>
            <button onClick={() => setMode("choose")} className="text-sm text-muted-foreground underline">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- header ---------------------- */

function Header({
  profile, partner, pairs, profiles, activePair, onSwitch, onCopy, onSettings, userId,
}: {
  profile: Profile;
  partner: Profile | null;
  pairs: Pair[];
  profiles: Record<string, Profile>;
  activePair: Pair;
  onSwitch: (id: string) => void;
  onCopy: () => void;
  onSettings: () => void;
  userId: string;
}) {
  const partnerName = (pair: Pair): string => {
    const otherId = pair.user1_id === userId ? pair.user2_id : pair.user1_id;
    if (!otherId) return "Pending";
    return profiles[otherId]?.display_name ?? "Partner";
  };

  return (
    <div className="flex items-center justify-between gap-2 px-6 pt-8">
      <img src={logo.url} alt="PairUp" className="h-8 w-auto" />
      <div className="flex items-center gap-2">
        {pairs.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full bg-secondary-soft px-3 py-1.5 text-xs font-bold text-secondary">
              <Users className="h-3.5 w-3.5" /> {partner?.display_name ?? "Pending"} <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Switch partner</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {pairs.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => onSwitch(p.id)} className={p.id === activePair.id ? "font-bold" : ""}>
                  <Users className="mr-2 h-4 w-4" /> {partnerName(p)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSettings}><UserPlus className="mr-2 h-4 w-4" /> Add new partner</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button onClick={onCopy} className="rounded-full bg-muted px-3 py-1.5 font-mono text-xs font-bold tracking-widest text-muted-foreground transition active:scale-95">
            {activePair.invite_code}
          </button>
        )}
        <button onClick={onSettings} aria-label="Settings" className="grid h-9 w-9 place-items-center rounded-full bg-primary text-lg text-primary-foreground shadow-[var(--shadow-primary)]">
          {profile.avatar_emoji}
        </button>
      </div>
    </div>
  );
}

function PendingPartner({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <div className="mx-6 mt-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary-soft p-4 text-center">
      <div className="text-xs font-bold uppercase tracking-wider text-primary">Waiting for your partner</div>
      <div className="mt-1 text-sm text-foreground">Share your invite code to start the streak</div>
      <button onClick={onCopy} className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
        <Copy className="h-3.5 w-3.5" /> {code}
      </button>
    </div>
  );
}

/* ---------------------- streak banner ---------------------- */

function StreakBanner({ streak, longest, active }: { streak: number; longest: number; active: boolean }) {
  return (
    <div className="mx-6 mt-6 overflow-hidden rounded-[32px] bg-gradient-to-br from-primary to-[#ff8a5b] p-6 text-primary-foreground shadow-[var(--shadow-primary)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Shared streak</div>
          <div className="mt-2 flex items-end gap-2">
            <motion.div key={streak} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[64px] font-bold leading-none tracking-tight">
              {streak}
            </motion.div>
            <div className="pb-2 text-lg font-semibold opacity-90">days</div>
          </div>
          <div className="mt-1 text-sm font-medium opacity-90">Longest: <b>{longest} days</b></div>
        </div>
        <div className={active ? "animate-flame" : ""}>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 backdrop-blur">
            <Flame className="h-9 w-9" fill="currentColor" />
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-full bg-white/15 px-4 py-2 text-center text-xs font-semibold">
        {active ? "🔥 You both crushed today — streak locked in!" : "Both partners must complete every habit today."}
      </div>
    </div>
  );
}

/* ---------------------- partner status ---------------------- */

function PartnerStatus({
  profile, partner, habits, myLogs, partnerLogs,
}: {
  profile: Profile;
  partner: Profile | null;
  habits: Habit[];
  myLogs: Set<string>;
  partnerLogs: Set<string>;
}) {
  return (
    <div className="mx-6 mt-4 grid grid-cols-2 gap-3">
      <StatusChip color="primary" emoji={profile.avatar_emoji} name={profile.display_name} count={habits.filter((h) => myLogs.has(h.id)).length} total={habits.length} />
      <StatusChip color="secondary" emoji={partner?.avatar_emoji ?? "…"} name={partner?.display_name ?? "Waiting"} count={habits.filter((h) => partnerLogs.has(h.id)).length} total={habits.length} />
    </div>
  );
}
function StatusChip({ color, emoji, name, count, total }: { color: "primary" | "secondary"; emoji: string; name: string; count: number; total: number }) {
  const done = count === total && total > 0;
  const colorBg = color === "primary" ? "bg-primary" : "bg-secondary";
  const colorText = color === "primary" ? "text-primary-foreground" : "text-secondary-foreground";
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${colorBg} ${colorText} text-lg font-bold`}>{emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className={`text-xs font-semibold ${done ? "text-success" : "text-muted-foreground"}`}>{done ? "Done today ✓" : `${count}/${total} done`}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- habit list ---------------------- */

function HabitList({
  habits, myLogs, partnerLogs, partnerName, onToggle, onRequestDelete, onAdd, loading,
}: {
  habits: Habit[];
  myLogs: Set<string>;
  partnerLogs: Set<string>;
  partnerName: string;
  onToggle: (h: Habit) => void;
  onRequestDelete: (h: Habit) => void;
  onAdd: (title: string, icon: IconKey) => void;
  loading: boolean;
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
        {loading && habits.length === 0 && <div className="rounded-2xl bg-surface p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        <AnimatePresence initial={false}>
          {habits.map((h) => (
            <motion.div key={h.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
              <HabitCard habit={h} mine={myLogs.has(h.id)} theirs={partnerLogs.has(h.id)} partnerName={partnerName} onToggle={() => onToggle(h)} onRemove={() => onRequestDelete(h)} />
            </motion.div>
          ))}
        </AnimatePresence>
        {canAdd && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-transparent py-4 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary">
            <Plus className="h-4 w-4" /> Add a habit
          </button>
        )}
        {adding && <AddHabit onCancel={() => setAdding(false)} onCreate={(t, i) => { onAdd(t, i); setAdding(false); }} />}
      </div>
    </div>
  );
}

function HabitCard({ habit, mine, theirs, partnerName, onToggle, onRemove }: {
  habit: Habit; mine: boolean; theirs: boolean; partnerName: string; onToggle: () => void; onRemove: () => void;
}) {
  const Icon = ICONS[habit.icon as IconKey] ?? Check;
  const [burst, setBurst] = useState(false);
  const handleToggle = () => {
    if (!mine) { setBurst(true); setTimeout(() => setBurst(false), 700); }
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
          <div className={`truncate text-[15px] font-bold ${mine ? "text-muted-foreground line-through" : "text-foreground"}`}>{habit.title}</div>
          <div className="mt-0.5 text-xs font-semibold">
            {theirs ? <span className="text-success">{partnerName} finished ✓</span> : <span className="text-secondary">Waiting on {partnerName}…</span>}
          </div>
        </div>
        <button onClick={onRemove} aria-label="Remove habit" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
        <button onClick={handleToggle} aria-pressed={mine} className={`relative grid h-12 w-12 place-items-center rounded-full transition active:scale-90 ${mine ? "bg-success text-success-foreground shadow-[var(--shadow-success)]" : "bg-muted text-muted-foreground"}`}>
          <motion.span key={mine ? "done" : "todo"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Check className="h-6 w-6" strokeWidth={3} />
          </motion.span>
          {burst && Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="animate-burst pointer-events-none absolute h-2 w-2 rounded-full bg-primary" style={{ transform: `rotate(${i * 60}deg) translateY(-24px)` }} />
          ))}
        </button>
      </div>
    </div>
  );
}

function AddHabit({ onCancel, onCreate }: { onCancel: () => void; onCreate: (title: string, icon: IconKey) => void }) {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<IconKey>("check");
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value.slice(0, 40))} placeholder="e.g. Meditate 10 min"
        className="w-full rounded-xl bg-muted px-4 py-3 text-[15px] font-semibold outline-none ring-primary/40 focus:ring-4" />
      <div className="mt-3 flex flex-wrap gap-2">
        {ICON_ORDER.map((k) => {
          const I = ICONS[k]; const active = k === icon;
          return (
            <button key={k} onClick={() => setIcon(k)} className={`grid h-10 w-10 place-items-center rounded-xl transition ${active ? "bg-primary text-primary-foreground shadow-[var(--shadow-primary)]" : "bg-muted text-muted-foreground"}`}>
              <I className="h-5 w-5" />
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground">Cancel</button>
        <button disabled={!title.trim()} onClick={() => onCreate(title.trim(), icon)}
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">
          Add
        </button>
      </div>
    </div>
  );
}

/* ---------------------- nudge bar ---------------------- */

function NudgeBar({ partnerName, partnerPending, sent, onSend }: { partnerName: string; partnerPending: boolean; sent: boolean; onSend: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10">
      <div className="mx-auto max-w-[440px] px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button onClick={onSend} disabled={!partnerPending || sent}
          className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-bold shadow-[var(--shadow-primary)] transition active:scale-[0.98] ${
            !partnerPending ? "bg-success text-success-foreground" : sent ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
          }`}>
          <Bell className="h-4 w-4" />
          {!partnerPending ? `${partnerName} is all caught up 🎉` : sent ? `Nudge sent to ${partnerName}!` : `Send ${partnerName} a nudge`}
        </button>
      </div>
    </div>
  );
}

/* ---------------------- settings drawer ---------------------- */

function SettingsDrawer({
  open, onOpenChange, profile, pairs, profiles, activePairId, userId,
  onProfileChanged, onSwitch, onSignOut, onPairsChanged, onAddPartner,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: Profile;
  pairs: Pair[];
  profiles: Record<string, Profile>;
  activePairId: string | null;
  userId: string;
  onProfileChanged: (p: Profile) => void;
  onSwitch: (id: string) => void;
  onSignOut: () => void;
  onPairsChanged: () => Promise<void>;
  onAddPartner: () => Promise<void>;
}) {
  const [name, setName] = useState(profile.display_name);
  const [emoji, setEmoji] = useState(profile.avatar_emoji);
  const [tz, setTz] = useState(profile.timezone);
  const [reminder, setReminder] = useState(profile.reminder_time ?? "");
  const [confirmUnpair, setConfirmUnpair] = useState<Pair | null>(null);
  const [addPartnerMode, setAddPartnerMode] = useState<null | "create" | "join">(null);
  const [joinCode, setJoinCode] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(profile.display_name); setEmoji(profile.avatar_emoji);
      setTz(profile.timezone); setReminder(profile.reminder_time ?? "");
      setAddPartnerMode(null); setNewCode(null); setJoinCode("");
    }
  }, [open, profile]);

  const saveProfile = async () => {
    const { data, error } = await supabase.from("profiles").update({
      display_name: name, avatar_emoji: emoji, timezone: tz, reminder_time: reminder || null,
    }).eq("id", userId).select().single();
    if (error) { toast.error(error.message); return; }
    onProfileChanged(data as Profile);
    toast.success("Profile updated");
  };

  const unpair = async () => {
    if (!confirmUnpair) return;
    const { error } = await supabase.rpc("archive_pair", { _pair_id: confirmUnpair.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Pair archived");
    setConfirmUnpair(null);
    await onPairsChanged();
  };

  const createNewPair = async () => {
    const { data, error } = await supabase.rpc("create_pair");
    if (error) { toast.error(error.message); return; }
    const { data: p } = await supabase.from("pairs").select("invite_code").eq("id", data as string).single();
    setNewCode(p?.invite_code ?? null);
    await onAddPartner();
  };
  const joinNewPair = async () => {
    const { error } = await supabase.rpc("join_pair", { _code: joinCode.toUpperCase() });
    if (error) { toast.error(error.message); return; }
    toast.success("Joined!");
    setAddPartnerMode(null); setJoinCode("");
    await onAddPartner();
  };

  const partnerNameFor = (pair: Pair) => {
    const otherId = pair.user1_id === userId ? pair.user2_id : pair.user1_id;
    if (!otherId) return "Pending partner";
    return profiles[otherId]?.display_name ?? "Partner";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[440px] overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><SettingsIcon className="h-5 w-5" /> Settings</SheetTitle>
          <SheetDescription>Manage your account and partners</SheetDescription>
        </SheetHeader>

        {/* Profile */}
        <div className="mt-6 space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your profile</div>
            <div className="mt-3 space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">Display name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl bg-muted px-4 py-3 text-sm font-semibold outline-none ring-primary/40 focus:ring-4" />
              </label>
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Avatar</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => setEmoji(e)} className={`grid h-10 w-10 place-items-center rounded-xl text-lg transition ${emoji === e ? "bg-primary text-primary-foreground shadow-[var(--shadow-primary)]" : "bg-muted"}`}>{e}</button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">Timezone</span>
                <select value={tz} onChange={(e) => setTz(e.target.value)} className="mt-1 w-full rounded-xl bg-muted px-4 py-3 text-sm font-semibold outline-none">
                  {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">Daily reminder time (optional)</span>
                <input type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} className="mt-1 w-full rounded-xl bg-muted px-4 py-3 text-sm font-semibold outline-none" />
              </label>
              <button onClick={saveProfile} className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)]">Save profile</button>
            </div>
          </div>

          {/* Partners */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your partners</div>
            <div className="mt-3 space-y-2">
              {pairs.map((p) => {
                const isActive = p.id === activePairId;
                return (
                  <div key={p.id} className={`flex items-center gap-3 rounded-2xl p-3 shadow-[var(--shadow-card)] ${isActive ? "bg-primary-soft" : "bg-surface"}`}>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-lg text-secondary-foreground">
                      {(() => { const o = p.user1_id === userId ? p.user2_id : p.user1_id; return o ? (profiles[o]?.avatar_emoji ?? "🙂") : "⏳"; })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{partnerNameFor(p)}</div>
                      <div className="text-xs text-muted-foreground">🔥 {p.current_streak} day streak · Code {p.invite_code}</div>
                    </div>
                    {!isActive && (
                      <button onClick={() => { onSwitch(p.id); onOpenChange(false); }} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">Switch</button>
                    )}
                    <button onClick={() => setConfirmUnpair(p)} aria-label="Unpair" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              {addPartnerMode === null && (
                <button onClick={() => setAddPartnerMode("create")} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
                  <UserPlus className="h-4 w-4" /> Add / link new partner
                </button>
              )}
              {addPartnerMode !== null && (
                <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
                  <div className="mb-3 flex gap-2">
                    <button onClick={() => { setAddPartnerMode("create"); setNewCode(null); }} className={`flex-1 rounded-full px-3 py-2 text-xs font-bold ${addPartnerMode === "create" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Create code</button>
                    <button onClick={() => setAddPartnerMode("join")} className={`flex-1 rounded-full px-3 py-2 text-xs font-bold ${addPartnerMode === "join" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Enter code</button>
                  </div>
                  {addPartnerMode === "create" ? (
                    !newCode ? (
                      <button onClick={createNewPair} className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)]">Generate code</button>
                    ) : (
                      <div className="text-center">
                        <div className="font-mono text-2xl font-bold tracking-[0.2em] text-primary">{newCode}</div>
                        <button onClick={() => { navigator.clipboard.writeText(newCode); toast.success("Invite code copied!"); }} className="mt-2 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs font-semibold"><Copy className="h-3 w-3" /> Copy</button>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="ABC123"
                        className="w-full rounded-xl bg-muted px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.35em] outline-none ring-primary/40 focus:ring-4" />
                      <button disabled={joinCode.length !== 6} onClick={joinNewPair} className="rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">Join</button>
                    </div>
                  )}
                  <button onClick={() => setAddPartnerMode(null)} className="mt-3 w-full text-center text-xs text-muted-foreground underline">Cancel</button>
                </div>
              )}
            </div>
          </div>

          {/* Sign out */}
          <button onClick={onSignOut} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-destructive px-6 py-4 text-sm font-bold text-destructive-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <AlertDialog open={!!confirmUnpair} onOpenChange={(o) => !o && setConfirmUnpair(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this pair?</AlertDialogTitle>
              <AlertDialogDescription>
                This will archive your shared streak with {confirmUnpair ? partnerNameFor(confirmUnpair) : ""}. You can still create a new pair later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep pair</AlertDialogCancel>
              <AlertDialogAction onClick={unpair} className="bg-destructive text-destructive-foreground">Archive pair</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
