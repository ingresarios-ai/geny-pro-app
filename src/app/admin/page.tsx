import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { evaluateMembershipAccess } from '@/lib/membership';
import {
  Users,
  AlertTriangle,
  Award,
  Activity,
  Bot,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const STAGES = [
  'Registrado',
  'Activado',
  'Constante',
  'Comprometido',
  'Graduado Reto 21',
];

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);
  const sevenDaysAgoMs = Date.now() - 7 * 86400000;
  const fiveDaysAgoMs = Date.now() - 5 * 86400000;
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [
    { data: profiles },
    { data: memberships },
    { data: states },
    { data: pending },
    { data: recentEvents },
    { data: aiLogs },
    { data: settings },
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('memberships').select('*'),
    supabase.from('user_app_state').select('*'),
    supabase.from('pending_memberships').select('*').is('claimed_by', null),
    supabase.from('user_events').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('ai_usage_logs').select('usage_date, input_tokens, output_tokens').gte('usage_date', thirtyDaysAgoIso),
    supabase.from('app_settings').select('ghl_enabled, ghl_webhook_url').eq('id', 1).maybeSingle(),
  ]);

  const memMap = new Map((memberships || []).map((m) => [m.user_id, m]));
  const stateMap = new Map((states || []).map((s) => [s.user_id, s]));

  const students = (profiles || []).filter((p) => p.role === 'student');

  let activeCount = 0;
  let hotmartActive = 0;
  let whopActive = 0;
  let manualActive = 0;
  let graceCount = 0;
  let inactiveCount = 0;
  let active7dCount = 0;
  let graduatedCount = 0;

  const stageCounts: Record<string, number> = {
    Registrado: 0,
    Activado: 0,
    Constante: 0,
    Comprometido: 0,
    'Graduado Reto 21': 0,
  };

  const atRiskList: Array<{
    id: string;
    full_name: string;
    email: string;
    phone: string;
    stage: string;
    daysInactive: number | null;
    isGrace: boolean;
    retoDays: number;
  }> = [];

  for (const s of students) {
    const m = memMap.get(s.id) || null;
    const st = stateMap.get(s.id) || null;
    const access = evaluateMembershipAccess(s, m);

    if (access.allowed && !access.isGracePeriod) {
      activeCount++;
      if (m?.source === 'hotmart') hotmartActive++;
      else if (m?.source === 'whop') whopActive++;
      else manualActive++;
    } else if (access.isGracePeriod) {
      graceCount++;
    } else {
      inactiveCount++;
    }

    if (access.allowed) {
      const stageKey = STAGES.includes(s.stage) ? s.stage : 'Registrado';
      stageCounts[stageKey] = (stageCounts[stageKey] || 0) + 1;

      if ((st?.reto21_closed_days || 0) >= 21 || s.stage === 'Graduado Reto 21') {
        graduatedCount++;
      }

      const lastMs = s.last_active_at ? new Date(s.last_active_at).getTime() : 0;
      if (lastMs >= sevenDaysAgoMs) {
        active7dCount++;
      }

      const createdMs = new Date(s.created_at).getTime();
      const isInactive5d =
        (lastMs > 0 && lastMs < fiveDaysAgoMs) ||
        (!lastMs && Date.now() - createdMs > 3 * 86400000);

      if (isInactive5d || access.isGracePeriod) {
        const daysInactive = lastMs
          ? Math.floor((Date.now() - lastMs) / 86400000)
          : Math.floor((Date.now() - createdMs) / 86400000);
        atRiskList.push({
          id: s.id,
          full_name: s.full_name,
          email: s.email,
          phone: s.phone,
          stage: s.stage,
          daysInactive,
          isGrace: access.isGracePeriod,
          retoDays: st?.reto21_closed_days || 0,
        });
      }
    }
  }

  const pendingActiveCount = (pending || []).filter((p) => p.status === 'active').length;
  const aiToday = (aiLogs || []).filter((l) => l.usage_date === todayIso).length;
  const ai30d = (aiLogs || []).length;
  const totalTokens30d = (aiLogs || []).reduce(
    (acc, l) => acc + (l.input_tokens || 0) + (l.output_tokens || 0),
    0
  );

  const totalForFunnel = Math.max(1, activeCount + graceCount);

  return (
    <div>
      <div className="vhead" style={{ marginTop: 0 }}>
        <div>
          <h1>Tablero Ejecutivo</h1>
          <p>
            Vista en tiempo real de membresías, retención, avance del Reto 21 e integraciones con Hotmart, Whop y GHL.
          </p>
        </div>
        <div className="inline">
          <span className={`badge ${settings?.ghl_enabled && settings?.ghl_webhook_url ? 'active' : 'paused'}`}>
            GHL: {settings?.ghl_enabled && settings?.ghl_webhook_url ? 'Conectado y activo' : 'Pausado / Sin configurar'}
          </span>
          <Link href="/admin/alumnos" className="btn sm">
            Gestionar alumnos <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="adm-kpis">
        <div className="adm-kpi">
          <span className="lbl">
            Miembros activos <Users size={16} color="var(--profit)" />
          </span>
          <span className="val up">{activeCount}</span>
          <span className="sub">
            Hotmart: {hotmartActive} · Whop: {whopActive} · Manual: {manualActive}
            {pendingActiveCount ? ` (+${pendingActiveCount} por entrar)` : ''}
          </span>
        </div>

        <div className="adm-kpi">
          <span className="lbl">
            Cobros y bajas <CreditCard size={16} color="var(--amber)" />
          </span>
          <span className="val">
            <span style={{ color: 'var(--amber)' }}>{graceCount}</span>
            <span className="muted" style={{ fontSize: 16 }}> / </span>
            <span className="down" style={{ fontSize: 20 }}>{inactiveCount}</span>
          </span>
          <span className="sub">{graceCount} en gracia · {inactiveCount} inactivos/bajas</span>
        </div>

        <div className="adm-kpi">
          <span className="lbl">
            Activos (7 días) <Activity size={16} color="var(--cyan)" />
          </span>
          <span className="val" style={{ color: 'var(--cyan)' }}>
            {active7dCount}
          </span>
          <span className="sub">
            {activeCount ? `${Math.round((active7dCount / activeCount) * 100)}% de los miembros activos` : 'Sin miembros activos aún'}
          </span>
        </div>

        <div className="adm-kpi">
          <span className="lbl">
            En riesgo (+5d sin uso) <AlertTriangle size={16} color="var(--loss)" />
          </span>
          <span className={`val ${atRiskList.length ? 'down' : ''}`}>{atRiskList.length}</span>
          <span className="sub">Requieren seguimiento o rescate</span>
        </div>

        <div className="adm-kpi">
          <span className="lbl">
            Graduados Reto 21 <Award size={16} color="var(--lime)" />
          </span>
          <span className="val" style={{ color: 'var(--lime)' }}>
            {graduatedCount}
          </span>
          <span className="sub">Completaron los 21 días</span>
        </div>

        <div className="adm-kpi">
          <span className="lbl">
            Mensajes Geny IA <Bot size={16} color="var(--violet)" />
          </span>
          <span className="val">{aiToday}</span>
          <span className="sub">
            Hoy · {ai30d} en 30d ({(totalTokens30d / 1000).toFixed(1)}k tokens)
          </span>
        </div>
      </div>

      <div className="duo" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="ph">
            <h2>Embudo de Progreso de Alumnos</h2>
            <span className="muted num" style={{ fontSize: 13 }}>
              {activeCount + graceCount} con acceso
            </span>
          </div>
          <div className="areas">
            {STAGES.map((st, idx) => {
              const count = stageCounts[st] || 0;
              const pct = Math.round((count / totalForFunnel) * 100);
              const colors = [
                'var(--muted)',
                'var(--cyan)',
                'var(--violet)',
                'var(--amber)',
                'var(--lime)',
              ];
              return (
                <div className="area" key={st}>
                  <div className="lbl">
                    <span>{st}</span>
                    <span className="num">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${pct}%`, background: colors[idx] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="ph">
            <h2>Alumnos que requieren atención</h2>
            <Link href="/admin/alumnos?filter=risk" className="btn sm ghost">
              Ver todos
            </Link>
          </div>
          {atRiskList.length === 0 ? (
            <div className="empty">
              Excelente: ningún miembro activo presenta inactividad prolongada ni cobros pendientes hoy.
            </div>
          ) : (
            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Alumnos en riesgo">
              <table className="stackable">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Motivo</th>
                    <th>Etapa</th>
                    <th className="n">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskList.slice(0, 8).map((r) => (
                    <tr key={r.id}>
                      <th>
                        <div>{r.full_name}</div>
                        <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
                          {r.email}
                        </div>
                      </th>
                      <td data-label="Motivo">
                        {r.isGrace ? (
                          <span className="badge past_due">Pago atrasado</span>
                        ) : (
                          <span className="badge canceled">{r.daysInactive}d sin entrar</span>
                        )}
                      </td>
                      <td data-label="Etapa">
                        {r.stage} · <span className="num">{r.retoDays}/21</span>
                      </td>
                      <td className="n" data-label="Acción">
                        <Link href={`/admin/alumnos/${r.id}`} className="btn sm ghost">
                          Expediente
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <h2>Últimos Hitos y Eventos Registrados</h2>
          <Link href="/admin/integraciones" className="btn sm ghost">
            Monitor de Webhooks y GHL
          </Link>
        </div>

        {!recentEvents || recentEvents.length === 0 ? (
          <div className="empty">Aún no se han registrado eventos de alumnos.</div>
        ) : (
          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Últimos eventos de alumnos">
            <table className="stackable">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Correo</th>
                  <th>Evento / Hito</th>
                  <th>Etapa</th>
                  <th>Envío GHL</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td className="num" data-label="Fecha">
                      {new Date(ev.created_at).toLocaleString('es', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <th scope="row">
                      {ev.user_id ? (
                        <Link
                          href={`/admin/alumnos/${ev.user_id}`}
                          style={{ color: 'var(--fg)', textDecoration: 'underline' }}
                        >
                          {ev.email}
                        </Link>
                      ) : (
                        ev.email
                      )}
                    </th>
                    <td data-label="Evento">
                      <span className="tag" style={{ borderColor: 'rgba(140,255,46,.35)', color: 'var(--lime)' }}>
                        {ev.event_name}
                      </span>
                    </td>
                    <td data-label="Etapa">{ev.stage || '—'}</td>
                    <td data-label="GHL">
                      {ev.ghl_sent ? (
                        <span className="inline" style={{ color: 'var(--profit)', fontSize: 12.5 }}>
                          <CheckCircle2 size={14} /> Enviado
                        </span>
                      ) : ev.ghl_error ? (
                        <span className="inline" style={{ color: 'var(--loss)', fontSize: 12.5 }} title={ev.ghl_error}>
                          <XCircle size={14} /> Error
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: 12.5 }}>
                          Local
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
