import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Share2, Plus, Bell, Users, UserPlus, ChevronDown, Home, Snowflake,
  PlayCircle, Trophy, Flame, Sparkles, BarChart3, Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/pairup-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { showLocalNotification } from "@/lib/notifications";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Habit, HabitLog, IconKey, Nudge, Pair, Profile, Reaction, TimeOfDay,
  addDays, dateStr, haptic, todayStr,
} from "@/components/pairup/types";
import { HabitCard, HabitForm, HabitSkeleton } from "@/components/pairup/HabitCard";
import { NudgeSheet } from "@/components/pairup/NudgeSheet";
import { SettingsDrawer } from "@/components/pairup/SettingsDrawer";
import { RewardedVideoDialog } from "@/components/pairup/RewardedVideo";
import { DayStat, MonthlyCalendar, WeeklyRibbon } from "@/components/pairup/History";
import { Avatar } from "@/components/pairup/Avatar";
import { AnalyticsView } from "@/components/pairup/Analytics";

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

const HISTORY_DAYS = 62;

function Dashboard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeHabitId, setNudgeHabitId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDeleteHabit, setConfirmDeleteHabit] = useState<Habit | null>(null);
  const [rv, setRv] = useState<null | "habit" | "partner">(null);
  const [celebrated, setCelebrated] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [tab, setTab] = useState<"home" | "stats">("home");

  /* ------------------------- loaders ------------------------- */
  const refreshProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (data) setProfile(data as Profile);
  }, []);

  const loadPairs = useCallback(async (uid: string) => {
    const { data } = await supabase.from("pairs").select("*")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`).eq("archived", false)
      .order("created_at", { ascending: true });
    setPairs((data as Pair[] | null) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setUserId(userData.user.id);
      await refreshProfile(userData.user.id);
    })();
  }, [refreshProfile]);

  useEffect(() => { if (userId) loadPairs(userId); }, [userId, loadPairs]);

  const activePair = useMemo(
    () => pairs.find((p) => p.id === profile?.active_pair_id) ?? pairs[0] ?? null,
    [pairs, profile?.active_pair_id],
  );

  const partnerId = activePair ? (activePair.user1_id === userId ? activePair.user2_id : activePair.user1_id) : null;
  const partner = partnerId ? profiles[partnerId] : null;

  const loadPairData = useCallback(async (pair: Pair, uid: string) => {
    const since = dateStr(addDays(new Date(), -HISTORY_DAYS));
    const { data: habitRows } = await supabase.from("habits").select("*").eq("pair_id", pair.id).order("position");
    const hs = (habitRows as Habit[] | null) ?? [];
    setHabits(hs);

    const ids = hs.map((h) => h.id);
    if (ids.length) {
      const { data: logRows } = await supabase.from("habit_logs").select("*").in("habit_id", ids).gte("log_date", since);
      const ls = (logRows as HabitLog[] | null) ?? [];
      setLogs(ls);
      const todayLogIds = ls.filter((l) => l.log_date === todayStr()).map((l) => l.id);
      if (todayLogIds.length) {
        const { data: rx } = await supabase.from("reactions").select("*").in("habit_log_id", todayLogIds);
        setReactions((rx as Reaction[] | null) ?? []);
      } else setReactions([]);
    } else { setLogs([]); setReactions([]); }

    const { data: nz } = await supabase.from("nudges").select("*").eq("pair_id", pair.id)
      .order("created_at", { ascending: false }).limit(20);
    setNudges((nz as Nudge[] | null) ?? []);

    const otherId = pair.user1_id === uid ? pair.user2_id : pair.user1_id;
    if (otherId) {
      const { data } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
      if (data) setProfiles((prev) => ({ ...prev, [otherId]: data as Profile }));
    }
  }, []);

  useEffect(() => {
    if (!activePair || !userId) { setHabits([]); setLogs([]); setLoading(false); return; }
    setLoading(true);
    loadPairData(activePair, userId).finally(() => setLoading(false));
  }, [activePair?.id, userId, loadPairData]);

  /* ------------------------- realtime ------------------------- */
  useEffect(() => {
    if (!activePair || !userId) return;
    const reload = () => loadPairData(activePair, userId);
    const channel = supabase
      .channel(`pair:${activePair.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "habits", filter: `pair_id=eq.${activePair.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "habit_logs" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "nudges", filter: `pair_id=eq.${activePair.id}` }, (payload) => {
        const n = payload.new as Nudge | undefined;
        if (n && n.recipient_id === userId) {
          toast(n.message, { icon: "🔔" });
          showLocalNotification("PairUp nudge", n.message);
          haptic(30);
        }
        reload();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pairs", filter: `id=eq.${activePair.id}` }, (payload) => {
        setPairs((prev) => prev.map((p) => (p.id === activePair.id ? { ...p, ...(payload.new as Pair) } : p)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activePair?.id, userId, loadPairData]);

  /* ------------------------- derived ------------------------- */
  const today = todayStr();
  const todayLogs = logs.filter((l) => l.log_date === today);
  const myLogByHabit = new Map(todayLogs.filter((l) => l.user_id === userId).map((l) => [l.habit_id, l]));
  const theirLogByHabit = new Map(todayLogs.filter((l) => l.user_id === partnerId).map((l) => [l.habit_id, l]));
  const myDone = habits.filter((h) => myLogByHabit.has(h.id)).length;
  const theirDone = habits.filter((h) => theirLogByHabit.has(h.id)).length;
  const bothCompleteAll = habits.length > 0 && myDone === habits.length && theirDone === habits.length;

  const stats: DayStat[] = useMemo(() => {
    const total = habits.length;
    return Array.from({ length: HISTORY_DAYS + 1 }, (_, i) => {
      const date = dateStr(addDays(new Date(), i - HISTORY_DAYS));
      const day = logs.filter((l) => l.log_date === date);
      return {
        date,
        mine: new Set(day.filter((l) => l.user_id === userId).map((l) => l.habit_id)).size,
        theirs: new Set(day.filter((l) => l.user_id === partnerId).map((l) => l.habit_id)).size,
        total,
      };
    });
  }, [logs, habits.length, userId, partnerId]);

  useEffect(() => {
    if (bothCompleteAll && celebrated !== `${activePair?.id}:${today}`) {
      setShowCelebration(true);
      setCelebrated(`${activePair?.id}:${today}`);
      haptic(40);
    }
  }, [bothCompleteAll, activePair?.id, today, celebrated]);

  const streakBroken = !!activePair && activePair.current_streak === 0 && activePair.longest_streak > 0;
  const freezeUsedThisMonth = activePair?.freeze_used_month === today.slice(0, 7);
  const habitSlots = activePair?.habit_slots ?? 3;

  /* ------------------------- actions ------------------------- */
  const toggleHabit = async (habit: Habit) => {
    if (!userId) return;
    const existing = myLogByHabit.get(habit.id);
    if (existing) {
      setLogs((prev) => prev.filter((l) => l.id !== existing.id));
      await supabase.from("habit_logs").delete().eq("id", existing.id);
    } else {
      const { data, error } = await supabase.from("habit_logs")
        .insert({ habit_id: habit.id, user_id: userId, log_date: today }).select().single();
      if (error) { toast.error(error.message); return; }
      setLogs((prev) => [...prev, data as HabitLog]);
    }
    if (activePair) loadPairs(userId);
  };

  const addHabit = async (v: { title: string; icon: IconKey; time_of_day: TimeOfDay }) => {
    if (!activePair) return;
    const { error } = await supabase.from("habits").insert({
      pair_id: activePair.id, title: v.title, icon: v.icon, time_of_day: v.time_of_day, position: habits.length,
    });
    if (error) { toast.error(error.message); return; }
    setAdding(false);
    toast.success("Habit added");
  };

  const editHabit = async (habit: Habit, patch: { title: string; icon: IconKey; time_of_day: TimeOfDay }) => {
    const { error } = await supabase.from("habits").update(patch).eq("id", habit.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Habit updated");
  };

  const deleteHabit = async () => {
    if (!confirmDeleteHabit) return;
    await supabase.from("habits").delete().eq("id", confirmDeleteHabit.id);
    setConfirmDeleteHabit(null);
    toast.success("Habit removed");
  };

  const react = async (log: HabitLog, emoji: string, comment?: string) => {
    if (!userId) return;
    const { error } = await supabase.from("reactions").insert({
      habit_log_id: log.id, user_id: userId, emoji, comment: comment ?? null,
    });
    if (error) toast.error(error.message);
  };

  const sendNudge = async (message: string, habitId: string | null) => {
    if (!activePair || !partnerId || !userId) return;
    const { error } = await supabase.from("nudges").insert({
      pair_id: activePair.id, sender_id: userId, recipient_id: partnerId,
      habit_id: habitId, message, kind: "preset",
    });
    if (error) {
      toast.error(error.message.includes("rate") || error.message.includes("once")
        ? "Easy tiger — one nudge per habit per hour 🙂" : error.message);
      return;
    }
    haptic(20);
    toast.success(`Nudge sent to ${partner?.display_name ?? "your partner"}!`);
  };

  const useFreeze = async () => {
    if (!activePair) return;
    const { error } = await supabase.rpc("use_streak_freeze", { _pair_id: activePair.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Streak Freeze applied — your streak is safe ❄️");
    if (userId) loadPairs(userId);
  };

  const unlockHabitSlot = async () => {
    if (!activePair) return;
    const { error } = await supabase.rpc("unlock_habit_slot", { _pair_id: activePair.id });
    if (error) { toast.error(error.message); return; }
    toast.success("4th habit row unlocked! 🎉");
    if (userId) loadPairs(userId);
  };

  const unlockPartnerSlot = async () => {
    const { error } = await supabase.rpc("unlock_partner_slot");
    if (error) { toast.error(error.message); return; }
    toast.success("2nd partner slot unlocked! 🎉");
    if (userId) await refreshProfile(userId);
  };

  const copyInvite = async () => {
    if (!activePair) return;
    try { await navigator.clipboard.writeText(activePair.invite_code); toast.success("Invite code copied!"); haptic(); } catch { /* denied */ }
  };

  const switchPair = async (pairId: string) => {
    await supabase.rpc("switch_active_pair", { _pair_id: pairId });
    if (userId) await refreshProfile(userId);
    setSettingsOpen(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!userId || !profile) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">Loading…</div>;
  }

  const partnerName = partner?.display_name ?? "your partner";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-20 top-40 h-64 w-64 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-success/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col">
        {!activePair ? (
          <Onboarding
            profile={profile}
            onSettings={() => setSettingsOpen(true)}
            onCreated={async () => { await loadPairs(userId); await refreshProfile(userId); }}
          />
        ) : (
          <motion.div key={activePair.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col pb-32">
            {/* header */}
            <div className="flex items-start justify-between px-6 pt-6">
              <img src={logo.url} alt="PairUp" className="h-9 w-auto" />
              <div className="flex items-start gap-3">
                <PersonPill emoji={profile.avatar_emoji} avatarPath={profile.avatar_url} name={profile.display_name} done={myDone} total={habits.length} onClick={() => setSettingsOpen(true)} highlight />
                <PersonPill emoji={partner?.avatar_emoji ?? "➕"} avatarPath={partner?.avatar_url} name={partner?.display_name ?? "Invite"} done={theirDone} total={habits.length} onClick={copyInvite} />
              </div>
            </div>

            {/* invite + switcher row */}
            <div className="mt-4 flex items-center gap-2 px-6">
              <button onClick={copyInvite} className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary transition active:scale-95">
                <Copy className="h-3 w-3" /> {activePair.invite_code}
              </button>
              {pairs.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-full bg-secondary-soft px-3 py-1.5 text-xs font-bold text-secondary">
                    <Users className="h-3 w-3" /> {partnerName} <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Switch partner</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {pairs.map((p) => {
                      const oid = p.user1_id === userId ? p.user2_id : p.user1_id;
                      return (
                        <DropdownMenuItem key={p.id} onClick={() => switchPair(p.id)}>
                          {(oid && profiles[oid]?.display_name) || `Code ${p.invite_code}`} · 🔥 {p.current_streak}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {tab === "stats" ? (
              <AnalyticsView stats={stats} pair={activePair} youName={profile.display_name} partnerName={partnerName} />
            ) : (
              <>
            <StreakHero
              streak={activePair.current_streak}
              longest={activePair.longest_streak}
              complete={bothCompleteAll}
              myDone={myDone}
              theirDone={theirDone}
              total={habits.length}
              partnerName={partnerName}
              you={profile.display_name}
            />

            {streakBroken && (
              <div className="mx-6 mt-4 rounded-3xl border-2 border-dashed border-primary/30 bg-primary-soft p-5">
                <div className="text-sm font-bold text-primary">Streak reset — no big deal 💛</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  You reached {activePair.longest_streak} days once, so you already know you can. Check one habit off together to start again.
                </p>
                <button onClick={useFreeze} disabled={freezeUsedThisMonth}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-bold text-secondary disabled:opacity-50">
                  <Snowflake className="h-3.5 w-3.5" />
                  {freezeUsedThisMonth ? "Freeze used this month" : "Use free monthly Streak Freeze"}
                </button>
              </div>
            )}

            {!partner && <PendingPartner code={activePair.invite_code} onCopy={copyInvite} />}

            <WeeklyRibbon stats={stats} />

            {/* habits */}
            <div className="mt-6 px-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today's habits</h2>
                <span className="text-xs font-bold text-muted-foreground">{habits.length}/{habitSlots}</span>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <><HabitSkeleton /><HabitSkeleton /><HabitSkeleton /></>
                ) : habits.length === 0 && !adding ? (
                  <div className="rounded-3xl bg-surface p-8 text-center shadow-[var(--shadow-card)]">
                    <div className="text-4xl">🌱</div>
                    <div className="mt-2 text-sm font-bold">Create your first micro-habit</div>
                    <p className="mt-1 text-xs text-muted-foreground">Something tiny you can both do daily — 10 push-ups, one page, one glass of water.</p>
                    <button onClick={() => setAdding(true)} className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)]">
                      Add a habit
                    </button>
                  </div>
                ) : (
                  habits.map((h) => (
                    <HabitCard
                      key={h.id}
                      habit={h}
                      myLog={myLogByHabit.get(h.id)}
                      theirLog={theirLogByHabit.get(h.id)}
                      partnerName={partnerName}
                      reactions={reactions.filter((r) => r.habit_log_id === theirLogByHabit.get(h.id)?.id)}
                      onToggle={() => toggleHabit(h)}
                      onEdit={(patch) => editHabit(h, patch)}
                      onDelete={() => setConfirmDeleteHabit(h)}
                      onReact={react}
                      onNudge={() => { setNudgeHabitId(h.id); setNudgeOpen(true); }}
                    />
                  ))
                )}

                {adding && <HabitForm submitLabel="Add habit" onCancel={() => setAdding(false)} onSubmit={addHabit} />}

                {!adding && habits.length > 0 && habits.length < habitSlots && (
                  <button onClick={() => setAdding(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border py-4 text-sm font-bold text-muted-foreground transition active:scale-[0.99]">
                    <Plus className="h-4 w-4" /> Add new habit
                  </button>
                )}

                {!adding && habits.length >= habitSlots && habitSlots < 4 && (
                  <button onClick={() => setRv("habit")}
                    className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-primary/40 bg-primary-soft py-4 text-xs font-bold text-primary transition active:scale-[0.99]">
                    <PlayCircle className="h-4 w-4" /> Watch a short video to unlock a 4th habit row
                  </button>
                )}
                {!adding && habits.length >= habitSlots && habitSlots >= 4 && (
                  <p className="text-center text-xs text-muted-foreground">You're at the max of {habitSlots} habits — keep it focused 💪</p>
                )}
              </div>
            </div>

            <MonthlyCalendar stats={stats} />

            {/* freeze card */}
            {!streakBroken && (
              <div className="mx-6 mt-4 flex items-center gap-3 rounded-3xl bg-surface px-5 py-4 shadow-[var(--shadow-card)]">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary-soft text-secondary"><Snowflake className="h-5 w-5" /></span>
                <div className="flex-1">
                  <div className="text-sm font-bold">Streak Freeze</div>
                  <div className="text-xs text-muted-foreground">{freezeUsedThisMonth ? "Used this month — extras come with Pro" : "1 free save per month if life gets in the way"}</div>
                </div>
                <button onClick={freezeUsedThisMonth ? () => toast("Extra freezes are part of Pro ✨") : useFreeze}
                  className="rounded-full bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground">
                  {freezeUsedThisMonth ? "Get Pro" : "Use"}
                </button>
              </div>
            )}
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* bottom nav */}
      {activePair && (
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[440px] px-6 pb-5">
          <div className="flex items-center justify-around rounded-full bg-surface/95 px-2 py-2 shadow-[0_-6px_30px_rgba(0,0,0,0.08)] backdrop-blur">
            <NavBtn icon={Home} label="Home" active={tab === "home"}
              onClick={() => { setTab("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            <NavBtn icon={BarChart3} label="Stats" active={tab === "stats"}
              onClick={() => { setTab("stats"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            <button onClick={() => { setNudgeHabitId(null); setNudgeOpen(true); }} aria-label="Send a nudge"
              className="-mt-8 grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-90">
              <Bell className="h-6 w-6" />
            </button>
            <NavBtn icon={SettingsIcon} label="Settings" onClick={() => setSettingsOpen(true)} />
          </div>
        </nav>
      )}

      <NudgeSheet
        open={nudgeOpen}
        onOpenChange={setNudgeOpen}
        partnerName={partnerName}
        habits={habits}
        defaultHabitId={nudgeHabitId}
        recent={nudges}
        userId={userId}
        onSend={sendNudge}
      />

      <SettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        profile={profile}
        pairs={pairs}
        profiles={profiles}
        activePairId={activePair?.id ?? null}
        userId={userId}
        onProfileChanged={setProfile}
        onSwitch={switchPair}
        onSignOut={signOut}
        onPairsChanged={async () => { await loadPairs(userId); await refreshProfile(userId); }}
        onAddPartner={async () => { await loadPairs(userId); await refreshProfile(userId); }}
        onUnlockPartner={() => { setSettingsOpen(false); setRv("partner"); }}
      />

      <RewardedVideoDialog
        open={rv === "habit"}
        onOpenChange={(o) => !o && setRv(null)}
        title="Unlock a 4th habit"
        description="Watch a short video to add one more habit row for this pair — today and every day."
        rewardLabel="Unlock 4th habit"
        onReward={unlockHabitSlot}
      />
      <RewardedVideoDialog
        open={rv === "partner"}
        onOpenChange={(o) => !o && setRv(null)}
        title="Unlock a 2nd partner"
        description="One partner is free. Watch a short video to add a second accountability buddy with their own streak."
        rewardLabel="Unlock 2nd partner"
        onReward={unlockPartnerSlot}
      />

      <CelebrationModal
        open={showCelebration}
        streak={activePair?.current_streak ?? 0}
        partnerName={partnerName}
        onClose={() => setShowCelebration(false)}
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

/* ---------------------- pieces ---------------------- */

function NavBtn({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-16 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function PersonPill({ emoji, avatarPath, name, done, total, onClick, highlight }: {
  emoji: string; avatarPath?: string | null; name: string; done: number; total: number; onClick: () => void; highlight?: boolean;
}) {
  const complete = total > 0 && done >= total;
  return (
    <button onClick={onClick} className="flex w-16 flex-col items-center gap-1 transition active:scale-95">
      <span className={`relative grid h-12 w-12 place-items-center overflow-visible rounded-full text-xl shadow-[var(--shadow-card)] ${complete ? "bg-success-soft ring-2 ring-success" : highlight ? "bg-primary-soft ring-2 ring-primary/40" : "bg-surface"}`}>
        <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full">
          <Avatar emoji={emoji} avatarPath={avatarPath} alt={name} />
        </span>
        {total > 0 && (
          <span className={`absolute -bottom-1 rounded-full px-1.5 text-[10px] font-bold ${complete ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
            {done}/{total}
          </span>
        )}
      </span>
      <span className="w-full truncate text-center text-[11px] font-bold text-muted-foreground">{name}</span>
    </button>
  );
}

function StreakHero({ streak, longest, complete, myDone, theirDone, total, partnerName, you }: {
  streak: number; longest: number; complete: boolean; myDone: number; theirDone: number; total: number; partnerName: string; you: string;
}) {
  const pct = total > 0 ? Math.round(((myDone + theirDone) / (total * 2)) * 100) : 0;
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="mx-6 mt-5 overflow-hidden rounded-[32px] bg-gradient-to-br from-primary via-[#ff7f45] to-[#ff9d3d] p-6 text-primary-foreground shadow-[var(--shadow-primary)]">
      <div className="flex items-center gap-5">
        <div className="relative grid h-32 w-32 shrink-0 place-items-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="10" />
            <motion.circle cx="60" cy="60" r={R} fill="none" stroke="white" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} animate={{ strokeDashoffset: C - (C * pct) / 100 }} transition={{ duration: 0.8, ease: "easeOut" }} />
          </svg>
          <div className={`text-center ${complete ? "animate-flame" : ""}`}>
            <div className="text-[40px] font-bold leading-none">{streak}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-90">days</div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-90">
            <Flame className="h-3.5 w-3.5" fill="currentColor" /> Shared streak
          </div>
          <div className="mt-1 text-[15px] font-bold leading-snug">
            {complete ? "Today is locked in. Legendary." : total === 0 ? "Add a habit to get going" : pct === 0 ? "Nobody's checked in yet" : "Keep it moving!"}
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold">
            <Trophy className="h-3 w-3" /> Best: {longest} days
          </div>
          <div className="mt-2 space-y-0.5 text-[11px] font-semibold opacity-95">
            <div>{you}: {myDone}/{total || 0}</div>
            <div>{partnerName}: {theirDone}/{total || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingPartner({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <div className="mx-6 mt-4 rounded-3xl bg-secondary-soft p-5 text-center">
      <div className="text-sm font-bold text-secondary">Waiting for your partner to join</div>
      <div className="mt-2 font-mono text-2xl font-bold tracking-[0.25em] text-secondary">{code}</div>
      <button onClick={onCopy} className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-bold text-secondary">
        <Copy className="h-3.5 w-3.5" /> Copy invite code
      </button>
    </div>
  );
}

function CelebrationModal({ open, streak, partnerName, onClose }: { open: boolean; streak: number; partnerName: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/70 p-6 backdrop-blur-sm" onClick={onClose}>
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.span key={i} className="pointer-events-none absolute h-3 w-3 rounded-full"
              style={{ background: ["#ff6a2d", "#0060ac", "#06925a", "#ffb347"][i % 4] }}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{ x: (Math.random() - 0.5) * 500, y: (Math.random() - 0.5) * 700, opacity: 0, rotate: 360 }}
              transition={{ duration: 1.6, delay: i * 0.02 }} />
          ))}
          <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-[320px] rounded-[32px] bg-surface p-8 text-center shadow-2xl">
            <div className="animate-flame text-6xl">🔥</div>
            <h3 className="mt-3 text-2xl font-bold">Day {streak} complete!</h3>
            <p className="mt-2 text-sm text-muted-foreground">You and {partnerName} both finished everything today. That's how streaks are built.</p>
            <button onClick={onClose} className="mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)]">
              <Sparkles className="mr-1 inline h-4 w-4" /> Nice
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------- onboarding ---------------------- */

function Onboarding({ onCreated, onSettings, profile }: { onCreated: () => Promise<void>; onSettings: () => void; profile: Profile }) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const createPair = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_pair");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
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
    try { await navigator.clipboard.writeText(createdCode); toast.success("Invite code copied!"); } catch { /* denied */ }
  };

  return (
    <div className="flex flex-1 flex-col px-6 pb-10 pt-8">
      <div className="flex items-start justify-between">
        <img src={logo.url} alt="PairUp" className="h-9 w-auto" />
        <button onClick={onSettings} className="flex w-16 flex-col items-center gap-1">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-surface text-xl shadow-[var(--shadow-card)]">
            <Avatar emoji={profile.avatar_emoji} avatarPath={profile.avatar_url} alt={profile.display_name} />
          </span>
          <span className="w-full truncate text-center text-[11px] font-bold text-muted-foreground">{profile.display_name}</span>
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
            <button onClick={() => setMode("create")} className="flex items-center justify-between rounded-3xl bg-primary px-6 py-5 text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-[0.98]">
              <div className="text-left">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Mode A</div>
                <div className="text-lg font-bold">Create a Pair</div>
              </div>
              <UserPlus className="h-5 w-5" />
            </button>
            <button onClick={() => setMode("join")} className="flex items-center justify-between rounded-3xl border-2 border-secondary/20 bg-secondary-soft px-6 py-5 text-secondary transition active:scale-[0.98]">
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
                    {createdCode.split("").map((c, i) => (<span key={i} className="rounded-xl bg-primary-soft px-2.5 py-1">{c}</span>))}
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
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC123" className="w-full rounded-3xl bg-surface px-6 py-5 text-center font-mono text-2xl font-bold tracking-[0.3em] shadow-[var(--shadow-card)] outline-none ring-primary/40 focus:ring-4" />
            <button disabled={joinCode.length !== 6 || busy} onClick={joinPair}
              className="rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">
              Join pair
            </button>
            <button onClick={() => setMode("choose")} className="text-sm text-muted-foreground underline">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
