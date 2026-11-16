import type { MembershipRow, ProfileRow } from '@/lib/database.types';

export interface MembershipAccessEvaluation {
  allowed: boolean;
  isGracePeriod: boolean;
  graceEndsAt: string | null;
  status: string;
  statusLabel: string;
  source: string;
  reason: string;
}

export const STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  past_due: 'Pago pendiente (en período de gracia)',
  canceled: 'Cancelada',
  expired: 'Vencida',
  refunded: 'Reembolsada',
  paused: 'Pausada',
  inactive: 'Sin membresía activa',
};

export function evaluateMembershipAccess(
  profile: Pick<ProfileRow, 'role'> | null,
  membership: Pick<MembershipRow, 'status' | 'source' | 'expires_at' | 'grace_until'> | null
): MembershipAccessEvaluation {
  if (profile && (profile.role === 'admin' || profile.role === 'mentor')) {
    return {
      allowed: true,
      isGracePeriod: false,
      graceEndsAt: null,
      status: 'active',
      statusLabel: profile.role === 'admin' ? 'Administrador' : 'Mentor',
      source: membership?.source || 'manual',
      reason: 'Rol administrativo',
    };
  }

  if (!membership) {
    return {
      allowed: false,
      isGracePeriod: false,
      graceEndsAt: null,
      status: 'inactive',
      statusLabel: STATUS_LABELS.inactive,
      source: 'manual',
      reason: 'No encontramos una membresía asociada a este correo.',
    };
  }

  const now = Date.now();
  const status = membership.status || 'inactive';
  const source = membership.source || 'manual';

  if (status === 'active') {
    if (membership.expires_at && new Date(membership.expires_at).getTime() <= now) {
      return {
        allowed: false,
        isGracePeriod: false,
        graceEndsAt: null,
        status: 'expired',
        statusLabel: STATUS_LABELS.expired,
        source,
        reason: 'Tu período de membresía ha finalizado.',
      };
    }
    return {
      allowed: true,
      isGracePeriod: false,
      graceEndsAt: null,
      status: 'active',
      statusLabel: STATUS_LABELS.active,
      source,
      reason: 'Membresía activa',
    };
  }

  if (status === 'past_due') {
    if (membership.grace_until && new Date(membership.grace_until).getTime() > now) {
      return {
        allowed: true,
        isGracePeriod: true,
        graceEndsAt: membership.grace_until,
        status: 'past_due',
        statusLabel: STATUS_LABELS.past_due,
        source,
        reason: 'Pago pendiente dentro del período de gracia.',
      };
    }
    return {
      allowed: false,
      isGracePeriod: false,
      graceEndsAt: membership.grace_until,
      status: 'past_due',
      statusLabel: 'Suspendida por falta de pago',
      source,
      reason: 'El período de gracia para actualizar tu pago ha vencido.',
    };
  }

  const reasons: Record<string, string> = {
    canceled: 'Tu suscripción fue cancelada.',
    expired: 'Tu membresía ha expirado.',
    refunded: 'El acceso fue revocado por reembolso o contracargo.',
    paused: 'Tu membresía se encuentra pausada temporalmente.',
    inactive: 'Esta cuenta aún no tiene una membresía activa.',
  };

  return {
    allowed: false,
    isGracePeriod: false,
    graceEndsAt: null,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    source,
    reason: reasons[status] || 'Membresía inactiva.',
  };
}

export interface ExtractedStudentMetrics {
  is_demo: boolean;
  diag_completed: boolean;
  reto21_closed_days: number;
  trades_count: number;
  total_pnl: number;
  win_rate: number;
  plan_adherence: number;
  movements_count: number;
  savings_rate: number;
  goals_count: number;
  checkins_count: number;
  mindset_sessions_count: number;
  saved_strategies_count: number;
  radar_scans_count: number;
  ideas_built_count: number;
  geny_messages_count: number;
  general_score: number;
  stage: string;
  ranking_alias: string;
  ranking_opt_in: boolean;
  display_name: string;
  unlockedMilestones: string[];
}

function calcTradePnl(t: Record<string, unknown>): number {
  const entrada = Number(t.entrada || 0);
  const salida = Number(t.salida || 0);
  const cantidad = Number(t.cantidad || 0);
  const mult = Number(t.mult || 1) || 1;
  const comision = Number(t.comision || 0) || 0;
  if (t.pnlManual != null && !(entrada > 0 && salida > 0)) {
    return Number(t.pnlManual) - comision;
  }
  const dirFactor = t.dir === 'short' ? -1 : 1;
  return (salida - entrada) * cantidad * mult * dirFactor - comision;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toLocaleDateString('en-CA');
}

export function extractMetricsFromState(
  raw: Record<string, unknown> | null | undefined,
  activeDaysCount: number
): ExtractedStudentMetrics {
  const s = raw || {};
  const isDemo = Boolean(s.ejemplo);
  const diag = (s.diag as Record<string, unknown>) || {};
  const diagCompleted = Boolean(diag.hecho);

  const movs = Array.isArray(s.movs) ? (s.movs as Record<string, unknown>[]) : [];
  const trades = Array.isArray(s.trades) ? (s.trades as Record<string, unknown>[]) : [];
  const metas = Array.isArray(s.metas) ? (s.metas as Record<string, unknown>[]) : [];
  const sesiones = Array.isArray(s.sesiones) ? (s.sesiones as Record<string, unknown>[]) : [];
  const estrats = Array.isArray(s.estrats) ? (s.estrats as Record<string, unknown>[]) : [];
  const checks = (s.checks && typeof s.checks === 'object' ? s.checks : {}) as Record<
    string,
    Record<string, unknown>
  >;
  const r21 = (s.r21 && typeof s.r21 === 'object' ? s.r21 : {}) as Record<string, unknown>;
  const r21Dias = (r21.dias && typeof r21.dias === 'object' ? r21.dias : {}) as Record<
    string,
    Record<string, unknown>
  >;
  const jr = (s.jr && typeof s.jr === 'object' ? s.jr : {}) as Record<string, unknown>;
  const jrn = (jr.n && typeof jr.n === 'object' ? jr.n : {}) as Record<string, number>;

  const closedDays = isDemo
    ? 0
    : Object.values(r21Dias).filter((d) => Boolean(d && d.cerrado)).length;

  const ing = movs
    .filter((m) => m.tipo === 'ingreso')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const gas = movs
    .filter((m) => m.tipo === 'gasto')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const aho = movs
    .filter((m) => m.tipo === 'ahorro')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const bal = ing - gas - aho;
  const savingsRate = ing > 0 ? aho / ing : 0;

  const pnls = trades.map(calcTradePnl);
  const wins = pnls.filter((p) => p > 0).length;
  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const winRate = pnls.length ? (wins / pnls.length) * 100 : 0;
  const planRate = pnls.length
    ? trades.filter((t) => Boolean(t.plan)).length / pnls.length
    : 0;
  const docRate = pnls.length
    ? trades.filter((t) => Boolean(t.nota && t.emo)).length / pnls.length
    : 0;

  const days7 = Array.from({ length: 7 }, (_, i) => isoDateDaysAgo(6 - i));
  const regDays = days7.filter((d) => movs.some((m) => m.fecha === d)).length;
  const finScore = movs.length
    ? clamp100(Math.min(savingsRate / 0.2, 1) * 70 + (regDays / 7) * 30 + (bal >= 0 ? 0 : -15))
    : 0;
  const traScore = pnls.length ? clamp100(planRate * 60 + docRate * 40) : 0;

  const cs7 = days7.map((d) => checks[d]).filter(Boolean);
  const menScore = cs7.length
    ? clamp100(
        (cs7.reduce((acc, c) => {
          const animo = Number(c.animo || 0);
          const energia = Number(c.energia || 0);
          const control = Number(c.control || 0);
          return acc + (animo + energia + control * 2) / 20;
        }, 0) /
          7) *
          100
      )
    : 0;
  const habScore = cs7.length
    ? clamp100(
        (cs7.reduce((acc, c) => {
          const h = (c.h && typeof c.h === 'object' ? c.h : {}) as Record<string, unknown>;
          return acc + Object.values(h).filter(Boolean).length;
        }, 0) /
          42) *
          100
      )
    : 0;

  const generalScore = isDemo ? 0 : Math.round((finScore + traScore + menScore + habScore) / 4);

  const realTrades = isDemo ? 0 : trades.length;
  const realMovs = isDemo ? 0 : movs.length;
  const realMetas = isDemo ? 0 : metas.length;
  const realChecks = isDemo ? 0 : Object.keys(checks).length;
  const realSesiones = isDemo ? 0 : sesiones.length;
  const savedStrategies = estrats.length;
  const radarScans = Number(jrn.radar || 0);
  const ideasBuilt = Number(jrn.armar || 0);
  const genyMsgs = Number(jrn.geny || 0);

  const uso =
    realTrades + realMovs + realChecks + savedStrategies + radarScans + genyMsgs;

  const stage =
    closedDays >= 21
      ? 'Graduado Reto 21'
      : closedDays >= 7 || activeDaysCount >= 10
        ? 'Comprometido'
        : activeDaysCount >= 3 && (closedDays >= 3 || uso >= 5)
          ? 'Constante'
          : diagCompleted || uso > 0
            ? 'Activado'
            : 'Registrado';

  const unlockedMilestones: string[] = [];
  if (diagCompleted) unlockedMilestones.push('diagnostico_completo');
  if (realTrades > 0) unlockedMilestones.push('primera_operacion');
  if (realMovs > 0) unlockedMilestones.push('primer_movimiento');
  if (realChecks > 0) unlockedMilestones.push('primer_checkin');
  if (realMetas > 0) unlockedMilestones.push('primera_meta');
  if (closedDays >= 1) unlockedMilestones.push('reto_dia_1');
  if (closedDays >= 7) unlockedMilestones.push('reto_dia_7');
  if (closedDays >= 14) unlockedMilestones.push('reto_dia_14');
  if (closedDays >= 21) unlockedMilestones.push('reto_completo');
  if (savedStrategies > 0) unlockedMilestones.push('primera_estrategia');
  if (radarScans > 0) unlockedMilestones.push('primer_radar');
  if (ideasBuilt > 0) unlockedMilestones.push('primera_idea_armada');
  if (genyMsgs > 0) unlockedMilestones.push('primera_charla_geny');
  if (activeDaysCount >= 3) unlockedMilestones.push('activo_3_dias');
  if (activeDaysCount >= 7) unlockedMilestones.push('activo_7_dias');
  if (activeDaysCount >= 14) unlockedMilestones.push('activo_14_dias');

  return {
    is_demo: isDemo,
    diag_completed: diagCompleted,
    reto21_closed_days: closedDays,
    trades_count: realTrades,
    total_pnl: isDemo ? 0 : Number(totalPnl.toFixed(2)),
    win_rate: isDemo ? 0 : Number(winRate.toFixed(1)),
    plan_adherence: isDemo ? 0 : Number((planRate * 100).toFixed(1)),
    movements_count: realMovs,
    savings_rate: isDemo ? 0 : Number((savingsRate * 100).toFixed(1)),
    goals_count: realMetas,
    checkins_count: realChecks,
    mindset_sessions_count: realSesiones,
    saved_strategies_count: savedStrategies,
    radar_scans_count: radarScans,
    ideas_built_count: ideasBuilt,
    geny_messages_count: genyMsgs,
    general_score: generalScore,
    stage,
    ranking_alias: typeof s.alias === 'string' ? s.alias.slice(0, 40) : '',
    ranking_opt_in: s.enRanking !== false,
    display_name: typeof s.nombre === 'string' && s.nombre.trim() ? s.nombre.trim().slice(0, 60) : 'Trader',
    unlockedMilestones,
  };
}
