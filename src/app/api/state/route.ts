import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { evaluateMembershipAccess, extractMetricsFromState } from '@/lib/membership';
import { dispatchToGhl } from '@/lib/ghl';
import type { Json } from '@/lib/database.types';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const [{ data: profile }, { data: membership }, { data: appState }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('memberships').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_app_state').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  const access = evaluateMembershipAccess(profile, membership);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason, code: 'membership_inactive' }, { status: 403 });
  }

  return NextResponse.json({
    exists: Boolean(appState && appState.state && Object.keys(appState.state as object).length > 0),
    state: appState?.state ?? null,
    profile,
    membership: membership
      ? { status: membership.status, source: membership.source, plan_name: membership.plan_name, expires_at: membership.expires_at }
      : null,
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const text = await request.text();
  if (text.length > 1_800_000) {
    return NextResponse.json({ error: 'Estado demasiado grande' }, { status: 413 });
  }

  let body: { state?: Record<string, unknown>; currentModule?: string; clientDate?: string };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const rawState = (body.state && typeof body.state === 'object' ? body.state : body) as Record<
    string,
    unknown
  >;
  const currentModule = String(body.currentModule || 'inicio').slice(0, 30);

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('memberships').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  const access = evaluateMembershipAccess(profile, membership);
  if (!access.allowed || !profile) {
    return NextResponse.json({ error: access.reason, code: 'membership_inactive' }, { status: 403 });
  }

  const rawClientDate = typeof body.clientDate === 'string' ? body.clientDate.trim() : '';
  const validClientDate =
    /^\d{4}-\d{2}-\d{2}$/.test(rawClientDate) &&
    Math.abs(Date.parse(rawClientDate + 'T12:00:00Z') - Date.now()) <= 36 * 3600 * 1000;
  const todayStr = validClientDate ? rawClientDate : new Date().toISOString().slice(0, 10);
  const isNewActiveDay = profile.last_active_date !== todayStr;
  const nextActiveDays = (profile.active_days_count || 0) + (isNewActiveDay ? 1 : 0);

  const metrics = extractMetricsFromState(rawState, nextActiveDays);

  // Update user_app_state
  const statePayload = {
    user_id: user.id,
    state: rawState as Json,
    is_demo: metrics.is_demo,
    diag_completed: metrics.diag_completed,
    reto21_closed_days: metrics.reto21_closed_days,
    trades_count: metrics.trades_count,
    total_pnl: metrics.total_pnl,
    win_rate: metrics.win_rate,
    plan_adherence: metrics.plan_adherence,
    movements_count: metrics.movements_count,
    savings_rate: metrics.savings_rate,
    goals_count: metrics.goals_count,
    checkins_count: metrics.checkins_count,
    mindset_sessions_count: metrics.mindset_sessions_count,
    saved_strategies_count: metrics.saved_strategies_count,
    radar_scans_count: metrics.radar_scans_count,
    ideas_built_count: metrics.ideas_built_count,
    geny_messages_count: metrics.geny_messages_count,
    general_score: metrics.general_score,
  };

  const { error: stateErr } = await supabase
    .from('user_app_state')
    .upsert(statePayload, { onConflict: 'user_id' });

  if (stateErr) {
    return NextResponse.json({ error: stateErr.message }, { status: 500 });
  }

  // Update profile tracking columns
  const updatedProfileFields = {
    stage: metrics.stage,
    ranking_alias: metrics.ranking_alias || profile.ranking_alias,
    ranking_opt_in: metrics.ranking_opt_in,
    active_days_count: nextActiveDays,
    last_active_date: todayStr,
    last_active_at: new Date().toISOString(),
    last_module: currentModule,
    ...(metrics.display_name && metrics.display_name !== 'Trader'
      ? { full_name: metrics.display_name }
      : {}),
  };

  const { error: profErr } = await supabase
    .from('profiles')
    .update(updatedProfileFields)
    .eq('id', user.id);

  if (profErr) {
    console.error('Error updating profile:', profErr);
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // Check and record unlocked milestones + daily activity heartbeat
  const dbAdmin = createAdminClient() || supabase;
  const { data: existingEvents } = await supabase
    .from('user_events')
    .select('event_name, created_at')
    .eq('user_id', user.id);

  const seenSet = new Set((existingEvents || []).map((e) => e.event_name));
  const eventsToEmit: string[] = [];

  if (!seenSet.has('registro')) {
    eventsToEmit.push('registro');
  }
  for (const milestone of metrics.unlockedMilestones) {
    if (!seenSet.has(milestone)) {
      eventsToEmit.push(milestone);
    }
  }
  if (isNewActiveDay && eventsToEmit.length === 0) {
    eventsToEmit.push('actividad');
  }

  if (eventsToEmit.length > 0) {
    const adminOnly = createAdminClient();
    const { data: settings } = adminOnly
      ? await adminOnly.from('app_settings').select('*').eq('id', 1).maybeSingle()
      : { data: null };

    const mergedProfile = {
      ...profile,
      ...updatedProfileFields,
    };

    for (const evName of eventsToEmit) {
      const { data: insertedEv, error: evErr } = await dbAdmin
        .from('user_events')
        .insert({
          user_id: user.id,
          email: profile.email,
          event_date: todayStr,
          event_name: evName,
          stage: metrics.stage,
          module: currentModule,
          payload: {
            progreso_general: metrics.general_score,
            reto21_dias: metrics.reto21_closed_days,
            operaciones: metrics.trades_count,
          } as Json,
        })
        .select('id')
        .maybeSingle();

      // Skip GHL dispatch if unique index caught a concurrent duplicate milestone
      if (!evErr && insertedEv && adminOnly) {
        await dispatchToGhl({
          db: adminOnly,
          settings,
          profile: mergedProfile,
          membership,
          stateSummary: statePayload,
          eventName: evName,
          category: 'milestone',
          userEventId: insertedEv.id,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, stage: metrics.stage });
}

