import {
  Check, Dumbbell, BookOpen, Droplet, Moon, Brain, Heart, Sun,
  Coffee, Music, PenLine, Footprints,
} from "lucide-react";

export type IconKey =
  | "check" | "run" | "book" | "water" | "sleep" | "brain" | "heart" | "sun"
  | "coffee" | "music" | "write" | "walk";

export const ICONS: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  check: Check, run: Dumbbell, book: BookOpen, water: Droplet, sleep: Moon,
  brain: Brain, heart: Heart, sun: Sun, coffee: Coffee, music: Music,
  write: PenLine, walk: Footprints,
};

export const ICON_ORDER: IconKey[] = [
  "check", "run", "book", "water", "sleep", "brain",
  "heart", "sun", "coffee", "music", "write", "walk",
];

export const EMOJIS = ["🙂", "😎", "🦊", "🐻", "🐼", "🐸", "🚀", "🌸", "⚡️", "🔥", "🌈", "🍀"];

export const TIMEZONES = [
  "UTC", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore",
  "Asia/Kolkata", "Australia/Sydney",
];

export type TimeOfDay = "morning" | "afternoon" | "evening" | "anytime";
export const TIME_OF_DAY: { key: TimeOfDay; label: string; emoji: string }[] = [
  { key: "morning", label: "Morning", emoji: "🌅" },
  { key: "afternoon", label: "Afternoon", emoji: "☀️" },
  { key: "evening", label: "Evening", emoji: "🌙" },
  { key: "anytime", label: "Anytime", emoji: "✨" },
];

export type Profile = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  timezone: string;
  reminder_time: string | null;
  active_pair_id: string | null;
  plan: string;
  partner_slots: number;
  push_enabled: boolean;
};

export type Pair = {
  id: string;
  invite_code: string;
  user1_id: string;
  user2_id: string | null;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  archived: boolean;
  created_at: string;
  habit_slots: number;
  freeze_used_month: string | null;
  plan: string;
};

export type Habit = {
  id: string;
  pair_id: string;
  title: string;
  icon: string;
  position: number;
  time_of_day: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  created_at: string;
};

export type Reaction = {
  id: string;
  habit_log_id: string;
  user_id: string;
  emoji: string;
  comment: string | null;
  created_at: string;
};

export type Nudge = {
  id: string;
  pair_id: string;
  sender_id: string;
  recipient_id: string;
  habit_id: string | null;
  message: string;
  kind: string;
  created_at: string;
};

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export const haptic = (ms = 12) => {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
};

export const NUDGE_PRESETS = [
  { emoji: "👋", label: "Wave", message: "👋 Hey! Your habits are waiting." },
  { emoji: "💧", label: "Water", message: "💧 Hydrate check — go get that glass!" },
  { emoji: "🔥", label: "Streak", message: "🔥 Don't break our streak!" },
  { emoji: "🌙", label: "Almost midnight", message: "🌙 Almost midnight — quick, check in!" },
];

export const REACTION_EMOJIS = ["🙌", "🔥", "👏", "💪"];
