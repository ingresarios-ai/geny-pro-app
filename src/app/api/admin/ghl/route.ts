import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { dispatchToGhl } from '@/lib/ghl';
import { STATE_SUMMARY_COLS } from '@/lib/membership';

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!adminProfile || !['admin', 'mentor'].includes(adminProfile.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: {
    action?: 'test' | 'retry' | 'sync_user' | 'sync_all';
    logId?: string;
    userId?: string;
    overrideWebhookUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const db = createAdminClient() || supabase;
  const { data: settings } = await db.from('app_settings').select('*').eq('id', 1).maybeSingle();

  const effectiveSettings = settings
    ? {
        ...settings,
        ...(body.overrideWebhookUrl
          ? { ghl_webhook_url: body.overrideWebhookUrl.trim() }
          : {}),
      }
    : null;

  const webhookUrl = (
    effectiveSettings?.ghl_webhook_url ||
    process.env.GHL_WEBHOOK_URL ||
    ''
  ).trim();

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'Configura primero la URL del Webhook de GHL' },
      { status: 400 }
    );
  }

  if (body.action === 'test') {
    const res = await dispatchToGhl({
      db,
      settings: effectiveSettings,
      profile: adminProfile,
      membership: {
        status: 'active',
        source: 'manual',
        plan_name: 'Geny Pro · Prueba Admin',
        expires_at: null,
      },
      stateSummary: {
        diag_completed: true,
        reto21_closed_days: 7,
        trades_count: 12,
        total_pnl: 450.5,
        win_rate: 66.7,
        movements_count: 8,
        goals_count: 3,
        checkins_count: 7,
        mindset_sessions_count: 4,
        saved_strategies_count: 2,
        radar_scans_count: 3,
        ideas_built_count: 2,
        geny_messages_count: 9,
        general_score: 78,
      },
      eventName: 'test_ghl',
      category: 'manual',
      forceSend: true,
      extraPayload: { es_prueba: true },
    });

    if (!res.sent) {
      return NextResponse.json(
        { error: res.error || 'No se pudo entregar a GHL', httpStatus: res.httpStatus },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, httpStatus: res.httpStatus });
  }

  if (body.action === 'retry' && body.logId) {
    const { data: logRow } = await db
      .from('webhook_logs')
      .select('*')
      .eq('id', body.logId)
      .eq('direction', 'outbound')
      .maybeSingle();

    if (!logRow) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    let status: number | null = null;
    let respText = '';
    let errMsg: string | null = null;
    let delivered = false;

    try {
      const r = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(logRow.payload),
        signal: AbortSignal.timeout(10000),
      });
      status = r.status;
      respText = (await r.text()).slice(0, 500);
      delivered = r.ok;
      if (!r.ok) errMsg = `GHL respondió HTTP ${r.status}`;
    } catch (e) {
      errMsg = e instanceof Error ? e.message.slice(0, 300) : 'Error de conexión';
    }

    await db
      .from('webhook_logs')
      .update({
        status: delivered ? 'delivered' : 'failed',
        http_status: status,
        response_body: respText || null,
        error_message: errMsg,
        retry_count: (logRow.retry_count || 0) + 1,
      })
      .eq('id', logRow.id);

    if (!delivered) {
      return NextResponse.json({ error: errMsg || 'Falló el reintento' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, httpStatus: status });
  }

  if (body.action === 'sync_user' && body.userId) {
    const [{ data: prof }, { data: mem }, { data: st }] = await Promise.all([
      db.from('profiles').select('*').eq('id', body.userId).maybeSingle(),
      db.from('memberships').select('*').eq('user_id', body.userId).maybeSingle(),
      db.from('user_app_state').select('*').eq('user_id', body.userId).maybeSingle(),
    ]);

    if (!prof) return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });

    const res = await dispatchToGhl({
      db,
      settings: effectiveSettings,
      profile: prof,
      membership: mem,
      stateSummary: st,
      eventName: 'sync_manual',
      category: 'manual',
      forceSend: true,
    });

    if (!res.sent) {
      return NextResponse.json({ error: res.error || 'Error al enviar a GHL' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'sync_all') {
    if (adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo Administradores pueden sincronizar en lote' }, { status: 403 });
    }

    const [{ data: profiles }, { data: memberships }, { data: states }] = await Promise.all([
      db.from('profiles').select('*').eq('role', 'student').limit(200),
      db.from('memberships').select('*'),
      db.from('user_app_state').select(STATE_SUMMARY_COLS),
    ]);

    const memMap = new Map((memberships || []).map((m) => [m.user_id, m]));
    const stMap = new Map((states || []).map((s) => [s.user_id, s]));

    const eligible = (profiles || [])
      .map((p) => ({ p, m: memMap.get(p.id) }))
      .filter(({ m }) => m && ['active', 'past_due'].includes(m.status));

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < eligible.length; i += 5) {
      const chunk = eligible.slice(i, i + 5);
      const results = await Promise.all(
        chunk.map(({ p, m }) =>
          dispatchToGhl({
            db,
            settings: effectiveSettings,
            profile: p,
            membership: m,
            stateSummary: stMap.get(p.id),
            eventName: 'sync_manual',
            category: 'manual',
            forceSend: true,
          })
        )
      );
      for (const res of results) {
        if (res.sent) sentCount++;
        else failedCount++;
      }
    }

    return NextResponse.json({ ok: true, sentCount, failedCount });
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
}

