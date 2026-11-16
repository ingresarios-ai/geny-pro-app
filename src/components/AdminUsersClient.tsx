'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NativeDialog } from '@/components/NativeDialog';
import { STATUS_LABELS } from '@/lib/membership';
import {
  UserPlus,
  Download,
  Upload,
  Search,
  ExternalLink,
  CheckCircle2,
  PauseCircle,
  Ban,
} from 'lucide-react';

export interface AdminUserRecord {
  id: string;
  pendingId: string | null;
  isPendingClaim: boolean;
  email: string;
  fullName: string;
  phone: string;
  country: string;
  role: string;
  stage: string;
  status: string;
  source: string;
  planName: string;
  expiresAt: string | null;
  graceUntil: string | null;
  activeDays: number;
  lastActiveAt: string | null;
  lastModule: string;
  createdAt: string;
  isDemo: boolean;
  generalScore: number;
  retoDays: number;
  tradesCount: number;
  totalPnl: number;
  winRate: number;
}

const COUNTRIES = [
  'Colombia',
  'México',
  'Estados Unidos',
  'Argentina',
  'Chile',
  'Perú',
  'Ecuador',
  'España',
  'Costa Rica',
  'Panamá',
  'República Dominicana',
  'Guatemala',
  'Uruguay',
  'Bolivia',
  'Otro',
];

export function AdminUsersClient({
  initialRecords,
  isAdmin,
}: {
  initialRecords: AdminUserRecord[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [csvText, setCsvText] = useState('');

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'mentor' | 'admin'>('student');
  const [newSource, setNewSource] = useState<'manual' | 'hotmart' | 'whop'>('manual');
  const [newExpires, setNewExpires] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sendInvite, setSendInvite] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fiveDaysMs = Date.now() - 5 * 86400000;

    return initialRecords.filter((r) => {
      if (q) {
        const hay = `${r.fullName} ${r.email} ${r.phone} ${r.country}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (statusFilter === 'active' && r.status !== 'active') return false;
      if (statusFilter === 'past_due' && r.status !== 'past_due') return false;
      if (
        statusFilter === 'inactive' &&
        !['canceled', 'expired', 'refunded', 'paused', 'inactive'].includes(r.status)
      ) {
        return false;
      }
      if (statusFilter === 'pending_claim' && !r.isPendingClaim) return false;
      if (statusFilter === 'risk') {
        if (r.status !== 'active' && r.status !== 'past_due') return false;
        const lastMs = r.lastActiveAt ? new Date(r.lastActiveAt).getTime() : 0;
        if (lastMs >= fiveDaysMs && r.status !== 'past_due') return false;
      }

      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (stageFilter !== 'all' && r.stage !== stageFilter) return false;

      return true;
    });
  }, [initialRecords, query, statusFilter, sourceFilter, stageFilter]);

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    setFeedback('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: newName,
          email: newEmail,
          phone: newPhone,
          country: newCountry,
          role: newRole,
          status: 'active',
          source: newSource,
          expiresAt: newExpires ? new Date(newExpires + 'T23:59:59Z').toISOString() : null,
          password: newPassword || undefined,
          sendInviteEmail: sendInvite,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.results?.[0]?.ok === false) {
        setErrorMsg(data.error || data.results?.[0]?.error || 'No se pudo dar de alta al usuario.');
        setBusy(false);
        return;
      }

      const r0 = data.results?.[0];
      setCreateOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setFeedback(
        r0?.serviceRoleActive
          ? `Cuenta creada y membresía activada para ${r0.email}.`
          : `Correo ${newEmail} autorizado con membresía activa. Podrá entrar directamente desde /login con código al correo.`
      );
      router.refresh();
    } catch {
      setErrorMsg('Error de red al crear el usuario.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const users = lines
      .map((line) => {
        const sep = line.includes(';') ? ';' : ',';
        const parts = line.split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
        const emailIdx = parts.findIndex((p) => p.includes('@'));
        if (emailIdx === -1) return null;
        return {
          email: parts[emailIdx],
          fullName: emailIdx === 0 ? parts[1] || '' : parts[0] || '',
          phone: parts[2] || '',
          country: parts[3] || '',
          status: 'active' as const,
          source: 'manual' as const,
          sendInviteEmail: false,
        };
      })
      .filter(Boolean);

    if (!users.length) {
      setErrorMsg('No se encontraron correos válidos en el texto pegado.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ users }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Error en importación masiva');
      } else {
        const okCount = (data.results || []).filter((x: { ok: boolean }) => x.ok).length;
        setBulkOpen(false);
        setCsvText('');
        setFeedback(`Se procesaron ${okCount} membresías activas correctamente.`);
        router.refresh();
      }
    } catch {
      setErrorMsg('Error de red al importar.');
    } finally {
      setBusy(false);
    }
  }

  async function quickStatusChange(rec: AdminUserRecord, status: string) {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          rec.isPendingClaim
            ? { pendingId: rec.pendingId, status }
            : { userId: rec.id, status }
        ),
      });
      if (res.ok) {
        setFeedback(`Membresía de ${rec.email} actualizada a ${STATUS_LABELS[status] || status}.`);
        router.refresh();
      } else {
        const j = await res.json();
        setErrorMsg(j.error || 'No se pudo actualizar');
      }
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const headers = [
      'Nombre',
      'Correo',
      'Telefono',
      'Pais',
      'Rol',
      'Estado Membresia',
      'Origen',
      'Vencimiento',
      'Etapa',
      'Dias Activos',
      'Ultima Actividad',
      'Progreso General %',
      'Reto 21 Dias',
      'Operaciones',
      'PnL Total',
      'Win Rate %',
      'Alta',
    ];
    const escCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map((r) =>
      [
        r.fullName,
        r.email,
        r.phone,
        r.country,
        r.role,
        r.status,
        r.source,
        r.expiresAt ? r.expiresAt.slice(0, 10) : 'Sin vencimiento',
        r.stage,
        r.activeDays,
        r.lastActiveAt ? r.lastActiveAt.slice(0, 10) : 'Sin ingreso',
        r.generalScore,
        r.retoDays,
        r.tradesCount,
        r.totalPnl,
        r.winRate,
        r.createdAt.slice(0, 10),
      ]
        .map(escCsv)
        .join(',')
    );

    const bom = '\uFEFF';
    const blob = new Blob([bom + [headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alumnos-geny-pro-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return (
    <div>
      <div className="vhead" style={{ marginTop: 0 }}>
        <div>
          <h1>Alumnos y Membresías</h1>
          <p>
            Administra accesos de Hotmart, Whop y altas manuales, audita el progreso individual y exporta reportes.
          </p>
        </div>

        <div className="inline">
          <button type="button" className="btn sm ghost" onClick={exportCsv}>
            <Download size={15} /> Exportar CSV ({filtered.length})
          </button>
          {isAdmin ? (
            <>
              <button type="button" className="btn sm ghost" onClick={() => setBulkOpen(true)}>
                <Upload size={15} /> Carga masiva
              </button>
              <button type="button" className="btn sm" onClick={() => setCreateOpen(true)}>
                <UserPlus size={15} /> Dar de alta alumno
              </button>
            </>
          ) : null}
        </div>
      </div>

      {feedback ? <p className="r21ok">{feedback}</p> : null}
      {errorMsg ? <p className="r21alert">{errorMsg}</p> : null}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="rd-ctl">
          <label style={{ flex: '1 1 240px' }}>
            Buscar alumno
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre, correo, WhatsApp o país…"
                style={{ width: '100%', paddingLeft: 32 }}
              />
            </div>
          </label>

          <label>
            Estado membresía
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos ({initialRecords.length})</option>
              <option value="active">Activos</option>
              <option value="past_due">Pago atrasado (en gracia)</option>
              <option value="risk">En riesgo (+5d inactivos)</option>
              <option value="pending_claim">Compraron · sin 1er login</option>
              <option value="inactive">Cancelados / Vencidos</option>
            </select>
          </label>

          <label>
            Pasarela / Origen
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="hotmart">Hotmart</option>
              <option value="whop">Whop</option>
              <option value="manual">Manual / Beca</option>
            </select>
          </label>

          <label>
            Etapa académica
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="all">Todas</option>
              <option value="Registrado">Registrado</option>
              <option value="Activado">Activado</option>
              <option value="Constante">Constante</option>
              <option value="Comprometido">Comprometido</option>
              <option value="Graduado Reto 21">Graduado Reto 21</option>
            </select>
          </label>
        </div>
      </div>

      <div className="panel">
        {filtered.length === 0 ? (
          <div className="empty">No hay alumnos que coincidan con esos filtros.</div>
        ) : (
          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Directorio de alumnos y membresías">
            <table className="stackable">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Membresía</th>
                  <th>Etapa y Avance</th>
                  <th className="n">Reto 21</th>
                  <th className="n">Bitácora</th>
                  <th>Última actividad</th>
                  <th className="n">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{r.fullName}</span>
                        {r.role !== 'student' ? (
                          <span className="tag" style={{ color: 'var(--lime)', borderColor: 'var(--lime)' }}>
                            {r.role}
                          </span>
                        ) : null}
                      </div>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
                        {r.email}
                        {r.country ? ` · ${r.country}` : ''}
                      </div>
                    </th>

                    <td data-label="Membresía">
                      <span className={`badge ${r.status}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                        {r.source.toUpperCase()}
                        {r.expiresAt ? ` · vence ${r.expiresAt.slice(0, 10)}` : ''}
                      </div>
                    </td>

                    <td data-label="Etapa">
                      <div>{r.stage}</div>
                      {!r.isPendingClaim ? (
                        <div className="muted num" style={{ fontSize: 12 }}>
                          Score: {r.generalScore}% {r.isDemo ? '(en modo demo)' : ''}
                        </div>
                      ) : null}
                    </td>

                    <td className="n" data-label="Reto 21">
                      {r.isPendingClaim ? '—' : `${r.retoDays}/21`}
                    </td>

                    <td className="n" data-label="Bitácora">
                      {r.isPendingClaim ? (
                        '—'
                      ) : (
                        <>
                          <div>{r.tradesCount} ops</div>
                          <div className={r.totalPnl >= 0 ? 'up' : 'down'} style={{ fontSize: 12 }}>
                            {r.totalPnl >= 0 ? '+' : '-'}${Math.abs(r.totalPnl).toFixed(0)}
                          </div>
                        </>
                      )}
                    </td>

                    <td data-label="Última actividad">
                      {r.lastActiveAt ? (
                        <>
                          <div className="num">{r.lastActiveAt.slice(0, 10)}</div>
                          <div className="muted" style={{ fontSize: 11.5 }}>
                            {r.activeDays}d activos · {r.lastModule}
                          </div>
                        </>
                      ) : (
                        <span className="muted">Sin ingreso aún</span>
                      )}
                    </td>

                    <td className="n" data-label="Acciones">
                      <div className="inline" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        {!r.isPendingClaim ? (
                          <Link href={`/admin/alumnos/${r.id}`} className="btn sm ghost" title="Ver expediente 360°">
                            Expediente <ExternalLink size={13} />
                          </Link>
                        ) : null}

                        {isAdmin ? (
                          r.status !== 'active' ? (
                            <button
                              type="button"
                              className="btn sm ghost"
                              disabled={busy}
                              onClick={() => quickStatusChange(r, 'active')}
                              title="Activar membresía"
                              style={{ color: 'var(--profit)' }}
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn sm ghost"
                                disabled={busy}
                                onClick={() => quickStatusChange(r, 'paused')}
                                title="Pausar acceso"
                              >
                                <PauseCircle size={15} />
                              </button>
                              <button
                                type="button"
                                className="btn sm ghost"
                                disabled={busy}
                                onClick={() => quickStatusChange(r, 'canceled')}
                                title="Cancelar acceso"
                                style={{ color: 'var(--loss)' }}
                              >
                                <Ban size={15} />
                              </button>
                            </>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Alta individual */}
      <NativeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Dar de alta alumno o miembro del equipo"
      >
        <form className="f" onSubmit={handleCreateUser}>
          <label htmlFor="adm-new-name">
            Nombre completo
            <input
              id="adm-new-name"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej.: Carlos Mendoza"
            />
          </label>

          <label htmlFor="adm-new-email">
            Correo electrónico
            <input
              id="adm-new-email"
              name="email"
              type="email"
              spellCheck={false}
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="alumno@correo.com"
            />
          </label>

          <div className="r2">
            <label htmlFor="adm-new-phone">
              WhatsApp (opcional)
              <input
                id="adm-new-phone"
                name="phone"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+57 300 000 0000"
              />
            </label>
            <label htmlFor="adm-new-country">
              País
              <select
                id="adm-new-country"
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
              >
                <option value="">Elige…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="r2">
            <label htmlFor="adm-new-role">
              Rol en la plataforma
              <select
                id="adm-new-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'student' | 'mentor' | 'admin')}
              >
                <option value="student">Alumno (Miembro)</option>
                <option value="mentor">Mentor (Ve panel y expedientes)</option>
                <option value="admin">Administrador Total</option>
              </select>
            </label>

            <label htmlFor="adm-new-source">
              Origen del acceso
              <select
                id="adm-new-source"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value as 'manual' | 'hotmart' | 'whop')}
              >
                <option value="manual">Manual / Beca / Cortesía</option>
                <option value="hotmart">Hotmart</option>
                <option value="whop">Whop</option>
              </select>
            </label>
          </div>

          <div className="r2">
            <label htmlFor="adm-new-exp">
              Fecha de vencimiento (vacío = ilimitado)
              <input
                id="adm-new-exp"
                type="date"
                value={newExpires}
                onChange={(e) => setNewExpires(e.target.value)}
              />
            </label>

            <label htmlFor="adm-new-pwd">
              Contraseña inicial (opcional)
              <input
                id="adm-new-pwd"
                type="text"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Dejar vacío para invitación/código"
              />
            </label>
          </div>

          <label className="ck">
            <input
              type="checkbox"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
            />
            Enviar correo automático de invitación si no se definió contraseña inicial
          </label>

          <div className="inline" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn sm ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn sm" disabled={busy}>
              {busy ? 'Guardando…' : 'Crear y activar membresía'}
            </button>
          </div>
        </form>
      </NativeDialog>

      {/* Modal: Carga masiva CSV */}
      <NativeDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Carga masiva de alumnos (CSV / Lista)"
        wide
      >
        <form className="f" onSubmit={handleBulkImport}>
          <p className="hint">
            Pega una línea por alumno con el formato: <b>Nombre, correo@ejemplo.com, +57300..., País</b> (solo el correo es obligatorio). Todos quedarán pre-autorizados con membresía activa inmediata.
          </p>
          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'Ana Gómez, ana@correo.com, +573101234567, Colombia\nLuis Pérez, luis@correo.com, +525512345678, México'}
            required
          />
          <div className="inline" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn sm ghost" onClick={() => setBulkOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn sm" disabled={busy}>
              {busy ? 'Importando…' : 'Activar lista de alumnos'}
            </button>
          </div>
        </form>
      </NativeDialog>
    </div>
  );
}
