-- =============================================================================
-- Geny Pro SaaS · Esquema Completo Supabase PostgreSQL 17 + RLS
-- Proyecto: geny-pro-app (jlwrhdlkffxqnwphtrzh)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Esquema privado para funciones internas de seguridad (no expuesto por PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, authenticated, service_role;

-- 1. Tablas Principales
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

-- 2. Funciones de Seguridad en esquema private
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

-- Nota: Las políticas RLS e índices completos ya fueron aplicados en el proyecto geny-pro-app.
