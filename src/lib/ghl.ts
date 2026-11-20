import type { SupabaseClient } from '@supabase/supabase-js';
import { isSafePublicHttpsUrl } from '@/lib/app-url';
import type {
  AppSettingsRow,
  Database,
  Json,
  MembershipRow,
  ProfileRow,
  UserAppStateRow,
} from '@/lib/database.types';

export interface GhlDispatchParams {
  db: SupabaseClient<Database>;
  settings: AppSettingsRow | null;
  profile: Pick<
    ProfileRow,
    | 'id'
    | 'email'
    | 'full_name'
    | 'phone'
    | 'country'
    | 'stage'
    | 'active_days_count'
    | 'last_active_date'
    | 'last_module'
    | 'consent_at'
    | 'created_at'
  >;
  membership?: Pick<MembershipRow, 'status' | 'source' | 'plan_name' | 'expires_at'> | null;
  stateSummary?: Partial<UserAppStateRow> | null;
  eventName: string;
  category: 'milestone' | 'membership' | 'manual';
  userEventId?: string;
  forceSend?: boolean;
  extraPayload?: Record<string, unknown>;
}

export async function dispatchToGhl(params: GhlDispatchParams): Promise<{
  sent: boolean;
  httpStatus: number | null;
  error: string | null;
}> {
  const {
    db,
    settings,
    profile,
    membership,
    stateSummary,
    eventName,
    category,
    userEventId,
    forceSend = false,
    extraPayload,
  } = params;

  const webhookUrl = (
    settings?.ghl_webhook_url ||
    process.env.GHL_WEBHOOK_URL ||
    ''
  ).trim();

  const isEnabled = forceSend || Boolean(settings?.ghl_enabled && webhookUrl);
  if (!webhookUrl || !isEnabled) {
    return { sent: false, httpStatus: null, error: null };
  }

  if (!isSafePublicHttpsUrl(webhookUrl)) {
    return {
      sent: false,
      httpStatus: null,
      error: 'La URL del Webhook de GHL debe ser una URL pública https:// válida',
    };
  }

  if (!forceSend && category === 'milestone' && settings && !settings.ghl_send_milestones) {
    return { sent: false, httpStatus: null, error: null };
  }

  if (
    !forceSend &&
    category === 'membership' &&
    settings &&
    !settings.ghl_send_membership_events
  ) {
    return { sent: false, httpStatus: null, error: null };
  }

  const stage = profile.stage || 'Registrado';
  const tags = [
    'geny-pro',
    `etapa-${stage.toLowerCase().replace(/\s+/g, '-')}`,
    `hito-${eventName}`,
    membership?.source ? `origen-${membership.source}` : null,
    membership?.status ? `membresia-${membership.status}` : null,
  ]
    .filter(Boolean)
    .join(',');

  const payload: Record<string, unknown> = {
    origen: 'geny-pro',
    recibido: new Date().toISOString(),
    uid: profile.id,
    email: profile.email,
    nombre: profile.full_name,
    telefono: profile.phone || '',
    pais: profile.country || '',
    alta: profile.created_at ? profile.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    consentimiento: profile.consent_at || profile.created_at || new Date().toISOString(),
    evento: eventName,
    etapa: stage,
    etiquetas: tags,
    estado_membresia: membership?.status || 'active',
    fuente_membresia: membership?.source || 'manual',
    plan_membresia: membership?.plan_name || 'Geny Pro',
    vence_membresia: membership?.expires_at || '',
    dias_activos: profile.active_days_count || 0,
    ultima_actividad: profile.last_active_date || new Date().toISOString().slice(0, 10),
    ultimo_modulo: profile.last_module || 'inicio',
    diagnostico: stateSummary?.diag_completed ? 'si' : 'no',
    reto21_dias: stateSummary?.reto21_closed_days ?? 0,
    operaciones: stateSummary?.trades_count ?? 0,
    pnl_total: stateSummary?.total_pnl ?? 0,
    win_rate: stateSummary?.win_rate ?? 0,
    movimientos: stateSummary?.movements_count ?? 0,
    metas: stateSummary?.goals_count ?? 0,
    checkins: stateSummary?.checkins_count ?? 0,
    sesiones_mentalidad: stateSummary?.mindset_sessions_count ?? 0,
    estrategias_guardadas: stateSummary?.saved_strategies_count ?? 0,
    escaneos_radar: stateSummary?.radar_scans_count ?? 0,
    ideas_armadas: stateSummary?.ideas_built_count ?? 0,
    mensajes_geny: stateSummary?.geny_messages_count ?? 0,
    progreso_general: stateSummary?.general_score ?? 0,
    ...(extraPayload || {}),
  };

  let httpStatus: number | null = null;
  let responseText = '';
  let errorMsg: string | null = null;
  let delivered = false;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    httpStatus = res.status;
    responseText = (await res.text()).slice(0, 500);
    delivered = res.ok;
    if (!res.ok) {
      errorMsg = `GHL respondió HTTP ${res.status}`;
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message.slice(0, 300) : 'Error de red hacia GHL';
  }

  await db.from('webhook_logs').insert({
    direction: 'outbound',
    provider: 'ghl',
    event_type: eventName,
    email: profile.email,
    user_id: profile.id,
    status: delivered ? 'delivered' : 'failed',
    http_status: httpStatus,
    payload: payload as Json,
    response_body: responseText || null,
    error_message: errorMsg,
  });

  if (userEventId) {
    await db
      .from('user_events')
      .update({
        ghl_sent: delivered,
        ghl_status: httpStatus,
        ghl_error: errorMsg,
      })
      .eq('id', userEventId);
  }

  return { sent: delivered, httpStatus, error: errorMsg };
}

