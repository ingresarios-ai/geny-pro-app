import { headers } from 'next/headers';
import { createClient, hasServiceRole } from '@/lib/supabase/server';
import { IntegrationsClient } from '@/components/IntegrationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminIntegracionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const detectedOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || `${proto}://${host}`;

  const [{ data: viewer }, { data: settings }, { data: logs }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user?.id || '').maybeSingle(),
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  const envStatus = {
    supabaseServiceRole: hasServiceRole(),
    anthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    fmpApiKey: Boolean(process.env.FMP_API_KEY?.trim()),
  };

  return (
    <IntegrationsClient
      isAdmin={viewer?.role === 'admin'}
      appOrigin={detectedOrigin}
      initialSettings={settings}
      initialLogs={logs || []}
      envStatus={envStatus}
    />
  );
}
