-- Device push tokens (FCM, via @capacitor-firebase/messaging on iOS + Android)
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users manage only their own device tokens; only the service role (edge
-- function) needs to read across users to deliver a push to someone else.
CREATE POLICY device_tokens_select_own ON public.device_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY device_tokens_insert_own ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY device_tokens_update_own ON public.device_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY device_tokens_delete_own ON public.device_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER device_tokens_touch BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens (user_id);

-- Upsert-by-token so re-registering the same physical device on a new
-- account moves the token instead of violating the unique constraint.
CREATE OR REPLACE FUNCTION public.register_device_token(_token text, _platform text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.device_tokens (user_id, token, platform)
  VALUES (auth.uid(), _token, _platform)
  ON CONFLICT (token) DO UPDATE
    SET user_id = auth.uid(), platform = _platform, updated_at = now();
END $$;
GRANT EXECUTE ON FUNCTION public.register_device_token(text, text) TO authenticated;
