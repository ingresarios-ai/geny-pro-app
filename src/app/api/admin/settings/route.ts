import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Solo Administradores pueden modificar integraciones' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const patch: Database['public']['Tables']['app_settings']['Update'] = {
    ghl_enabled: Boolean(body.ghl_enabled),
    ghl_webhook_url: String(body.ghl_webhook_url ?? '').trim(),
    ghl_send_milestones: body.ghl_send_milestones !== false,
    ghl_send_membership_events: body.ghl_send_membership_events !== false,
    hotmart_enabled: body.hotmart_enabled !== false,
    whop_enabled: body.whop_enabled !== false,
    renewal_url_hotmart: String(body.renewal_url_hotmart ?? '').trim(),
    renewal_url_whop: String(body.renewal_url_whop ?? '').trim(),
    support_whatsapp_url: String(body.support_whatsapp_url ?? '').trim(),
    privacy_url: String(body.privacy_url ?? '').trim(),
    grace_days: Math.max(0, Math.min(30, Number(body.grace_days ?? 3) || 0)),
    default_ai_daily_limit: Math.max(
      0,
      Math.min(1000, Number(body.default_ai_daily_limit ?? 40) || 40)
    ),
    ai_model: String(body.ai_model || 'claude-haiku-4-5').trim(),
  };

  const nextHottok = String(body.hotmart_hottok ?? '').trim();
  if (body.clear_hotmart_hottok === true) {
    patch.hotmart_hottok = '';
  } else if (nextHottok !== '') {
    patch.hotmart_hottok = nextHottok;
  }

  const nextWhopSecret = String(body.whop_webhook_secret ?? '').trim();
  if (body.clear_whop_secret === true) {
    patch.whop_webhook_secret = '';
  } else if (nextWhopSecret !== '') {
    patch.whop_webhook_secret = nextWhopSecret;
  }

  const { error } = await supabase.from('app_settings').update(patch).eq('id', 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
