'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  MembershipRow,
  MentorNoteRow,
  ProfileRow,
  UserAppStateRow,
  UserEventRow,
} from '@/lib/database.types';
import { STATUS_LABELS } from '@/lib/membership';
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Trash2,
  CheckCircle2,
  XCircle,
  Save,
} from 'lucide-react';

const DIAG_LABELS: Record<string, [string, string[]]> = {
  registro: ['Registro de gastos', ['Nunca', 'A veces', 'Siempre']],
  ahorro: ['Porcentaje de ahorro', ['Nada', 'Menos del 10 %', '10 a 20 %', 'Más del 20 %']],
  fondo: ['Fondo de emergencia', ['No', '1 a 3 meses', 'Más de 3 meses']],
  exp: ['Experiencia operando', ['Ninguna', 'Menos de 1 año', '1 a 3 años', 'Más de 3 años']],
  plan: ['Plan de trading', ['No', 'En la cabeza', 'Sí, escrito']],
  bit: ['Uso de bitácora', ['No', 'A veces', 'Siempre']],
  perdida: ['Reacción tras pérdida', ['Busco recuperarla rápido', 'Me frustro y paro', 'La analizo con calma']],
  rutina: ['Rutina pre-mercado', ['No', 'A veces', 'Todos los días']],
  sueno: ['Horas de sueño', ['Menos de 6', '6 a 7', 'Más de 7']],
};

const REGLAS_MAP: Record<string, string> = {
  sinstop: 'Operó sin stop',
  movistop: 'Movió el stop',
  sobreop: 'Sobreoperó',
  tamano: 'Tamaño excesivo',
  revancha: 'Revancha',
  fomo: 'Entró por FOMO',
  fuera: 'Fuera de horario/setup',
  riesgo: 'Pasó riesgo máx. del día',
};

export function StudentDossierClient({
  isAdmin,
  profile,
  membership,
  appState,
  events,
  initialNotes,
  aiCountRecent,
}: {
  isAdmin: boolean;
  profile: ProfileRow;
  membership: MembershipRow | null;
  appState: UserAppStateRow | null;
  events: UserEventRow[];
  initialNotes: MentorNoteRow[];
  aiCountRecent: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable membership & account state
  const [fullName, setFullName] = useState(profile.full_name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [country, setCountry] = useState(profile.country);
  const [role, setRole] = useState(profile.role);
  const [aiLimit, setAiLimit] = useState(
    profile.daily_ai_limit_override != null ? String(profile.daily_ai_limit_override) : ''
  );
  const [status, setStatus] = useState(membership?.status || 'inactive');
  const [source, setSource] = useState(membership?.source || 'manual');
  const [expiresAt, setExpiresAt] = useState(
    membership?.expires_at ? membership.expires_at.slice(0, 10) : ''
  );
  const [newPassword, setNewPassword] = useState('');

  // Mentor notes state
  const [notes, setNotes] = useState<MentorNoteRow[]>(initialNotes);
  const [noteText, setNoteText] = useState('');
  const [noteTag, setNoteTag] = useState('seguimiento');

  const rawState = ((appState?.state && typeof appState.state === 'object'
    ? appState.state
    : {}) || {}) as Record<string, unknown>;
  const isDemo = appState ? appState.is_demo : true;
  const trades = Array.isArray(rawState.trades)
    ? (rawState.trades as Array<Record<string, unknown>>)
    : [];
  const metas = Array.isArray(rawState.metas)
    ? (rawState.metas as Array<Record<string, unknown>>)
    : [];
  const pedem = ((rawState.pedem && typeof rawState.pedem === 'object'
    ? rawState.pedem
    : {}) || {}) as Record<string, boolean>;
  const diag = ((rawState.diag && typeof rawState.diag === 'object'
    ? rawState.diag
    : {}) || {}) as Record<string, unknown>;
  const diagResp = ((diag.resp && typeof diag.resp === 'object'
    ? diag.resp
    : {}) || {}) as Record<string, unknown>;
  const r21 = ((rawState.r21 && typeof rawState.r21 === 'object'
    ? rawState.r21
    : {}) || {}) as Record<string, unknown>;
  const r21Dias = ((r21.dias && typeof r21.dias === 'object'
    ? r21.dias
    : {}) || {}) as Record<string, Record<string, unknown>>;

  const brokenRulesCount: Record<string, number> = {};
  Object.values(r21Dias).forEach((d) => {
    if (!d?.cerrado) return;
    const rev = (d.rev as Record<string, unknown>) || {};
    const reglas = Array.isArray(rev.reglas) ? (rev.reglas as string[]) : [];
    reglas.forEach((k) => {
      brokenRulesCount[k] = (brokenRulesCount[k] || 0) + 1;
    });
  });

  const cleanWhatsapp = phone.replace(/[^\d]/g, '');

  async function handleSaveAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          fullName,
          email: email !== profile.email ? email : undefined,
          phone,
          country,
          role,
          dailyAiLimitOverride: aiLimit === '' ? null : Number(aiLimit),
          status,
          source,
          expiresAt: expiresAt ? new Date(expiresAt + 'T23:59:59Z').toISOString() : null,
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudieron guardar los cambios');
      } else {
        setNewPassword('');
        setFeedback('Ficha y membresía actualizadas correctamente.');
        router.refresh();
      }
    } catch {
      setErrorMsg('Error de conexión.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncGhl() {
    setBusy(true);
    setFeedback('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/ghl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'sync_user', userId: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || 'No se pudo enviar a GHL');
      else setFeedback('Estado completo del alumno enviado al Webhook de GHL.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          studentId: profile.id,
          note: noteText,
          tag: noteTag,
        }),
      });
      const data = await res.json();
      if (res.ok && data.note) {
        setNotes((prev) => [data.note, ...prev]);
        setNoteText('');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteNote(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/notes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="vhead" style={{ marginTop: 0 }}>
        <div>
          <Link
            href="/admin/alumnos"
            className="inline muted"
            style={{ fontSize: 13, textDecoration: 'none', marginBottom: 6 }}
          >
            <ArrowLeft size={14} /> Volver al listado de alumnos
          </Link>
          <h1>{profile.full_name}</h1>
          <p>
            {profile.email} · Etapa actual: <b style={{ color: 'var(--lime)' }}>{profile.stage}</b> · Alta:{' '}
            {profile.created_at.slice(0, 10)}
          </p>
        </div>

        <div className="inline">
          {cleanWhatsapp ? (
            <a
              href={`https://wa.me/${cleanWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn sm ghost"
              style={{ borderColor: 'rgba(0,255,148,.45)', color: 'var(--profit)' }}
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          ) : null}
          <button type="button" className="btn sm ghost" onClick={handleSyncGhl} disabled={busy}>
            <Send size={15} /> Sincronizar con GHL
          </button>
        </div>
      </div>

      {feedback ? <p className="r21ok">{feedback}</p> : null}
      {errorMsg ? <p className="r21alert">{errorMsg}</p> : null}

      <div className="adm-kpis">
        <div className="adm-kpi">
          <span className="lbl">Membresía</span>
          <span className="val" style={{ fontSize: 19 }}>
            <span className={`badge ${status}`}>{STATUS_LABELS[status] || status}</span>
          </span>
          <span className="sub">Origen: {source.toUpperCase()}</span>
        </div>

        <div className="adm-kpi">
          <span className="lbl">Progreso General</span>
          <span className="val" style={{ color: 'var(--lime)' }}>
            {appState?.general_score ?? 0}%
          </span>
          <span className="sub">{isDemo ? 'Aún en datos de ejemplo' : 'Con datos propios'}</span>
        </div>

        <div className="adm-kpi">
          <span className="lbl">Reto 21</span>
          <span className="val">{appState?.reto21_closed_days ?? 0}/21</span>
          <span className="sub">{profile.active_days_count} días activos totales</span>
        </div>

        <div className="adm-kpi">
          <span className="lbl">Trading (P&amp;L · Acierto)</span>
          <span className={`val ${(appState?.total_pnl ?? 0) >= 0 ? 'up' : 'down'}`}>
            {(appState?.total_pnl ?? 0) >= 0 ? '+' : '-'}$
            {Math.abs(Number(appState?.total_pnl ?? 0)).toFixed(0)}
          </span>
          <span className="sub">
            {appState?.trades_count ?? 0} trades · WR {appState?.win_rate ?? 0}% · Plan{' '}
            {appState?.plan_adherence ?? 0}%
          </span>
        </div>

        <div className="adm-kpi">
          <span className="lbl">Finanzas &amp; Hábitos</span>
          <span className="val">{appState?.savings_rate ?? 0}%</span>
          <span className="sub">
            Tasa ahorro · {appState?.checkins_count ?? 0} check-ins · {aiCountRecent} msjs IA
          </span>
        </div>
      </div>

      <div className="duo" style={{ marginBottom: 18 }}>
        {/* Panel 1: Gestión de cuenta y membresía */}
        <div className="panel">
          <div className="ph">
            <h2>Cuenta y Membresía</h2>
            {membership?.external_subscription_id ? (
              <span className="tag num">ID: {membership.external_subscription_id}</span>
            ) : null}
          </div>

          <form className="f" onSubmit={handleSaveAccount}>
            <div className="r2">
              <label>
                Nombre
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isAdmin}
                />
              </label>
              <label>
                Correo (login)
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isAdmin}
                />
              </label>
            </div>

            <div className="r2">
              <label>
                WhatsApp
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!isAdmin}
                />
              </label>
              <label>
                País
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={!isAdmin}
                />
              </label>
            </div>

            <div className="r2">
              <label>
                Estado de membresía
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={!isAdmin}
                >
                  <option value="active">Activa</option>
                  <option value="past_due">Pago atrasado (en gracia)</option>
                  <option value="paused">Pausada</option>
                  <option value="canceled">Cancelada</option>
                  <option value="expired">Vencida</option>
                  <option value="refunded">Reembolsada</option>
                  <option value="inactive">Inactiva</option>
                </select>
              </label>

              <label>
                Origen
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  disabled={!isAdmin}
                >
                  <option value="manual">Manual / Beca</option>
                  <option value="hotmart">Hotmart</option>
                  <option value="whop">Whop</option>
                </select>
              </label>
            </div>

            <div className="r2">
              <label>
                Vence el (vacío = sin fecha límite)
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={!isAdmin}
                />
              </label>

              <label>
                Rol
                <select value={role} onChange={(e) => setRole(e.target.value)} disabled={!isAdmin}>
                  <option value="student">Alumno</option>
                  <option value="mentor">Mentor</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
            </div>

            <div className="r2">
              <label>
                Cuota diaria IA personalizada
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={aiLimit}
                  onChange={(e) => setAiLimit(e.target.value)}
                  placeholder="Por defecto global"
                  disabled={!isAdmin}
                />
              </label>

              <label>
                Asignar nueva contraseña (opcional)
                <input
                  type="text"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Solo si deseas cambiarla"
                  disabled={!isAdmin}
                />
              </label>
            </div>

            {isAdmin ? (
              <button type="submit" className="btn sm" disabled={busy} style={{ justifySelf: 'start' }}>
                <Save size={15} /> Guardar cambios
              </button>
            ) : null}
          </form>
        </div>

        {/* Panel 2: Notas privadas del mentor */}
        <div className="panel">
          <div className="ph">
            <h2>Notas de Seguimiento y Mentoría</h2>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Privado para Admins y Mentores
            </span>
          </div>

          <form className="f" onSubmit={handleAddNote} style={{ marginBottom: 14 }}>
            <div className="inline">
              <select
                value={noteTag}
                onChange={(e) => setNoteTag(e.target.value)}
                style={{ width: 150 }}
                aria-label="Etiqueta de nota"
              >
                <option value="seguimiento">Seguimiento</option>
                <option value="logro">Logro / Avance</option>
                <option value="riesgo">Alerta / Riesgo</option>
                <option value="soporte">Soporte / Acceso</option>
              </select>
              <button type="submit" className="btn sm" disabled={busy}>
                Agregar nota
              </button>
            </div>
            <textarea
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Escribe acuerdos de mentoría, observaciones de su bitácora o motivo de contacto…"
              required
            />
          </form>

          <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {notes.length === 0 ? (
              <div className="empty" style={{ padding: 16 }}>
                Aún no hay notas internas para este alumno.
              </div>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                  }}
                >
                  <div className="inline" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="inline" style={{ fontSize: 12 }}>
                      <span className="tag">{n.tag}</span>
                      <span className="muted">
                        por {n.author_name} · {n.created_at.slice(0, 10)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="x"
                      onClick={() => handleDeleteNote(n.id)}
                      aria-label="Eliminar nota"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{n.note}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Diagnóstico, PEDEM y Reto 21 */}
      <div className="duo" style={{ marginBottom: 18 }}>
        <div className="panel">
          <div className="ph">
            <h2>Diagnóstico Inicial y Ciclo PEDEM</h2>
            <span className="tag">{diag.hecho ? 'Diagnóstico completado' : 'Pendiente'}</span>
          </div>

          <div className="inline" style={{ marginBottom: 14 }}>
            {['planear', 'ejecutar', 'documentar', 'evaluar', 'mejorar'].map((k) => (
              <span
                key={k}
                className={`badge ${pedem[k] ? 'active' : ''}`}
                style={{ textTransform: 'capitalize' }}
              >
                {pedem[k] ? '✓ ' : ''}
                {k}
              </span>
            ))}
          </div>

          {Object.keys(diagResp).length === 0 ? (
            <div className="empty" style={{ padding: 16 }}>
              El alumno todavía no responde el cuestionario diagnóstico.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
              {Object.entries(DIAG_LABELS).map(([k, [label, opts]]) => {
                const idx = Number(diagResp[k]);
                if (Number.isNaN(idx) || !opts[idx]) return null;
                return (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '6px 0',
                      borderBottom: '1px solid #141E28',
                    }}
                  >
                    <span className="muted">{label}</span>
                    <b>{opts[idx]}</b>
                  </div>
                );
              })}
              {diagResp.meta ? (
                <div style={{ paddingTop: 6 }}>
                  <span className="muted">Meta principal declarada: </span>
                  <b style={{ color: 'var(--lime)' }}>{String(diagResp.meta)}</b>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="ph">
            <h2>Mapa del Reto 21 y Reglas Rotas</h2>
            <span className="num muted">{appState?.reto21_closed_days ?? 0}/21 cerrados</span>
          </div>

          <div className="days21" style={{ marginBottom: 14 }}>
            {Array.from({ length: 21 }, (_, i) => {
              const dayNum = String(i + 1);
              const d = r21Dias[dayNum];
              const closed = Boolean(d?.cerrado);
              const rev = (d?.rev as Record<string, unknown>) || {};
              return (
                <div
                  key={dayNum}
                  className={`d21 ${closed ? 'on' : ''}`}
                  title={
                    closed
                      ? `Día ${dayNum} (${d?.fecha || ''}) · Disciplina: ${rev.disciplina || '-'}/10`
                      : `Día ${dayNum}: pendiente`
                  }
                >
                  {dayNum}
                </div>
              );
            })}
          </div>

          {Object.keys(brokenRulesCount).length > 0 ? (
            <div>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
                Reglas rotas reportadas por el alumno:
              </div>
              <div className="inline">
                {Object.entries(brokenRulesCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, count]) => (
                    <span key={k} className="badge canceled">
                      {REGLAS_MAP[k] || k}: {count}x
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <p className="hint">Sin reglas rotas registradas o aún en modo ejemplo.</p>
          )}
        </div>
      </div>

      {/* Bitácora reciente y Metas */}
      <div className="duo" style={{ marginBottom: 18 }}>
        <div className="panel">
          <div className="ph">
            <h2>Últimas Operaciones en Bitácora</h2>
            <span className="muted num" style={{ fontSize: 13 }}>
              {isDemo ? 'Modo ejemplo' : `${trades.length} registradas`}
            </span>
          </div>

          {isDemo || trades.length === 0 ? (
            <div className="empty" style={{ padding: 16 }}>
              {isDemo
                ? 'El alumno aún tiene cargados los datos de demostración.'
                : 'Aún no registra operaciones propias.'}
            </div>
          ) : (
            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Operaciones del alumno">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Activo</th>
                    <th>Setup / Plan</th>
                    <th>Emoción</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {trades
                    .slice()
                    .reverse()
                    .slice(0, 15)
                    .map((t, idx) => (
                      <tr key={String(t.id || idx)}>
                        <td className="num">{String(t.fecha || '')}</td>
                        <td>
                          <b>{String(t.activo || '')}</b>{' '}
                          <span className="muted" style={{ fontSize: 12 }}>
                            ({String(t.dir || '')})
                          </span>
                        </td>
                        <td>
                          {String(t.setup || '—')} ·{' '}
                          <span className={t.plan ? 'up' : 'down'}>{t.plan ? 'Plan ✓' : 'Sin plan'}</span>
                        </td>
                        <td>{String(t.emo || '—')}</td>
                        <td className="muted" style={{ maxWidth: 220 }}>
                          {String(t.nota || '—')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="ph">
            <h2>Historial de Hitos del Alumno</h2>
            <span className="muted num" style={{ fontSize: 13 }}>
              {events.length} eventos
            </span>
          </div>

          {events.length === 0 ? (
            <div className="empty" style={{ padding: 16 }}>
              Sin hitos registrados todavía.
            </div>
          ) : (
            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Hitos del alumno">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hito</th>
                    <th>Módulo</th>
                    <th>GHL</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td className="num">
                        {new Date(ev.created_at).toLocaleString('es', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <span className="tag" style={{ color: 'var(--lime)' }}>
                          {ev.event_name}
                        </span>
                      </td>
                      <td className="muted">{ev.module || '—'}</td>
                      <td>
                        {ev.ghl_sent ? (
                          <CheckCircle2 size={15} color="var(--profit)" />
                        ) : ev.ghl_error ? (
                          <span title={ev.ghl_error}>
                            <XCircle size={15} color="var(--loss)" />
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isDemo && metas.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Metas activas ({metas.length})</h3>
              <div style={{ display: 'grid', gap: 6 }}>
                {metas.map((m, idx) => (
                  <div
                    key={String(m.id || idx)}
                    className="inline"
                    style={{ justifyContent: 'space-between', fontSize: 13 }}
                  >
                    <span>{String(m.titulo || '')}</span>
                    <span className="num muted">
                      {Number(m.actual || 0).toLocaleString()} / {Number(m.objetivo || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
