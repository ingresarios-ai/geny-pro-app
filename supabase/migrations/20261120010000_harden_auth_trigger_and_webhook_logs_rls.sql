-- Harden auth trigger (ignore client-writable raw_user_meta_data for roles/status) and restrict webhook_logs_select strictly to admins
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_pending public.pending_memberships%ROWTYPE;
  v_has_pending boolean := false;
  v_role text := 'student';
  v_name text := 'Trader';
  v_phone text := '';
  v_country text := '';
  v_status text := 'inactive';
  v_source text := 'manual';
  v_plan text := 'Geny Pro';
BEGIN
  v_email := lower(trim(COALESCE(NEW.email, '')));

  SELECT * INTO v_pending
  FROM public.pending_memberships
  WHERE email = v_email
  LIMIT 1;

  IF FOUND THEN
    v_has_pending := true;
    v_role := v_pending.role;
    v_name := left(
      COALESCE(
        NULLIF(trim(v_pending.full_name), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(split_part(v_email, '@', 1), ''),
        'Trader'
      ),
      80
    );
    v_phone := left(COALESCE(NULLIF(trim(v_pending.phone), ''), COALESCE(NEW.raw_user_meta_data->>'phone', '')), 30);
    v_country := left(COALESCE(NULLIF(trim(v_pending.country), ''), COALESCE(NEW.raw_user_meta_data->>'country', '')), 40);
    v_status := v_pending.status;
    v_source := v_pending.source;
    v_plan := v_pending.plan_name;
  ELSE
    -- Never trust client-writable raw_user_meta_data for role or membership status.
    -- Only server-only raw_app_meta_data (service_role) is trusted when pending_memberships has no row.
    v_role := CASE
      WHEN COALESCE(NEW.raw_app_meta_data->>'role', '') IN ('admin', 'mentor', 'student')
      THEN NEW.raw_app_meta_data->>'role'
      ELSE 'student'
    END;
    v_name := left(
      COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(split_part(v_email, '@', 1), ''),
        'Trader'
      ),
      80
    );
    v_phone := left(COALESCE(NEW.raw_user_meta_data->>'phone', ''), 30);
    v_country := left(COALESCE(NEW.raw_user_meta_data->>'country', ''), 40);
    IF v_role IN ('admin', 'mentor') OR COALESCE(NEW.raw_app_meta_data->>'membership_active', '') = 'true' THEN
      v_status := 'active';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, country, role, consent_at)
  VALUES (NEW.id, v_email, v_name, v_phone, v_country, v_role, now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, 'Trader'), EXCLUDED.full_name);

  INSERT INTO public.memberships (
    user_id, status, source, plan_name,
    external_customer_id, external_subscription_id, external_order_id,
    buyer_email, starts_at, expires_at, grace_until, notes
  )
  VALUES (
    NEW.id,
    v_status,
    v_source,
    v_plan,
    CASE WHEN v_has_pending THEN v_pending.external_customer_id ELSE NULL END,
    CASE WHEN v_has_pending THEN v_pending.external_subscription_id ELSE NULL END,
    CASE WHEN v_has_pending THEN v_pending.external_order_id ELSE NULL END,
    v_email,
    now(),
    CASE WHEN v_has_pending THEN v_pending.expires_at ELSE NULL END,
    CASE WHEN v_has_pending THEN v_pending.grace_until ELSE NULL END,
    CASE WHEN v_has_pending THEN v_pending.notes ELSE '' END
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_app_state (user_id, state, is_demo)
  VALUES (NEW.id, '{}'::jsonb, true)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_has_pending THEN
    UPDATE public.pending_memberships
    SET claimed_by = NEW.id, claimed_at = now()
    WHERE id = v_pending.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS webhook_logs_select ON public.webhook_logs;
CREATE POLICY webhook_logs_select ON public.webhook_logs
  FOR SELECT TO authenticated
  USING (private.is_admin());
