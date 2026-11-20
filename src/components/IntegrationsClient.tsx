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

const GEMINI_MODELS = [
  {
    value: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash (Recomendado · rápido y compatible con Vertex y AI Studio)',
  },
  { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Última generación Flash)' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Ultra veloz y económico)' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Razonamiento avanzado)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Legacy — auto-migra si fue retirado)' },
] as const;

const CLAUDE_MODELS = [
  {
    value: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5 (Recomendado Anthropic · rápido y económico)',
  },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Alta precisión)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
] as const;

const ALL_PRESET_MODELS: string[] = [
  ...GEMINI_MODELS.map((m) => m.value),
  ...CLAUDE_MODELS.map((m) => m.value),
];

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
    hasGeminiApiKey: boolean;
    hasAnthropicApiKey: boolean;
    hasFmpApiKey: boolean;
  };
  initialLogs: WebhookLogRow[];
  envStatus: {
    supabaseServiceRole: boolean;
    geminiApiKey: boolean;
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
  const [customModelMode, setCustomModelMode] = useState(
    () => !ALL_PRESET_MODELS.includes(initialSettings?.ai_model || 'claude-haiku-4-5')
  );
  const [aiLimit, setAiLimit] = useState(
    initialSettings?.default_ai_daily_limit ?? 40
  );
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [fmpApiKey, setFmpApiKey] = useState('');

  const geminiConnected = secretFlags.hasGeminiApiKey || envStatus.geminiApiKey;
  const anthropicConnected = secretFlags.hasAnthropicApiKey || envStatus.anthropicApiKey;
  const fmpConnected = secretFlags.hasFmpApiKey || envStatus.fmpApiKey;
  const anyAiConnected = geminiConnected || anthropicConnected;

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
          gemini_api_key: geminiApiKey,
          anthropic_api_key: anthropicApiKey,
          fmp_api_key: fmpApiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || 'No se pudo guardar la configuración');
      else {
        setHotmartHottok('');
        setWhopSecret('');
        setGeminiApiKey('');
        setAnthropicApiKey('');
        setFmpApiKey('');
        setFeedback('Configuración guardada y aplicada en toda la plataforma.');
        router.refresh();
      }
    } catch {
      setErrorMsg('Error de red al guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClearSecret(
    field:
      | 'clear_hotmart_hottok'
      | 'clear_whop_secret'
      | 'clear_gemini_api_key'
      | 'clear_anthropic_api_key'
      | 'clear_fmp_api_key',
    label: string
  ) {
    setBusy(true);
    setFeedback('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [field]: true }),
      });
      const data = await res.json();
      if (!res.ok) setErrorMsg(data.error || `No se pudo limpiar ${label}`);
      else {
        setFeedback(`Llave guardada de ${label} eliminada del Panel Admin.`);
        router.refresh();
      }
    } catch {
      setErrorMsg('Error de red al limpiar la llave.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTestAi() {
    setBusy(true);
    setFeedback('');
    setErrorMsg('');
    try {
      const cleanModel = aiModel.trim() || 'gemini-3-flash-preview';
      if (
        geminiApiKey.trim() ||
        anthropicApiKey.trim() ||
        cleanModel !== (initialSettings?.ai_model || 'claude-haiku-4-5')
      ) {
        const saveRes = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ai_model: cleanModel,
            ...(geminiApiKey.trim() ? { gemini_api_key: geminiApiKey.trim() } : {}),
            ...(anthropicApiKey.trim() ? { anthropic_api_key: anthropicApiKey.trim() } : {}),
          }),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) {
          setErrorMsg(
            saveData.error || 'No se pudieron guardar los ajustes de IA antes de probar.'
          );
          return;
        }
        setGeminiApiKey('');
        setAnthropicApiKey('');
      }

      const res = await fetch('/api/geny', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Confirma en máximo 12 palabras que estás conectada.' },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || `Error al probar Geny IA (HTTP ${res.status})`);
      } else {
        const replyText = Array.isArray(data.content)
          ? data.content
              .filter((b: { type?: string; text?: string }) => b.type === 'text' && b.text)
              .map((b: { text?: string }) => b.text)
              .join(' ')
              .trim()
          : '';
        setFeedback(
          `¡Geny IA conectada (${data.model || cleanModel})!: "${replyText || 'Respuesta recibida.'}"`
        );
      }
      router.refresh();
    } catch {
      setErrorMsg('Error de red al probar conexión con Mi Geny.');
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

      {/* Estado de llaves de conexión */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="ph" style={{ marginBottom: 10 }}>
          <h2>Estado de Conexiones (Panel Admin + Vercel)</h2>
        </div>
        <div className="inline" style={{ gap: 12 }}>
          <span className={`badge ${envStatus.supabaseServiceRole ? 'active' : 'past_due'}`}>
            {envStatus.supabaseServiceRole ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            SUPABASE_SERVICE_ROLE_KEY:{' '}
            {envStatus.supabaseServiceRole ? 'Conectada (Vercel)' : 'Pendiente agregar en Vercel'}
          </span>

          <span
            className={`badge ${
              geminiConnected ? 'active' : anyAiConnected ? 'paused' : 'past_due'
            }`}
          >
            {geminiConnected ? (
              <CheckCircle2 size={14} />
            ) : anyAiConnected ? null : (
              <AlertTriangle size={14} />
            )}
            Google Gemini (Mi Geny):{' '}
            {secretFlags.hasGeminiApiKey
              ? 'Conectada (Panel Admin)'
              : envStatus.geminiApiKey
                ? 'Conectada (Vercel)'
                : anyAiConnected
                  ? 'Opcional (otra IA activa)'
                  : 'Pendiente'}
          </span>

          <span
            className={`badge ${
              anthropicConnected ? 'active' : anyAiConnected ? 'paused' : 'past_due'
            }`}
          >
            {anthropicConnected ? (
              <CheckCircle2 size={14} />
            ) : anyAiConnected ? null : (
              <AlertTriangle size={14} />
            )}
            Anthropic Claude (Mi Geny):{' '}
            {secretFlags.hasAnthropicApiKey
              ? 'Conectada (Panel Admin)'
              : envStatus.anthropicApiKey
                ? 'Conectada (Vercel)'
                : anyAiConnected
                  ? 'Opcional (otra IA activa)'
                  : 'Pendiente'}
          </span>

          <span className={`badge ${fmpConnected ? 'active' : 'past_due'}`}>
            {fmpConnected ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            FMP (Radar y Precios):{' '}
            {secretFlags.hasFmpApiKey
              ? 'Conectada (Panel Admin)'
              : envStatus.fmpApiKey
                ? 'Conectada (Vercel)'
                : 'Pendiente'}
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
                <div style={{ display: 'grid', gap: 5, alignContent: 'start' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <label htmlFor="hotmart-hottok-input">Hotmart Hottok (Secreto)</label>
                    {isAdmin && secretFlags.hasHotmartHottok ? (
                      <button
                        type="button"
                        onClick={() => handleClearSecret('clear_hotmart_hottok', 'Hotmart Hottok')}
                        disabled={busy}
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          color: 'var(--muted)',
                          fontSize: 12,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Limpiar llave guardada
                      </button>
                    ) : null}
                  </div>
                  <input
                    id="hotmart-hottok-input"
                    type="password"
                    autoComplete="off"
                    value={hotmartHottok}
                    onChange={(e) => setHotmartHottok(e.target.value)}
                    placeholder={
                      secretFlags.hasHotmartHottok
                        ? '•••••••• (Guardado — escribe para reemplazar)'
                        : 'Pega tu Hottok de Hotmart'
                    }
                    disabled={!isAdmin}
                  />
                </div>
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
                <div style={{ display: 'grid', gap: 5, alignContent: 'start' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <label htmlFor="whop-secret-input">Whop Webhook Secret</label>
                    {isAdmin && secretFlags.hasWhopSecret ? (
                      <button
                        type="button"
                        onClick={() => handleClearSecret('clear_whop_secret', 'Whop Secret')}
                        disabled={busy}
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          color: 'var(--muted)',
                          fontSize: 12,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Limpiar llave guardada
                      </button>
                    ) : null}
                  </div>
                  <input
                    id="whop-secret-input"
                    type="password"
                    autoComplete="off"
                    value={whopSecret}
                    onChange={(e) => setWhopSecret(e.target.value)}
                    placeholder={
                      secretFlags.hasWhopSecret
                        ? '•••••••• (Guardado — escribe para reemplazar)'
                        : 'whsec_...'
                    }
                    disabled={!isAdmin}
                  />
                </div>
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
              <div style={{ display: 'grid', gap: 5, alignContent: 'start' }}>
                <label htmlFor="ai-model-select">
                  Proveedor y Modelo de IA para Mi Geny
                </label>
                <select
                  id="ai-model-select"
                  value={customModelMode ? '__custom__' : aiModel}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setCustomModelMode(true);
                    } else {
                      setCustomModelMode(false);
                      setAiModel(val);
                    }
                  }}
                  disabled={!isAdmin}
                >
                  <optgroup label="Google Gemini (requiere GEMINI_API_KEY)">
                    {GEMINI_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Anthropic Claude (requiere ANTHROPIC_API_KEY)">
                    {CLAUDE_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                  <option value="__custom__">Otro ID personalizado…</option>
                </select>
                {customModelMode ? (
                  <input
                    type="text"
                    aria-label="ID de modelo de IA personalizado"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder="ej. gemini-3-flash-preview o claude-haiku-4-5"
                    disabled={!isAdmin}
                  />
                ) : null}
              </div>

              <label style={{ alignContent: 'start' }}>
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

            <div
              style={{
                borderTop: '1px solid var(--line)',
                paddingTop: 12,
                display: 'grid',
                gap: 10,
              }}
            >
              <div className="muted" style={{ fontSize: 12.5 }}>
                Llaves privadas de IA y Mercado (se guardan protegidas en Supabase y tienen prioridad sobre las variables de Vercel; nunca se muestran de vuelta en pantalla):
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 12,
                }}
              >
                {[
                  {
                    id: 'gemini-api-key',
                    label: 'Google Gemini API Key',
                    value: geminiApiKey,
                    onChange: setGeminiApiKey,
                    hasSaved: secretFlags.hasGeminiApiKey,
                    hasEnv: envStatus.geminiApiKey,
                    fallbackPlaceholder: 'AIzaSy... (AI Studio) o AQ.... (Vertex Express)',
                    clearField: 'clear_gemini_api_key' as const,
                    clearLabel: 'Google Gemini',
                  },
                  {
                    id: 'anthropic-api-key',
                    label: 'Anthropic Claude API Key',
                    value: anthropicApiKey,
                    onChange: setAnthropicApiKey,
                    hasSaved: secretFlags.hasAnthropicApiKey,
                    hasEnv: envStatus.anthropicApiKey,
                    fallbackPlaceholder: 'sk-ant-...',
                    clearField: 'clear_anthropic_api_key' as const,
                    clearLabel: 'Anthropic Claude',
                  },
                  {
                    id: 'fmp-api-key',
                    label: 'Financial Modeling Prep (FMP) API Key · Radar y Precios',
                    value: fmpApiKey,
                    onChange: setFmpApiKey,
                    hasSaved: secretFlags.hasFmpApiKey,
                    hasEnv: envStatus.fmpApiKey,
                    fallbackPlaceholder: 'Tu API Key de FMP',
                    clearField: 'clear_fmp_api_key' as const,
                    clearLabel: 'FMP',
                  },
                ].map((item) => (
                  <div key={item.id} style={{ display: 'grid', gap: 5, alignContent: 'start' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <label htmlFor={item.id}>{item.label}</label>
                      {isAdmin && item.hasSaved ? (
                        <button
                          type="button"
                          onClick={() => handleClearSecret(item.clearField, item.clearLabel)}
                          disabled={busy}
                          style={{
                            background: 'none',
                            border: 0,
                            padding: 0,
                            color: 'var(--muted)',
                            fontSize: 12,
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Limpiar llave guardada
                        </button>
                      ) : null}
                    </div>
                    <input
                      id={item.id}
                      type="password"
                      autoComplete="off"
                      value={item.value}
                      onChange={(e) => item.onChange(e.target.value)}
                      placeholder={
                        item.hasSaved
                          ? '•••••••• (Guardada en Panel Admin — escribe para reemplazar)'
                          : item.hasEnv
                            ? 'Conectada en Vercel (escribe aquí si deseas reemplazarla)'
                            : item.fallbackPlaceholder
                      }
                      disabled={!isAdmin}
                    />
                  </div>
                ))}
              </div>
            </div>

            {isAdmin ? (
              <div className="inline" style={{ gap: 10 }}>
                <button type="submit" className="btn" disabled={busy}>
                  <Save size={16} /> Guardar toda la configuración
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleTestAi}
                  disabled={busy}
                >
                  <Play size={16} /> Probar conexión con Mi Geny
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

