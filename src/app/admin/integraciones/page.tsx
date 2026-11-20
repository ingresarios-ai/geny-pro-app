import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient, hasServiceRole } from '@/lib/supabase/server';
import { IntegrationsClient } from '@/components/IntegrationsClient';
import { resolvePublicAppUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

export default async function AdminIntegracionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: viewer } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id || '')
    .maybeSingle();

  if (viewer?.role !== 'admin') {
    redirect('/admin');
  }

  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const detectedOrigin = resolvePublicAppUrl(`${proto}://${host}`);

  const [{ data: settings }, { data: logs }] = await Promise.all([
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  const secretFlags = {
    hasHotmartHottok: Boolean(settings?.hotmart_hottok),
    hasWhopSecret: Boolean(settings?.whop_webhook_secret),
    hasGeminiApiKey: Boolean(settings?.gemini_api_key?.trim()),
    hasAnthropicApiKey: Boolean(settings?.anthropic_api_key?.trim()),
    hasFmpApiKey: Boolean(settings?.fmp_api_key?.trim()),
  };

  const maskedSettings = settings
    ? {
        ...settings,
        hotmart_hottok: '',
        whop_webhook_secret: '',
        gemini_api_key: '',
        anthropic_api_key: '',
        fmp_api_key: '',
      }
    : null;

  const envStatus = {
    supabaseServiceRole: hasServiceRole(),
    geminiApiKey: Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()),
    anthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    fmpApiKey: Boolean(process.env.FMP_API_KEY?.trim()),
  };

  return (
    <IntegrationsClient
      isAdmin={true}
      appOrigin={detectedOrigin}
      initialSettings={maskedSettings}
      secretFlags={secretFlags}
      initialLogs={logs || []}
      envStatus={envStatus}
    />
  );
}

