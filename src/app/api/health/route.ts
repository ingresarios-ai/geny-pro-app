import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { resolvePublicAppUrl } from '@/lib/app-url';

export async function GET() {
  const admin = createAdminClient();
  const { data: settings } = admin
    ? await admin
        .from('app_settings')
        .select('gemini_api_key, anthropic_api_key, fmp_api_key')
        .eq('id', 1)
        .maybeSingle()
    : { data: null };

  return NextResponse.json({
    ok: true,
    service: 'geny-pro-app',
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      appUrl: Boolean(resolvePublicAppUrl()),
      geminiKey: Boolean(
        settings?.gemini_api_key?.trim() ||
          process.env.GEMINI_API_KEY ||
          process.env.GOOGLE_API_KEY
      ),
      anthropicKey: Boolean(settings?.anthropic_api_key?.trim() || process.env.ANTHROPIC_API_KEY),
      fmpKey: Boolean(settings?.fmp_api_key?.trim() || process.env.FMP_API_KEY),
    },
  });
}

