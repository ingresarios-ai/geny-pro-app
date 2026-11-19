-- =============================================================================
-- Geny Pro SaaS · Esquema Completo Supabase PostgreSQL 17 + RLS
-- Proyecto: geny-pro-app (jlwrhdlkffxqnwphtrzh)
-- Archivo reproducible completo (tablas, índices, triggers, funciones y RLS)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Esquema privado para funciones SECURITY DEFINER (no expuesto por PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, authenticated, service_role;

-- 1. Tablas Principales (11 tablas)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT 'Trader',
  phone text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'mentor', 'admin')),
  stage text NOT NULL DEFAULT 'Registrado',
  ranking_alias text NOT NULL DEFAULT '',
  ranking_opt_in boolean NOT NULL DEFAULT true,
  active_days_count integer NOT NULL DEFAULT 0,
  last_active_date date,
  last_active_at timestamptz,
  last_module text NOT NULL DEFAULT 'inicio',
  daily_ai_limit_override integer CHECK (daily_ai_limit_override IS NULL OR daily_ai_limit_override >= 0),
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'past_due', 'canceled', 'expired', 'refunded', 'paused', 'inactive')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('hotmart', 'whop', 'manual')),
  plan_name text NOT NULL DEFAULT 'Geny Pro',
  external_customer_id text,
  external_subscription_id text,
  external_order_id text,
  buyer_email text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  grace_until timestamptz,
  canceled_at timestamptz,
  notes text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pending_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'mentor', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'expired', 'refunded', 'paused', 'inactive')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('hotmart', 'whop', 'manual')),
  plan_name text NOT NULL DEFAULT 'Geny Pro',
  external_customer_id text,
  external_subscription_id text,
  external_order_id text,
  expires_at timestamptz,
  grace_until timestamptz,
  notes text NOT NULL DEFAULT '',
  claimed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_app_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT true,
  diag_completed boolean NOT NULL DEFAULT false,
  reto21_closed_days integer NOT NULL DEFAULT 0,
  trades_count integer NOT NULL DEFAULT 0,
  total_pnl numeric(14,2) NOT NULL DEFAULT 0,
  win_rate numeric(5,2) NOT NULL DEFAULT 0,
  plan_adherence numeric(5,2) NOT NULL DEFAULT 0,
  movements_count integer NOT NULL DEFAULT 0,
  savings_rate numeric(6,2) NOT NULL DEFAULT 0,
  goals_count integer NOT NULL DEFAULT 0,
  checkins_count integer NOT NULL DEFAULT 0,
  mindset_sessions_count integer NOT NULL DEFAULT 0,
  saved_strategies_count integer NOT NULL DEFAULT 0,
  radar_scans_count integer NOT NULL DEFAULT 0,
  ideas_built_count integer NOT NULL DEFAULT 0,
  geny_messages_count integer NOT NULL DEFAULT 0,
  general_score integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ranking_entries (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  alias text NOT NULL DEFAULT 'Trader anónimo',
  r_total numeric(10,2) NOT NULL DEFAULT 0,
  pnl numeric(14,2) NOT NULL DEFAULT 0,
  wr integer NOT NULL DEFAULT 0,
  dis numeric(4,1),
  dias integer NOT NULL DEFAULT 0,
  n integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  event_name text NOT NULL,
  stage text,
  module text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ghl_sent boolean NOT NULL DEFAULT false,
  ghl_status integer,
  ghl_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mentor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT 'Admin',
  note text NOT NULL,
  tag text NOT NULL DEFAULT 'seguimiento' CHECK (tag IN ('seguimiento', 'riesgo', 'logro', 'soporte')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ghl_enabled boolean NOT NULL DEFAULT false,
  ghl_webhook_url text NOT NULL DEFAULT '',
  ghl_send_milestones boolean NOT NULL DEFAULT true,
  ghl_send_membership_events boolean NOT NULL DEFAULT true,
  hotmart_enabled boolean NOT NULL DEFAULT true,
  hotmart_hottok text NOT NULL DEFAULT '',
  whop_enabled boolean NOT NULL DEFAULT true,
  whop_webhook_secret text NOT NULL DEFAULT '',
  renewal_url_hotmart text NOT NULL DEFAULT '',
  renewal_url_whop text NOT NULL DEFAULT '',
  support_whatsapp_url text NOT NULL DEFAULT '',
  privacy_url text NOT NULL DEFAULT '',
  grace_days integer NOT NULL DEFAULT 3 CHECK (grace_days >= 0 AND grace_days <= 30),
  default_ai_daily_limit integer NOT NULL DEFAULT 40 CHECK (default_ai_daily_limit >= 0 AND default_ai_daily_limit <= 1000),
  ai_model text NOT NULL DEFAULT 'claude-haiku-4-5',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portal_links (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  renewal_url_hotmart text NOT NULL DEFAULT '',
  renewal_url_whop text NOT NULL DEFAULT '',
  support_whatsapp_url text NOT NULL DEFAULT '',
  privacy_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  provider text NOT NULL CHECK (provider IN ('hotmart', 'whop', 'ghl')),
  event_type text NOT NULL,
  external_event_id text,
  email text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('processed', 'delivered', 'failed', 'ignored')),
  http_status integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_body text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.market_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Índices de rendimiento y unicidad
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_stage ON public.profiles(stage);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_source ON public.memberships(source);
CREATE INDEX IF NOT EXISTS idx_memberships_updated_by ON public.memberships(updated_by);
CREATE INDEX IF NOT EXISTS idx_memberships_ext_sub ON public.memberships(external_subscription_id) WHERE external_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_memberships_claimed_by ON public.pending_memberships(claimed_by);
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON public.user_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON public.user_events(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_events_unique_milestone
  ON public.user_events(user_id, event_name)
  WHERE user_id IS NOT NULL
    AND event_name NOT IN ('actividad', 'login', 'compra_aprobada', 'renovacion', 'renovacion_cancelada', 'membresia_actualizada', 'membresia_cancelada', 'membresia_reembolsada', 'membresia_vencida', 'pago_atrasado', 'alta_manual_admin', 'test_ghl', 'sync_manual');
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_events_daily_activity
  ON public.user_events(user_id, event_date)
  WHERE user_id IS NOT NULL AND event_name = 'actividad';
CREATE INDEX IF NOT EXISTS idx_mentor_notes_student_id ON public.mentor_notes(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_notes_author_id ON public.mentor_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON public.webhook_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_user_id ON public.webhook_logs(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_idempotency
  ON public.webhook_logs(provider, external_event_id)
  WHERE direction = 'inbound' AND external_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage_logs(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_market_cache_expires ON public.market_cache(expires_at);

-- 3. Trigger Helper updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.memberships;
CREATE TRIGGER trg_memberships_updated_at BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_pending_memberships_updated_at ON public.pending_memberships;
CREATE TRIGGER trg_pending_memberships_updated_at BEFORE UPDATE ON public.pending_memberships FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_user_app_state_updated_at ON public.user_app_state;
CREATE TRIGGER trg_user_app_state_updated_at BEFORE UPDATE ON public.user_app_state FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_ranking_entries_updated_at ON public.ranking_entries;
CREATE TRIGGER trg_ranking_entries_updated_at BEFORE UPDATE ON public.ranking_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Funciones de Seguridad en esquema private
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(private.current_user_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION private.is_admin_or_mentor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(private.current_user_role() IN ('admin', 'mentor'), false);
$$;

CREATE OR REPLACE FUNCTION private.has_active_membership()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.memberships m ON m.user_id = p.id
    WHERE p.id = (SELECT auth.uid())
      AND (
        p.role IN ('admin', 'mentor')
        OR (m.status = 'active' AND (m.expires_at IS NULL OR m.expires_at > now()))
        OR (m.status = 'past_due' AND m.grace_until IS NOT NULL AND m.grace_until > now())
      )
  );
$$;

REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin_or_mentor() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_active_membership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin_or_mentor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_active_membership() TO authenticated, service_role;

-- 5. Triggers de Autorización de Nuevos Usuarios, Protección de Columnas y Sincronización de Enlaces
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
    v_name := COALESCE(NULLIF(trim(v_pending.full_name), ''), COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(v_email, '@', 1)));
    v_phone := COALESCE(NULLIF(trim(v_pending.phone), ''), COALESCE(NEW.raw_user_meta_data->>'phone', ''));
    v_country := COALESCE(NULLIF(trim(v_pending.country), ''), COALESCE(NEW.raw_user_meta_data->>'country', ''));
    v_status := v_pending.status;
    v_source := v_pending.source;
    v_plan := v_pending.plan_name;
  ELSE
    v_role := CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', '') IN ('admin', 'mentor', 'student')
      THEN NEW.raw_user_meta_data->>'role'
      ELSE 'student'
    END;
    v_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(v_email, '@', 1), 'Trader');
    v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
    v_country := COALESCE(NEW.raw_user_meta_data->>'country', '');
    IF v_role IN ('admin', 'mentor') OR COALESCE(NEW.raw_user_meta_data->>'membership_active', '') = 'true' THEN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();

CREATE OR REPLACE FUNCTION private.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT private.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.daily_ai_limit_override IS DISTINCT FROM OLD.daily_ai_limit_override
       OR NEW.consent_at IS DISTINCT FROM OLD.consent_at THEN
      RAISE EXCEPTION 'No autorizado para modificar campos administrativos del perfil';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_profile_sensitive_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_profile_sensitive_columns();

CREATE OR REPLACE FUNCTION public.sync_portal_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.portal_links
  SET
    renewal_url_hotmart = NEW.renewal_url_hotmart,
    renewal_url_whop = NEW.renewal_url_whop,
    support_whatsapp_url = NEW.support_whatsapp_url,
    privacy_url = NEW.privacy_url,
    updated_at = now()
  WHERE id = 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_portal_links ON public.app_settings;
CREATE TRIGGER trg_sync_portal_links
  AFTER INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_portal_links();

-- 6. Habilitar Row Level Security en las 11 tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_cache ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS Consolidadas
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR private.is_admin_or_mentor());
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR private.is_admin())
  WITH CHECK (
    private.is_admin()
    OR (
      (SELECT auth.uid()) = id
      AND role = private.current_user_role()
    )
  );

DROP POLICY IF EXISTS memberships_select ON public.memberships;
DROP POLICY IF EXISTS memberships_insert ON public.memberships;
DROP POLICY IF EXISTS memberships_update ON public.memberships;
DROP POLICY IF EXISTS memberships_delete ON public.memberships;
CREATE POLICY memberships_select ON public.memberships
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin_or_mentor());
CREATE POLICY memberships_insert ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY memberships_update ON public.memberships
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
CREATE POLICY memberships_delete ON public.memberships
  FOR DELETE TO authenticated
  USING (private.is_admin());

DROP POLICY IF EXISTS pending_memberships_select ON public.pending_memberships;
DROP POLICY IF EXISTS pending_memberships_insert ON public.pending_memberships;
DROP POLICY IF EXISTS pending_memberships_update ON public.pending_memberships;
DROP POLICY IF EXISTS pending_memberships_delete ON public.pending_memberships;
CREATE POLICY pending_memberships_select ON public.pending_memberships
  FOR SELECT TO authenticated
  USING (private.is_admin_or_mentor());
CREATE POLICY pending_memberships_insert ON public.pending_memberships
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY pending_memberships_update ON public.pending_memberships
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
CREATE POLICY pending_memberships_delete ON public.pending_memberships
  FOR DELETE TO authenticated
  USING (private.is_admin());

DROP POLICY IF EXISTS user_app_state_select ON public.user_app_state;
DROP POLICY IF EXISTS user_app_state_insert ON public.user_app_state;
DROP POLICY IF EXISTS user_app_state_update ON public.user_app_state;
CREATE POLICY user_app_state_select ON public.user_app_state
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id AND private.has_active_membership()) OR private.is_admin_or_mentor());
CREATE POLICY user_app_state_insert ON public.user_app_state
  FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid()) = user_id AND private.has_active_membership()) OR private.is_admin());
CREATE POLICY user_app_state_update ON public.user_app_state
  FOR UPDATE TO authenticated
  USING (((SELECT auth.uid()) = user_id AND private.has_active_membership()) OR private.is_admin())
  WITH CHECK (((SELECT auth.uid()) = user_id AND private.has_active_membership()) OR private.is_admin());

DROP POLICY IF EXISTS ranking_entries_select ON public.ranking_entries;
DROP POLICY IF EXISTS ranking_entries_insert ON public.ranking_entries;
DROP POLICY IF EXISTS ranking_entries_update ON public.ranking_entries;
DROP POLICY IF EXISTS ranking_entries_delete ON public.ranking_entries;
CREATE POLICY ranking_entries_select ON public.ranking_entries
  FOR SELECT TO authenticated
  USING (private.has_active_membership() OR private.is_admin_or_mentor());
CREATE POLICY ranking_entries_insert ON public.ranking_entries
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND private.has_active_membership());
CREATE POLICY ranking_entries_update ON public.ranking_entries
  FOR UPDATE TO authenticated
  USING (((SELECT auth.uid()) = user_id AND private.has_active_membership()) OR private.is_admin())
  WITH CHECK (((SELECT auth.uid()) = user_id AND private.has_active_membership()) OR private.is_admin());
CREATE POLICY ranking_entries_delete ON public.ranking_entries
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin());

DROP POLICY IF EXISTS user_events_select ON public.user_events;
DROP POLICY IF EXISTS user_events_insert ON public.user_events;
DROP POLICY IF EXISTS user_events_update ON public.user_events;
CREATE POLICY user_events_select ON public.user_events
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin_or_mentor());
CREATE POLICY user_events_insert ON public.user_events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id OR private.is_admin());
CREATE POLICY user_events_update ON public.user_events
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS mentor_notes_select ON public.mentor_notes;
DROP POLICY IF EXISTS mentor_notes_insert ON public.mentor_notes;
DROP POLICY IF EXISTS mentor_notes_delete ON public.mentor_notes;
CREATE POLICY mentor_notes_select ON public.mentor_notes
  FOR SELECT TO authenticated
  USING (private.is_admin_or_mentor());
CREATE POLICY mentor_notes_insert ON public.mentor_notes
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_or_mentor());
CREATE POLICY mentor_notes_delete ON public.mentor_notes
  FOR DELETE TO authenticated
  USING (private.is_admin_or_mentor());

DROP POLICY IF EXISTS app_settings_select ON public.app_settings;
DROP POLICY IF EXISTS app_settings_update ON public.app_settings;
CREATE POLICY app_settings_select ON public.app_settings
  FOR SELECT TO authenticated
  USING (private.is_admin());
CREATE POLICY app_settings_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS portal_links_select ON public.portal_links;
DROP POLICY IF EXISTS portal_links_update ON public.portal_links;
CREATE POLICY portal_links_select ON public.portal_links
  FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY portal_links_update ON public.portal_links
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS webhook_logs_select ON public.webhook_logs;
DROP POLICY IF EXISTS webhook_logs_insert ON public.webhook_logs;
DROP POLICY IF EXISTS webhook_logs_update ON public.webhook_logs;
CREATE POLICY webhook_logs_select ON public.webhook_logs
  FOR SELECT TO authenticated
  USING (private.is_admin_or_mentor());
CREATE POLICY webhook_logs_insert ON public.webhook_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY webhook_logs_update ON public.webhook_logs
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS ai_usage_logs_select ON public.ai_usage_logs;
DROP POLICY IF EXISTS ai_usage_logs_insert ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_select ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin_or_mentor());
CREATE POLICY ai_usage_logs_insert ON public.ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id OR private.is_admin());

DROP POLICY IF EXISTS market_cache_select ON public.market_cache;
DROP POLICY IF EXISTS market_cache_insert ON public.market_cache;
DROP POLICY IF EXISTS market_cache_update ON public.market_cache;
CREATE POLICY market_cache_select ON public.market_cache
  FOR SELECT TO authenticated
  USING (private.has_active_membership() OR private.is_admin_or_mentor());
CREATE POLICY market_cache_insert ON public.market_cache
  FOR INSERT TO authenticated
  WITH CHECK (private.has_active_membership() OR private.is_admin_or_mentor());
CREATE POLICY market_cache_update ON public.market_cache
  FOR UPDATE TO authenticated
  USING (private.has_active_membership() OR private.is_admin_or_mentor())
  WITH CHECK (private.has_active_membership() OR private.is_admin_or_mentor());

-- 8. Seeds iniciales
INSERT INTO public.portal_links (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pending_memberships (email, full_name, role, status, source, plan_name, notes)
VALUES ('ingresariostech@gmail.com', 'Admin Ingresarios', 'admin', 'active', 'manual', 'Super Admin', 'Cuenta Super Admin inicial')
ON CONFLICT (email) DO NOTHING;
