
-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'You',
  avatar_emoji text NOT NULL DEFAULT '🙂',
  timezone text NOT NULL DEFAULT 'UTC',
  reminder_time text,
  active_pair_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ PAIRS ============
CREATE TABLE public.pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code text UNIQUE NOT NULL,
  user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_completed_date date,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pairs TO authenticated;
GRANT ALL ON public.pairs TO service_role;
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_active_pair_fk FOREIGN KEY (active_pair_id) REFERENCES public.pairs(id) ON DELETE SET NULL;

-- ============ HABITS ============
CREATE TABLE public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  title text NOT NULL,
  icon text NOT NULL DEFAULT 'check',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

-- ============ HABIT LOGS ============
CREATE TABLE public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

-- ============ HELPER: pair membership ============
CREATE OR REPLACE FUNCTION public.is_pair_member(_pair_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pairs p
    WHERE p.id = _pair_id AND (p.user1_id = _user_id OR p.user2_id = _user_id)
  );
$$;

-- Profile that shares a pair with the caller
CREATE OR REPLACE FUNCTION public.shares_pair_with(_other_id uuid, _me uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pairs p
    WHERE (p.user1_id = _me AND p.user2_id = _other_id)
       OR (p.user2_id = _me AND p.user1_id = _other_id)
  );
$$;

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_pair_with(id, auth.uid()));
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- pairs
CREATE POLICY pairs_select_member ON public.pairs FOR SELECT TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY pairs_insert_creator ON public.pairs FOR INSERT TO authenticated
  WITH CHECK (user1_id = auth.uid());
CREATE POLICY pairs_update_member ON public.pairs FOR UPDATE TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid())
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY pairs_delete_member ON public.pairs FOR DELETE TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- habits
CREATE POLICY habits_select_member ON public.habits FOR SELECT TO authenticated
  USING (public.is_pair_member(pair_id, auth.uid()));
CREATE POLICY habits_insert_member ON public.habits FOR INSERT TO authenticated
  WITH CHECK (public.is_pair_member(pair_id, auth.uid()));
CREATE POLICY habits_update_member ON public.habits FOR UPDATE TO authenticated
  USING (public.is_pair_member(pair_id, auth.uid()))
  WITH CHECK (public.is_pair_member(pair_id, auth.uid()));
CREATE POLICY habits_delete_member ON public.habits FOR DELETE TO authenticated
  USING (public.is_pair_member(pair_id, auth.uid()));

-- habit_logs
CREATE POLICY habit_logs_select_member ON public.habit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.habits h WHERE h.id = habit_id AND public.is_pair_member(h.pair_id, auth.uid())));
CREATE POLICY habit_logs_insert_self ON public.habit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.habits h WHERE h.id = habit_id AND public.is_pair_member(h.pair_id, auth.uid())));
CREATE POLICY habit_logs_delete_self ON public.habit_logs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ TRIGGERS ============

-- updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(COALESCE(NEW.email, 'You'), '@', 1)
  );
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, v_name)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enforce max 3 habits per pair
CREATE OR REPLACE FUNCTION public.enforce_habit_limit() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.habits WHERE pair_id = NEW.pair_id) >= 3 THEN
    RAISE EXCEPTION 'A pair can have at most 3 habits';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER habits_limit BEFORE INSERT ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.enforce_habit_limit();

-- Update streak when both partners have logged all habits today
CREATE OR REPLACE FUNCTION public.check_and_update_streak() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pair_id uuid; v_habits int; v_u1_done int; v_u2_done int;
  v_u1 uuid; v_u2 uuid; v_last date; v_cur int; v_long int;
BEGIN
  SELECT pair_id INTO v_pair_id FROM public.habits WHERE id = NEW.habit_id;
  SELECT user1_id, user2_id, last_completed_date, current_streak, longest_streak
    INTO v_u1, v_u2, v_last, v_cur, v_long FROM public.pairs WHERE id = v_pair_id;
  IF v_u2 IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_habits FROM public.habits WHERE pair_id = v_pair_id;
  IF v_habits = 0 THEN RETURN NEW; END IF;
  SELECT count(DISTINCT l.habit_id) INTO v_u1_done
    FROM public.habit_logs l JOIN public.habits h ON h.id=l.habit_id
    WHERE h.pair_id = v_pair_id AND l.user_id = v_u1 AND l.log_date = CURRENT_DATE;
  SELECT count(DISTINCT l.habit_id) INTO v_u2_done
    FROM public.habit_logs l JOIN public.habits h ON h.id=l.habit_id
    WHERE h.pair_id = v_pair_id AND l.user_id = v_u2 AND l.log_date = CURRENT_DATE;
  IF v_u1_done = v_habits AND v_u2_done = v_habits AND (v_last IS NULL OR v_last <> CURRENT_DATE) THEN
    IF v_last = CURRENT_DATE - 1 THEN v_cur := v_cur + 1; ELSE v_cur := 1; END IF;
    IF v_cur > v_long THEN v_long := v_cur; END IF;
    UPDATE public.pairs
      SET current_streak = v_cur, longest_streak = v_long, last_completed_date = CURRENT_DATE
      WHERE id = v_pair_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER habit_log_streak AFTER INSERT ON public.habit_logs
  FOR EACH ROW EXECUTE FUNCTION public.check_and_update_streak();

-- ============ RPC FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.generate_invite_code() RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text; i int; exists_count int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, floor(random()*length(alphabet))::int + 1, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM public.pairs WHERE invite_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END $$;

-- Create pair for the caller and set as active
CREATE OR REPLACE FUNCTION public.create_pair() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_code := public.generate_invite_code();
  INSERT INTO public.pairs (invite_code, user1_id) VALUES (v_code, auth.uid()) RETURNING id INTO v_id;
  UPDATE public.profiles SET active_pair_id = v_id WHERE id = auth.uid();
  RETURN v_id;
END $$;

-- Join a pair by invite code
CREATE OR REPLACE FUNCTION public.join_pair(_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pair public.pairs;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_pair FROM public.pairs WHERE invite_code = upper(_code) AND archived = false;
  IF v_pair.id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  IF v_pair.user1_id = auth.uid() OR v_pair.user2_id = auth.uid() THEN
    UPDATE public.profiles SET active_pair_id = v_pair.id WHERE id = auth.uid();
    RETURN v_pair.id;
  END IF;
  IF v_pair.user2_id IS NOT NULL THEN RAISE EXCEPTION 'This pair is already full'; END IF;
  UPDATE public.pairs SET user2_id = auth.uid() WHERE id = v_pair.id;
  UPDATE public.profiles SET active_pair_id = v_pair.id WHERE id = auth.uid();
  RETURN v_pair.id;
END $$;

CREATE OR REPLACE FUNCTION public.switch_active_pair(_pair_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_pair_member(_pair_id, auth.uid()) THEN RAISE EXCEPTION 'Not a member'; END IF;
  UPDATE public.profiles SET active_pair_id = _pair_id WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.archive_pair(_pair_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_next uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_pair_member(_pair_id, auth.uid()) THEN RAISE EXCEPTION 'Not a member'; END IF;
  UPDATE public.pairs SET archived = true WHERE id = _pair_id;
  SELECT id INTO v_next FROM public.pairs
    WHERE archived = false AND (user1_id = auth.uid() OR user2_id = auth.uid())
    ORDER BY created_at DESC LIMIT 1;
  UPDATE public.profiles SET active_pair_id = v_next WHERE id = auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION public.create_pair() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_pair(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_active_pair(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_pair(uuid) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pairs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.habits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.habit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
