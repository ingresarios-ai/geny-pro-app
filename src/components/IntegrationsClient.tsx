'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppSettingsRow, WebhookLogRow } from '@/lib/database.types';
import { NativeDialog } from '@/components/NativeDialog';
import {
  Save,
  Send,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Play,
  Eye,
} from 'lucide-react';

export function IntegrationsClient({
  isAdmin,
  appOrigin,
  initialSettings,
  secretFlags,
  initialLogs,
  envStatus,
}: {
  isAdmin: boolean;
  appOrigin: string;
  initialSettings: AppSettingsRow | null;
  secretFlags: {
    hasHotmartHottok: boolean;
    hasWhopSecret: boolean;
  };
  initialLogs: WebhookLogRow[];
  envStatus: {
    supabaseServiceRole: boolean;
    anthropicApiKey: boolean;
    fmpApiKey: boolean;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable settings state
  const [ghlEnabled, setGhlEnabled] = useState(Boolean(initialSettings?.ghl_enabled));
  const [ghlUrl, setGhlUrl] = useState(initialSettings?.ghl_webhook_url || '');
  const [ghlMilestones, setGhlMilestones] = useState(
    initialSettings?.ghl_send_milestones ?? true
  );
  const [ghlMembership, setGhlMembership] = useState(
    initialSettings?.ghl_send_membership_events ?? true
  );

  const [hotmartEnabled, setHotmartEnabled] = useState(
    initialSettings?.hotmart_enabled ?? true
  );
  const [hotmartHottok, setHotmartHottok] = useState('');
  const [whopEnabled, setWhopEnabled] = useState(initialSettings?.whop_enabled ?? true);
  const [whopSecret, setWhopSecret] = useState('');
  const [graceDays, setGraceDays] = useState(initialSettings?.grace_days ?? 3);

  const [renewHotmart, setRenewHotmart] = useState(
    initialSettings?.renewal_url_hotmart || ''
  );
  const [renewWhop, setRenewWhop] = useState(initialSettings?.renewal_url_whop || '');
  const [whatsappUrl, setWhatsappUrl] = useState(
    initialSettings?.support_whatsapp_url || ''
  );
  const [privacyUrl, setPrivacyUrl] = useState(initialSettings?.privacy_url || '');

  const [aiModel, setAiModel] = useState(
    initialSettings?.ai_model || 'claude-haiku-4-5'
  );
  const [aiLimit, setAiLimit] = useState(
    initialSettings?.default_ai_daily_limit ?? 40
  );

  // Simulator state
  const [simProvider, setSimProvider] = useState<'hotmart' | 'whop'>('hotmart');
  const [simScenario, setSimScenario] = useState<
    'approve' | 'overdue' | 'cancel' | 'refund'
  >('approve');
  const [simEmail, setSimEmail] = useState('');
  const [simName, setSimName] = useState('');

  // Logs filter & JSON viewer dialog
  const [providerFilter, setProviderFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<WebhookLogRow | null>(null);

  const hotmartEndpoint = `${appOrigin}/api/webhooks/hotmart`;
  const whopEndpoint = `${appOrigin}/api/webhooks/whop`;

  const filteredLogs = useMemo(() => {
    return initialLogs.filter(
      (l) => providerFilter === 'all' || l.provider === providerFilter
    );
  }, [initialLogs, providerFilter]);

  async function copyText(txt: string, label: string) {
    try {
      await navigator.clipboard.writeText(txt);
      setFeedback(`URL de ${label} copiada al portapapeles.`);
    } catch {
      setErrorMsg('No se pudo copiar automáticamente.');
    }
  }

  async function handleSaveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ghl_enabled: ghlEnabled,
          ghl_webhook_url: ghlUrl,
          ghl_send_milestones: ghlMilestones,
          ghl_send_membership_events: ghlMembership,
          hotmart_enabled: hotmartEnabled,
          hotmart_hottok: hotmartHottok,
          whop_enabled: whopEnabled,
          whop_webhook_secret: whopSecret,
          grace_days: graceDays,
          renewal_url_hotmart: renewHotmart,
          renewal_url_whop: renewWhop,
          support_whatsapp_url: whatsappUrl,
          privacy_url: privacyUrl,
          ai_model: aiModel,
          default_ai_daily_limit: aiLimit,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || 'No se pudo guardar la configuración');
      else {
        setHotmartHottok('');
        setWhopSecret('');
        setFeedback('Configuración guardada y aplicada en toda la plataforma.');
        router.refresh();
      }
    } catch {
      setErrorMsg('Error de red al guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTestGhl() {
    setBusy(true);
    setFeedback('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/ghl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'test', overrideWebhookUrl: ghlUrl }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || 'Falló la prueba hacia GHL');
      else setFeedback(`Evento de prueba entregado con éxito a GHL (HTTP ${data.httpStatus}).`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncAllGhl() {
    setBusy(true);
    setFeedback('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/ghl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'sync_all', overrideWebhookUrl: ghlUrl }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || 'Falló la sincronización masiva');
      else
        setFeedback(
          `Sincronización completada: ${data.sentCount} alumnos enviados a GHL (${data.failedCount} errores).`
        );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryLog(logId: string) {
    setBusy(true);
    setFeedback('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/ghl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'retry', logId }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || 'El reintento volvió a fallar');
      else setFeedback('Entrega a GHL reenviada con éxito.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulateWebhook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/simulate-webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: simProvider,
          scenario: simScenario,
          email: simEmail,
          fullName: simName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || 'Error en simulación');
      else {
        setFeedback(
          `Simulación (${simProvider.toUpperCase()} -> ${data.status}) ejecutada para ${simEmail}.`
        );
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="vhead" style={{ marginTop: 0 }}>
        <div>
          <h1>Pasarelas, GoHighLevel e IA</h1>
          <p>
            Controla desde aquí el webhook de seguimiento hacia GHL, las llaves de Hotmart y Whop, y los parámetros globales de Geny Pro.
          </p>
        </div>
      </div>

      {feedback ? <p className="r21ok">{feedback}</p> : null}
      {errorMsg ? <p className="r21alert">{errorMsg}</p> : null}

      {/* Estado de llaves de servidor */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="ph" style={{ marginBottom: 10 }}>
          <h2>Estado de Variables de Servidor (Vercel)</h2>
        </div>
        <div className="inline" style={{ gap: 12 }}>
          <span className={`badge ${envStatus.supabaseServiceRole ? 'active' : 'past_due'}`}>
            {envStatus.supabaseServiceRole ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            SUPABASE_SERVICE_ROLE_KEY:{' '}
            {envStatus.supabaseServiceRole ? 'Conectada' : 'Pendiente agregar en Vercel'}
          </span>

          <span className={`badge ${envStatus.anthropicApiKey ? 'active' : 'past_due'}`}>
            {envStatus.anthropicApiKey ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            ANTHROPIC_API_KEY (Chat Geny):{' '}
            {envStatus.anthropicApiKey ? 'Conectada' : 'Pendiente en Vercel'}
          </span>

          <span className={`badge ${envStatus.fmpApiKey ? 'active' : 'past_due'}`}>
            {envStatus.fmpApiKey ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            FMP_API_KEY (Radar y Precios):{' '}
            {envStatus.fmpApiKey ? 'Conectada' : 'Pendiente en Vercel'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSaveSettings}>
        <div className="duo" style={{ marginBottom: 18 }}>
          {/* GoHighLevel Control */}
          <div className="panel glow">
            <div className="ph">
              <h2>Seguimiento hacia GoHighLevel (GHL)</h2>
              <span className={`badge ${ghlEnabled && ghlUrl ? 'active' : 'paused'}`}>
                {ghlEnabled && ghlUrl ? 'Activo' : 'Pausado'}
              </span>
            </div>

            <div className="f">
              <label className="ck">
                <input
                  type="checkbox"
                  checked={ghlEnabled}
                  onChange={(e) => setGhlEnabled(e.target.checked)}
                  disabled={!isAdmin}
                />
                <b>Activar envío automático de eventos al Inbound Webhook de GHL</b>
              </label>

              <label>
                URL del Inbound Webhook de GHL
                <input
                  type="url"
                  value={ghlUrl}
                  onChange={(e) => setGhlUrl(e.target.value)}
                  placeholder="https://services.leadconnectorhq.com/hooks/..."
                  disabled={!isAdmin}
                />
              </label>

              <label className="ck">
                <input
                  type="checkbox"
                  checked={ghlMilestones}
                  onChange={(e) => setGhlMilestones(e.target.checked)}
                  disabled={!isAdmin}
                />
                Enviar hitos de aprendizaje (diagnóstico, Reto 21, bitácora, radar, días activos)
              </label>

              <label className="ck">
                <input
                  type="checkbox"
                  checked={ghlMembership}
                  onChange={(e) => setGhlMembership(e.target.checked)}
                  disabled={!isAdmin}
                />
                Enviar eventos de membresía (compras de Hotmart/Whop, atrasos, bajas)
              </label>

              <div className="inline" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={handleTestGhl}
                  disabled={busy || !ghlUrl}
                >
                  <Send size={14} /> Enviar evento de prueba a GHL
                </button>

                {isAdmin ? (
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={handleSyncAllGhl}
                    disabled={busy || !ghlUrl}
                  >
                    <RefreshCw size={14} /> Sincronizar todos los alumnos activos
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Hotmart & Whop */}
          <div className="panel">
            <div className="ph">
              <h2>Pasarelas de Pago (Hotmart y Whop)</h2>
            </div>

            <div className="f">
              <div>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>
                  URL Webhook para pegar en <b>Hotmart</b> (Tools → Webhook):
                </div>
                <div className="inline" style={{ flexWrap: 'nowrap' }}>
                  <input
                    readOnly
                    value={hotmartEndpoint}
                    className="num"
                    style={{ fontSize: 12.5 }}
                  />
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => copyText(hotmartEndpoint, 'Hotmart')}
                  >
                    <Copy size={14} /> Copiar
                  </button>
                </div>
              </div>

              <div className="r2">
                <label>
                  Hotmart Hottok (Secreto)
                  <input
                    type="password"
                    value={hotmartHottok}
                    onChange={(e) => setHotmartHottok(e.target.value)}
                    placeholder={
                      secretFlags.hasHotmartHottok
                        ? '•••••••• (Guardado — escribe para reemplazar)'
                        : 'Pega tu Hottok de Hotmart'
                    }
                    disabled={!isAdmin}
                  />
                </label>
                <label className="ck" style={{ alignSelf: 'end', paddingBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={hotmartEnabled}
                    onChange={(e) => setHotmartEnabled(e.target.checked)}
                    disabled={!isAdmin}
                  />
                  Recibir webhooks de Hotmart
                </label>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>
                  URL Webhook para pegar en <b>Whop</b> (Developer → Webhooks):
                </div>
                <div className="inline" style={{ flexWrap: 'nowrap' }}>
                  <input
                    readOnly
                    value={whopEndpoint}
                    className="num"
                    style={{ fontSize: 12.5 }}
                  />
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => copyText(whopEndpoint, 'Whop')}
                  >
                    <Copy size={14} /> Copiar
                  </button>
                </div>
              </div>

              <div className="r2">
                <label>
                  Whop Webhook Secret
                  <input
                    type="password"
                    value={whopSecret}
                    onChange={(e) => setWhopSecret(e.target.value)}
                    placeholder={
                      secretFlags.hasWhopSecret
                        ? '•••••••• (Guardado — escribe para reemplazar)'
                        : 'whsec_...'
                    }
                    disabled={!isAdmin}
                  />
                </label>
                <label className="ck" style={{ alignSelf: 'end', paddingBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={whopEnabled}
                    onChange={(e) => setWhopEnabled(e.target.checked)}
                    disabled={!isAdmin}
                  />
                  Recibir webhooks de Whop
                </label>
              </div>

              <label>
                Días de gracia ante pago atrasado (antes de bloquear acceso)
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={graceDays}
                  onChange={(e) => setGraceDays(Number(e.target.value))}
                  disabled={!isAdmin}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Enlaces de renovación, Soporte e IA */}
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="ph">
            <h2>Enlaces de Renovación, Soporte y Cuotas de Geny IA</h2>
          </div>

          <div className="f">
            <div className="r2">
              <label>
                URL Checkout / Renovación Whop (aparece en /renovar)
                <input
                  type="url"
                  value={renewWhop}
                  onChange={(e) => setRenewWhop(e.target.value)}
                  placeholder="https://whop.com/..."
                  disabled={!isAdmin}
                />
              </label>

              <label>
                URL Checkout / Renovación Hotmart (aparece en /renovar)
                <input
                  type="url"
                  value={renewHotmart}
                  onChange={(e) => setRenewHotmart(e.target.value)}
                  placeholder="https://pay.hotmart.com/..."
                  disabled={!isAdmin}
                />
              </label>
            </div>

            <div className="r2">
              <label>
                URL WhatsApp de Soporte
                <input
                  type="url"
                  value={whatsappUrl}
                  onChange={(e) => setWhatsappUrl(e.target.value)}
                  placeholder="https://wa.me/573000000000"
                  disabled={!isAdmin}
                />
              </label>

              <label>
                URL Política de Privacidad
                <input
                  type="url"
                  value={privacyUrl}
                  onChange={(e) => setPrivacyUrl(e.target.value)}
                  placeholder="https://ingresarios.net/privacidad"
                  disabled={!isAdmin}
                />
              </label>
            </div>

            <div className="r2">
              <label>
                Modelo Anthropic para Mi Geny
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="claude-haiku-4-5"
                  disabled={!isAdmin}
                />
              </label>

              <label>
                Mensajes diarios de IA por alumno (por defecto)
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={aiLimit}
                  onChange={(e) => setAiLimit(Number(e.target.value))}
                  disabled={!isAdmin}
                />
              </label>
            </div>

            {isAdmin ? (
              <div>
                <button type="submit" className="btn" disabled={busy}>
                  <Save size={16} /> Guardar toda la configuración
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </form>

      {/* Simulador de Webhooks */}
      {isAdmin ? (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="ph">
            <h2>Simulador de Eventos de Compra y Baja</h2>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Prueba el circuito completo (Supabase + GHL) sin hacer pagos reales
            </span>
          </div>

          <form className="rd-ctl" onSubmit={handleSimulateWebhook}>
            <label>
              Pasarela
              <select
                value={simProvider}
                onChange={(e) => setSimProvider(e.target.value as 'hotmart' | 'whop')}
              >
                <option value="hotmart">Hotmart</option>
                <option value="whop">Whop</option>
              </select>
            </label>

            <label>
              Evento a simular
              <select
                value={simScenario}
                onChange={(e) =>
                  setSimScenario(
                    e.target.value as 'approve' | 'overdue' | 'cancel' | 'refund'
                  )
                }
              >
                <option value="approve">Compra aprobada (Activar membresía)</option>
                <option value="overdue">Pago atrasado (Entrar en gracia)</option>
                <option value="cancel">Suscripción cancelada (Cortar acceso)</option>
                <option value="refund">Reembolso / Contracargo (Revocar)</option>
              </select>
            </label>

            <label>
              Correo del comprador de prueba
              <input
                type="email"
                required
                value={simEmail}
                onChange={(e) => setSimEmail(e.target.value)}
                placeholder="prueba@correo.com"
              />
            </label>

            <label>
              Nombre (opcional)
              <input
                type="text"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                placeholder="Alumno Prueba"
              />
            </label>

            <button type="submit" className="btn sm" disabled={busy}>
              <Play size={14} /> Ejecutar prueba
            </button>
          </form>
        </div>
      ) : null}

      {/* Auditoría de Webhooks */}
      <div className="panel">
        <div className="ph">
          <h2>Registro de Webhooks (Hotmart, Whop y GHL)</h2>
          <div className="tfs" role="group" aria-label="Filtrar por proveedor">
            {[
              ['all', 'Todos'],
              ['hotmart', 'Hotmart'],
              ['whop', 'Whop'],
              ['ghl', 'Salidas GHL'],
            ].map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                aria-pressed={providerFilter === k}
                onClick={() => setProviderFilter(k)}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty">Aún no hay registros de webhooks para este filtro.</div>
        ) : (
          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Historial de webhooks">
            <table className="stackable">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Dirección / Origen</th>
                  <th>Evento</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th className="n">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="num" data-label="Fecha">
                      {new Date(l.created_at).toLocaleString('es', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <th scope="row">
                      <span style={{ textTransform: 'uppercase' }}>{l.provider}</span>
                      <span className="muted" style={{ fontSize: 11.5, marginLeft: 6, fontWeight: 400 }}>
                        ({l.direction === 'inbound' ? 'Entrada' : 'Salida'})
                      </span>
                    </th>
                    <td data-label="Evento">{l.event_type}</td>
                    <td data-label="Correo">{l.email || '—'}</td>
                    <td data-label="Estado">
                      <span
                        className={`badge ${
                          l.status === 'processed' || l.status === 'delivered'
                            ? 'active'
                            : l.status === 'ignored'
                              ? 'paused'
                              : 'canceled'
                        }`}
                      >
                        {l.status} {l.http_status ? `(${l.http_status})` : ''}
                      </span>
                      {l.error_message ? (
                        <div className="down" style={{ fontSize: 11.5, marginTop: 2 }}>
                          {l.error_message}
                        </div>
                      ) : null}
                    </td>
                    <td className="n" data-label="Acciones">
                      <div className="inline" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn sm ghost"
                          onClick={() => setSelectedLog(l)}
                        >
                          <Eye size={14} /> JSON
                        </button>
                        {l.direction === 'outbound' && l.status === 'failed' ? (
                          <button
                            type="button"
                            className="btn sm ghost"
                            disabled={busy}
                            onClick={() => handleRetryLog(l.id)}
                          >
                            <RefreshCw size={14} /> Reintentar
                          </button>
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

      <NativeDialog
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `${selectedLog.provider.toUpperCase()} · ${selectedLog.event_type}` : 'Detalle'}
        wide
      >
        {selectedLog ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Fecha: {new Date(selectedLog.created_at).toLocaleString()} · Estado: {selectedLog.status}
            </div>
            <pre
              className="num"
              style={{
                background: '#070A0E',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                overflowX: 'auto',
                margin: 0,
              }}
            >
              {JSON.stringify(selectedLog.payload, null, 2)}
            </pre>
            {selectedLog.response_body ? (
              <>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Respuesta:
                </div>
                <pre
                  className="num"
                  style={{
                    background: '#070A0E',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 12,
                    overflowX: 'auto',
                    margin: 0,
                  }}
                >
                  {selectedLog.response_body}
                </pre>
              </>
            ) : null}
          </div>
        ) : null}
      </NativeDialog>
    </div>
  );
}

