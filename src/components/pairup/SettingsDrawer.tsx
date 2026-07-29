import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, LogOut, UserPlus, Users, Copy, Trash2, Crown, PlayCircle, Check,
  Camera, Bell, X, Download,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { EMOJIS, Pair, Profile, TIMEZONES } from "./types";
import { Avatar } from "./Avatar";
import { notificationPermission, requestNotificationPermission } from "@/lib/notifications";

export function SettingsDrawer({
  open, onOpenChange, profile, pairs, profiles, activePairId, userId,
  onProfileChanged, onSwitch, onSignOut, onPairsChanged, onAddPartner, onUnlockPartner,
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
  onUnlockPartner: () => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [emoji, setEmoji] = useState(profile.avatar_emoji);
  const [tz, setTz] = useState(profile.timezone);
  const [reminder, setReminder] = useState(profile.reminder_time ?? "");
  const [confirmUnpair, setConfirmUnpair] = useState<Pair | null>(null);
  const [addMode, setAddMode] = useState<null | "create" | "join">(null);
  const [joinCode, setJoinCode] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [perm, setPerm] = useState<string>("default");
  const [installEvt, setInstallEvt] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(profile.display_name); setEmoji(profile.avatar_emoji);
      setTz(profile.timezone); setReminder(profile.reminder_time ?? "");
      setAddMode(null); setNewCode(null); setJoinCode("");
      setPerm(notificationPermission());
    }
  }, [open, profile]);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const slots = profile.partner_slots ?? 1;
  const canAddPartner = pairs.length < slots;

  const patchProfile = async (patch: { avatar_url?: string | null; push_enabled?: boolean }) => {
    const { data, error } = await supabase.from("profiles").update(patch).eq("id", userId).select().single();
    if (error) { toast.error(error.message); return null; }
    onProfileChanged(data as Profile);
    return data as Profile;
  };

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Pick an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Keep it under 5 MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { setUploading(false); toast.error(error.message); return; }
    if (profile.avatar_url) await supabase.storage.from("avatars").remove([profile.avatar_url]);
    await patchProfile({ avatar_url: path });
    setUploading(false);
    toast.success("Photo updated");
  };

  const removeAvatar = async () => {
    if (profile.avatar_url) await supabase.storage.from("avatars").remove([profile.avatar_url]);
    await patchProfile({ avatar_url: null });
    toast.success("Back to your emoji");
  };

  const toggleNotifications = async () => {
    if (profile.push_enabled) { await patchProfile({ push_enabled: false }); toast("Reminders off"); return; }
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === "unsupported") { toast.error("This device doesn't support notifications"); return; }
    if (result !== "granted") { toast.error("Notifications blocked — enable them in your browser settings"); return; }
    await patchProfile({ push_enabled: true });
    toast.success("Nudges will now buzz your device 🔔");
  };

  const installApp = async () => {
    if (!installEvt) { toast("On iPhone: tap Share → Add to Home Screen"); return; }
    installEvt.prompt();
    setInstallEvt(null);
  };


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
    toast.success("Partner archived — your history is kept safe");
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
    setAddMode(null); setJoinCode("");
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
          <SheetDescription>Manage your account, plan and partners</SheetDescription>
        </SheetHeader>

        {/* Profile */}
        <div className="mt-6 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your profile</div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-muted text-3xl">
                <Avatar emoji={emoji} avatarPath={profile.avatar_url} alt={profile.display_name} />
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Upload photo"
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-primary)] disabled:opacity-60">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 text-xs text-muted-foreground">
              {uploading ? "Uploading…" : profile.avatar_url ? "Photo avatar active." : "Upload a photo, or pick an emoji below."}
              {profile.avatar_url && (
                <button onClick={removeAvatar} className="mt-2 flex items-center gap-1 text-xs font-bold text-destructive">
                  <X className="h-3.5 w-3.5" /> Remove photo
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
          </div>

          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} placeholder="Display name"
            className="w-full rounded-2xl bg-muted px-4 py-3 text-sm font-semibold outline-none ring-primary/40 focus:ring-4" />
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)}
                className={`grid h-10 w-10 place-items-center rounded-xl text-lg transition ${emoji === e ? "bg-primary shadow-[var(--shadow-primary)]" : "bg-muted"}`}>
                {e}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select value={tz} onChange={(e) => setTz(e.target.value)} className="rounded-2xl bg-muted px-3 py-3 text-sm font-semibold outline-none">
              {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="time" value={reminder} onChange={(e) => setReminder(e.target.value)}
              className="rounded-2xl bg-muted px-3 py-3 text-sm font-semibold outline-none" />
          </div>
          <button onClick={saveProfile} className="w-full rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)]">
            Save profile
          </button>
        </div>

        {/* Notifications & install */}
        <div className="mt-8 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notifications</div>
          <button onClick={toggleNotifications}
            className="flex w-full items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-left">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary"><Bell className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Nudge alerts</span>
              <span className="block text-xs text-muted-foreground">
                {profile.push_enabled ? "On — you'll get a device alert" : perm === "denied" ? "Blocked in browser settings" : "Off — nudges show in-app only"}
              </span>
            </span>
            <span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${profile.push_enabled ? "bg-success" : "bg-border"}`}>
              <span className={`block h-5 w-5 rounded-full bg-surface transition ${profile.push_enabled ? "translate-x-5" : ""}`} />
            </span>
          </button>
          <button onClick={installApp} className="flex w-full items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-left">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary-soft text-secondary"><Download className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Install PairUp</span>
              <span className="block text-xs text-muted-foreground">Add it to your home screen like a real app</span>
            </span>
          </button>
        </div>


        {/* Plan */}
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your plan</div>
          <div className="mt-3 rounded-3xl bg-gradient-to-br from-secondary to-[#2b86d9] p-5 text-secondary-foreground shadow-[var(--shadow-secondary)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{profile.plan === "pro" ? "PairUp Pro" : "Free plan"}</div>
                <div className="text-xs opacity-90">{pairs.length}/{slots} partner{slots > 1 ? "s" : ""} used</div>
              </div>
              <Crown className="h-6 w-6" />
            </div>
            <ul className="mt-3 space-y-1 text-xs opacity-95">
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> 1 partner free · 2nd unlocked with a short video</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> 1 Streak Freeze every month</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> 3 habits, 4th unlocked with a short video</li>
            </ul>
            <button onClick={goPremium}
              className="mt-4 w-full rounded-full bg-surface px-4 py-2.5 text-xs font-bold text-secondary">
              See PairUp Pro
            </button>
          </div>
        </div>

        {/* Partners */}
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Partners</div>
          <div className="mt-3 space-y-2">
            {pairs.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 rounded-2xl p-3 ${p.id === activePairId ? "bg-primary-soft ring-2 ring-primary/30" : "bg-muted"}`}>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-sm"><Users className="h-4 w-4 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{partnerNameFor(p)}</div>
                  <div className="text-xs text-muted-foreground">🔥 {p.current_streak} day streak</div>
                </div>
                {p.id !== activePairId && (
                  <button onClick={() => onSwitch(p.id)} className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-primary">Switch</button>
                )}
                <button onClick={() => setConfirmUnpair(p)} aria-label="Unpair" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {canAddPartner ? (
            !addMode ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => { setAddMode("create"); createNewPair(); }} className="rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground">
                  <UserPlus className="mx-auto mb-1 h-4 w-4" /> New invite code
                </button>
                <button onClick={() => setAddMode("join")} className="rounded-2xl bg-secondary-soft px-4 py-3 text-xs font-bold text-secondary">
                  <Users className="mx-auto mb-1 h-4 w-4" /> Enter a code
                </button>
              </div>
            ) : addMode === "create" ? (
              <div className="mt-3 rounded-2xl bg-muted p-4 text-center">
                {newCode ? (
                  <p className="text-xs text-muted-foreground">
                    New pair created and made active. Your invite code is on the home screen badge — tap it to copy.
                  </p>
                ) : <div className="text-sm text-muted-foreground">Generating…</div>}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="ABC123" className="w-full rounded-2xl bg-muted px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.3em] outline-none" />
                <button disabled={joinCode.length !== 6} onClick={joinNewPair}
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">Join</button>
              </div>
            )
          ) : slots < 2 && pairs.some((p) => !!p.user2_id) ? (
            <button onClick={onUnlockPartner}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-soft px-4 py-4 text-xs font-bold text-primary">
              <PlayCircle className="h-4 w-4" /> Watch a short video to unlock a 2nd partner
            </button>
          ) : slots >= 2 ? (
            <button onClick={goPremium}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary-soft px-4 py-4 text-xs font-bold text-secondary">
              <Crown className="h-4 w-4" /> Upgrade to add a 3rd partner
            </button>
          ) : null}
        </div>

        <button onClick={onSignOut} className="mt-8 mb-8 flex w-full items-center justify-center gap-2 rounded-full bg-destructive/10 px-5 py-3 text-sm font-bold text-destructive">
          <LogOut className="h-4 w-4" /> Sign out
        </button>

        <AlertDialog open={!!confirmUnpair} onOpenChange={(o) => !o && setConfirmUnpair(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unpair from {confirmUnpair ? partnerNameFor(confirmUnpair) : ""}?</AlertDialogTitle>
              <AlertDialogDescription>
                This archives your shared history and streak. Nothing in your personal account is deleted, and you can always pair again with a new code.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep partner</AlertDialogCancel>
              <AlertDialogAction onClick={unpair} className="bg-destructive text-destructive-foreground">Unpair</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
