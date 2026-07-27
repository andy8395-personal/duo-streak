-- 1. Habit time of day
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS time_of_day text NOT NULL DEFAULT 'anytime';
ALTER TABLE public.habits ADD CONSTRAINT habits_time_of_day_chk CHECK (time_of_day IN ('morning','afternoon','evening','anytime'));

-- 2. Pair-level slots / freezes / plan
ALTER TABLE public.pairs ADD COLUMN IF NOT EXISTS habit_slots int NOT NULL DEFAULT 3;
ALTER TABLE public.pairs ADD COLUMN IF NOT EXISTS freeze_used_month date;
ALTER TABLE public.pairs ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- 3. Profile plan + partner slots
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS partner_slots int NOT NULL DEFAULT 1;

-- 4. Nudges
CREATE TABLE IF NOT EXISTS public.nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  habit_id uuid REFERENCES public.habits(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT 'Nudge!',
  kind text NOT NULL DEFAULT 'nudge',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.nudges TO authenticated;
GRANT ALL ON public.nudges TO service_role;
ALTER TABLE public.nudges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nudges_select_member" ON public.nudges FOR SELECT TO authenticated
  USING (public.is_pair_member(pair_id, auth.uid()));
CREATE POLICY "nudges_insert_self" ON public.nudges FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_pair_member(pair_id, auth.uid()));

CREATE INDEX IF NOT EXISTS nudges_pair_created_idx ON public.nudges (pair_id, created_at DESC);

-- anti-spam: 1 nudge per sender per habit (or per pair when no habit) per hour
CREATE OR REPLACE FUNCTION public.enforce_nudge_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_last timestamptz;
BEGIN
  SELECT max(created_at) INTO v_last FROM public.nudges
  WHERE sender_id = NEW.sender_id
    AND pair_id = NEW.pair_id
    AND habit_id IS NOT DISTINCT FROM NEW.habit_id;
  IF v_last IS NOT NULL AND v_last > now() - interval '1 hour' THEN
    RAISE EXCEPTION 'You already nudged about this recently — try again in a bit.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nudges_rate_limit ON public.nudges;
CREATE TRIGGER nudges_rate_limit BEFORE INSERT ON public.nudges
FOR EACH ROW EXECUTE FUNCTION public.enforce_nudge_rate_limit();

-- 5. Reactions on habit completions
CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_log_id uuid NOT NULL REFERENCES public.habit_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT '🔥',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_log_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select_member" ON public.reactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.habit_logs l JOIN public.habits h ON h.id = l.habit_id
    WHERE l.id = reactions.habit_log_id AND public.is_pair_member(h.pair_id, auth.uid())
  ));
CREATE POLICY "reactions_insert_self" ON public.reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.habit_logs l JOIN public.habits h ON h.id = l.habit_id
    WHERE l.id = reactions.habit_log_id AND public.is_pair_member(h.pair_id, auth.uid())
  ));
CREATE POLICY "reactions_delete_self" ON public.reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6. Habit limit now respects pair habit_slots
CREATE OR REPLACE FUNCTION public.enforce_habit_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_slots int;
BEGIN
  SELECT habit_slots INTO v_slots FROM public.pairs WHERE id = NEW.pair_id;
  IF (SELECT count(*) FROM public.habits WHERE pair_id = NEW.pair_id) >= COALESCE(v_slots, 3) THEN
    RAISE EXCEPTION 'Habit limit reached for this pair';
  END IF;
  RETURN NEW;
END $$;

-- 7. Unlock extra habit slot (rewarded video)
CREATE OR REPLACE FUNCTION public.unlock_habit_slot(_pair_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_pair_member(_pair_id, auth.uid()) THEN RAISE EXCEPTION 'Not a member'; END IF;
  UPDATE public.pairs SET habit_slots = 4 WHERE id = _pair_id AND habit_slots < 4;
END $$;

-- 8. Unlock 2nd partner slot (rewarded video)
CREATE OR REPLACE FUNCTION public.unlock_partner_slot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles SET partner_slots = 2 WHERE id = auth.uid() AND partner_slots < 2;
END $$;

-- 9. Streak freeze: one free restore per calendar month
CREATE OR REPLACE FUNCTION public.use_streak_freeze(_pair_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_used date; v_long int; v_cur int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_pair_member(_pair_id, auth.uid()) THEN RAISE EXCEPTION 'Not a member'; END IF;
  SELECT freeze_used_month, longest_streak, current_streak INTO v_used, v_long, v_cur
    FROM public.pairs WHERE id = _pair_id;
  IF v_used IS NOT NULL AND v_used = date_trunc('month', CURRENT_DATE)::date THEN
    RAISE EXCEPTION 'Streak Freeze already used this month';
  END IF;
  UPDATE public.pairs
    SET current_streak = GREATEST(v_cur, v_long),
        last_completed_date = CURRENT_DATE - 1,
        freeze_used_month = date_trunc('month', CURRENT_DATE)::date
    WHERE id = _pair_id;
END $$;

-- 10. Realtime
ALTER TABLE public.nudges REPLICA IDENTITY FULL;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.nudges;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS habit_logs_date_idx ON public.habit_logs (log_date);