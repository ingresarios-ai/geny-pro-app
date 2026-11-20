-- Allow Admin Panel (/admin/integraciones) to store optional Gemini, Anthropic and FMP API keys
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS gemini_api_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS anthropic_api_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fmp_api_key text NOT NULL DEFAULT '';
