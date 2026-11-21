import { NextResponse } from 'next/server';
import { createClient, readAppSettings } from '@/lib/supabase/server';
import { evaluateMembershipAccess } from '@/lib/membership';

export const maxDuration = 60;

const GENY_SYSTEM_PROMPT = `Eres Geny, mentora de inteligencia financiera, trading y alto rendimiento de INGRESARIOS. Hablas en español latino, cálida, directa y motivadora, con frases cortas y humor ligero; usa emojis con moderación. Usas el método PEDEM (Planear, Ejecutar, Documentar, Evaluar, Mejorar) y dices "bitácora", nunca "journal". Basa tus respuestas en los datos del usuario cuando sean relevantes y cita cifras concretas. Es educativo: no prometas rentabilidad ni des recomendaciones personalizadas de comprar o vender un activo concreto; recuerda la gestión del riesgo cuando aplique. Si el usuario pide registrar algo, usa la herramienta correspondiente y confirma lo que guardaste. Responde en texto plano, sin markdown con # ni tablas; máximo 180 palabras salvo que pidan más.`;

const GEMINI_FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
];

interface ChatMessage {
  role: string;
  content: unknown;
}

interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const GEMINI_SCHEMA_KEYS = new Set([
  'type',
  'description',
  'enum',
  'properties',
  'required',
  'items',
]);

function redactApiSecrets(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTED_KEY]')
    .replace(/AQ\.[0-9A-Za-z._-]{10,}/g, '[REDACTED_KEY]');
}

function sanitizeGeminiSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { type: 'OBJECT', properties: {} };
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (!GEMINI_SCHEMA_KEYS.has(k)) continue;
    if (k === 'type' && typeof v === 'string') {
      out.type = v.toUpperCase();
    } else if (k === 'properties' && v && typeof v === 'object' && !Array.isArray(v)) {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
        props[pk] = sanitizeGeminiSchema(pv);
      }
      out.properties = props;
    } else if (k === 'items' && v && typeof v === 'object') {
      out.items = sanitizeGeminiSchema(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function sanitizeAnthropicMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (!Array.isArray(m.content)) {
      return { role: m.role, content: m.content };
    }
    const cleanBlocks = m.content.map((rawBlock) => {
      if (!rawBlock || typeof rawBlock !== 'object') return rawBlock;
      const b = rawBlock as Record<string, unknown>;
      if (b.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: String(b.id || ''),
          name: String(b.name || ''),
          input: b.input && typeof b.input === 'object' ? b.input : {},
        };
      }
      return b;
    });
    return { role: m.role, content: cleanBlocks };
  });
}

function toGeminiContents(
  messages: ChatMessage[]
): Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> {
  const toolUseIdToName = new Map<string, string>();
  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];

  for (const m of messages) {
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    const parts: Array<Record<string, unknown>> = [];

    if (typeof m.content === 'string') {
      if (m.content.trim()) {
        parts.push({ text: m.content });
      }
    } else if (Array.isArray(m.content)) {
      for (const rawBlock of m.content) {
        if (!rawBlock || typeof rawBlock !== 'object') continue;
        const b = rawBlock as Record<string, unknown>;

        if (b.type === 'text' && typeof b.text === 'string' && b.text.length > 0) {
          parts.push({ text: b.text });
        } else if (b.type === 'tool_use') {
          const fnName = String(b.name || '');
          const callId = String(b.id || '');
          if (callId && fnName) toolUseIdToName.set(callId, fnName);
          const part: Record<string, unknown> = {
            functionCall: {
              name: fnName,
              args: b.input && typeof b.input === 'object' ? b.input : {},
            },
          };
          if (typeof b.thoughtSignature === 'string' && b.thoughtSignature) {
            part.thoughtSignature = b.thoughtSignature;
          }
          parts.push(part);
        } else if (b.type === 'tool_result') {
          let parsedObj: Record<string, unknown>;
          if (typeof b.content === 'string') {
            try {
              const parsed = JSON.parse(b.content);
              parsedObj =
                parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                  ? (parsed as Record<string, unknown>)
                  : { result: parsed };
            } catch {
              parsedObj = { result: b.content };
            }
          } else if (b.content && typeof b.content === 'object' && !Array.isArray(b.content)) {
            parsedObj = b.content as Record<string, unknown>;
          } else {
            parsedObj = { result: b.content ?? null };
          }
          const fnName = toolUseIdToName.get(String(b.tool_use_id || '')) || 'tool';
          parts.push({
            functionResponse: {
              name: fnName,
              response: b.is_error ? { error: parsedObj } : parsedObj,
            },
          });
        }
      }
    }

    if (!parts.length) continue;

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  return contents;
}

function buildGeminiEndpoint(
  modelId: string,
  useVertex: boolean,
  vertexVersion: 'v1' | 'v1beta1' = 'v1'
): string {
  const modelEnc = encodeURIComponent(modelId);
  const customBase = (process.env.GEMINI_BASE_URL || '').trim().replace(/\/$/, '');
  if (customBase) {
    return `${customBase}/v1beta/models/${modelEnc}:generateContent`;
  }
  if (!useVertex) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelEnc}:generateContent`;
  }
  const effectiveVersion = modelId.includes('preview') ? 'v1beta1' : vertexVersion;
  return `https://aiplatform.googleapis.com/${effectiveVersion}/publishers/google/models/${modelEnc}:generateContent`;
}

function isModelMissingOrRetired(status: number, detail: string): boolean {
  if (status === 404) return true;
  if (
    status === 400 &&
    /model|not found|not supported|deprecated|retired|unknown/i.test(detail)
  ) {
    return true;
  }
  return false;
}

async function postGeminiUrl(
  url: string,
  geminiKey: string,
  geminiBody: Record<string, unknown>
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  detail: string;
}> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': geminiKey,
      },
      body: JSON.stringify(geminiBody),
      signal: AbortSignal.timeout(45000),
    });

    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      return { ok: true, status: 200, data, detail: '' };
    }

    const errJson = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const detail = redactApiSecrets(String(errJson?.error?.message || '')).slice(0, 300);
    return { ok: false, status: res.status, data: null, detail };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      data: null,
      detail: redactApiSecrets(
        err instanceof Error ? err.message : 'Error de red hacia Google Gemini'
      ).slice(0, 300),
    };
  }
}

async function discoverAvailableGeminiModels(
  geminiKey: string,
  useVertex: boolean
): Promise<string[]> {
  const customBase = (process.env.GEMINI_BASE_URL || '').trim().replace(/\/$/, '');
  const listUrl = customBase
    ? `${customBase}/v1beta/models?pageSize=100`
    : useVertex
      ? 'https://aiplatform.googleapis.com/v1beta1/publishers/google/models?pageSize=100'
      : 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100';

  try {
    const res = await fetch(listUrl, {
      headers: { 'x-goog-api-key': geminiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      publisherModels?: Array<{ name?: string }>;
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const rawList = json.publisherModels || json.models || [];
    const ids: string[] = [];

    for (const item of rawList) {
      if (
        'supportedGenerationMethods' in item &&
        Array.isArray(item.supportedGenerationMethods) &&
        !item.supportedGenerationMethods.includes('generateContent')
      ) {
        continue;
      }
      const rawName = String(item.name || '');
      const id = rawName.split('/').pop()?.trim() || '';
      if (!id.startsWith('gemini-')) continue;
      if (/image|tts|audio|live|embedding|imagen|veo/i.test(id)) continue;
      ids.push(id);
    }

    ids.sort((a, b) => {
      const aFlash = a.includes('flash') ? 0 : 1;
      const bFlash = b.includes('flash') ? 0 : 1;
      return aFlash - bFlash;
    });

    return Array.from(new Set(ids));
  } catch {
    return [];
  }
}

async function callGoogleGemini(
  requestedModel: string,
  geminiKey: string,
  geminiBody: Record<string, unknown>
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  resolvedModel: string;
  detail: string;
}> {
  const candidateModels = Array.from(
    new Set([requestedModel, ...GEMINI_FALLBACK_MODELS].filter(Boolean))
  );
  const hasCustomBase = Boolean((process.env.GEMINI_BASE_URL || '').trim());
  // Try standard Gemini API (generativelanguage.googleapis.com) first — covers both AIza* and AQ.* Gemini-API keys
  let useVertex = false;
  let vertexVersion: 'v1' | 'v1beta1' = 'v1';
  const triedModels = new Set<string>();

  let lastStatus = 502;
  let lastDetail = '';
  let lastModel = requestedModel;

  // 1. Try primary model on Gemini API; if rejected (401/403), flip to Agent Platform / Vertex (v1 and v1beta1)
  triedModels.add(requestedModel);
  let firstAttempt = await postGeminiUrl(
    buildGeminiEndpoint(requestedModel, useVertex, vertexVersion),
    geminiKey,
    geminiBody
  );

  if (firstAttempt.ok) {
    return {
      ok: true,
      status: 200,
      data: firstAttempt.data,
      resolvedModel: requestedModel,
      detail: '',
    };
  }

  if ((firstAttempt.status === 401 || firstAttempt.status === 403) && !hasCustomBase) {
    const vertexVersions: ReadonlyArray<'v1' | 'v1beta1'> = requestedModel.includes('preview')
      ? ['v1beta1']
      : ['v1', 'v1beta1'];

    for (const v of vertexVersions) {
      const flipped = await postGeminiUrl(
        buildGeminiEndpoint(requestedModel, true, v),
        geminiKey,
        geminiBody
      );
      if (flipped.ok) {
        return {
          ok: true,
          status: 200,
          data: flipped.data,
          resolvedModel: requestedModel,
          detail: '',
        };
      }
      if (flipped.status === 429) {
        return {
          ok: false,
          status: 429,
          data: null,
          resolvedModel: requestedModel,
          detail: flipped.detail,
        };
      }
      if (flipped.status !== 401 && flipped.status !== 403) {
        useVertex = true;
        vertexVersion = v;
        firstAttempt = flipped;
        break;
      }
    }
  }

  lastStatus = firstAttempt.status;
  lastDetail = firstAttempt.detail;
  lastModel = requestedModel;

  if (lastStatus === 429) {
    return { ok: false, status: 429, data: null, resolvedModel: lastModel, detail: lastDetail };
  }

  // 2. If primary model was retired or returned 404, cascade through active fallback models
  if (isModelMissingOrRetired(lastStatus, lastDetail)) {
    for (const modelId of candidateModels.slice(1)) {
      triedModels.add(modelId);
      lastModel = modelId;
      const attempt = await postGeminiUrl(
        buildGeminiEndpoint(modelId, useVertex, vertexVersion),
        geminiKey,
        geminiBody
      );
      if (attempt.ok) {
        return {
          ok: true,
          status: 200,
          data: attempt.data,
          resolvedModel: modelId,
          detail: '',
        };
      }
      lastStatus = attempt.status;
      lastDetail = attempt.detail;
      if (lastStatus === 429) {
        return { ok: false, status: 429, data: null, resolvedModel: modelId, detail: lastDetail };
      }
      if (!isModelMissingOrRetired(lastStatus, lastDetail)) {
        break;
      }
    }
  }

  // 3. Last-resort dynamic discovery from Google's active model catalog for this key
  if (isModelMissingOrRetired(lastStatus, lastDetail)) {
    const discovered = await discoverAvailableGeminiModels(geminiKey, useVertex);
    for (const modelId of discovered.filter((m) => !triedModels.has(m)).slice(0, 3)) {
      lastModel = modelId;
      const attempt = await postGeminiUrl(
        buildGeminiEndpoint(modelId, useVertex, vertexVersion),
        geminiKey,
        geminiBody
      );
      if (attempt.ok) {
        return {
          ok: true,
          status: 200,
          data: attempt.data,
          resolvedModel: modelId,
          detail: '',
        };
      }
      lastStatus = attempt.status;
      lastDetail = attempt.detail;
      if (lastStatus === 429 || !isModelMissingOrRetired(lastStatus, lastDetail)) {
        break;
      }
    }
  }

  return {
    ok: false,
    status: lastStatus,
    data: null,
    resolvedModel: lastModel,
    detail: lastDetail,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const [{ data: profile }, { data: membership }, settings] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, role, daily_ai_limit_override')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('memberships')
      .select('status, source, expires_at, grace_until')
      .eq('user_id', user.id)
      .maybeSingle(),
    readAppSettings(
      supabase,
      'ai_model, default_ai_daily_limit, gemini_api_key, anthropic_api_key'
    ),
  ]);

  if (!evaluateMembershipAccess(profile, membership).allowed || !profile) {
    return NextResponse.json({ error: 'Membresía inactiva' }, { status: 403 });
  }

  const anthropicKey = (
    settings?.anthropic_api_key ||
    process.env.ANTHROPIC_API_KEY ||
    ''
  ).trim();
  const geminiKey = (
    settings?.gemini_api_key ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();

  if (!anthropicKey && !geminiKey) {
    return NextResponse.json(
      { error: 'Geny IA no tiene API Key configurada aún. Agrégala en /admin/integraciones.' },
      { status: 501 }
    );
  }

  const dailyLimit =
    profile.daily_ai_limit_override ??
    settings?.default_ai_daily_limit ??
    (Number(process.env.GENY_DAILY_LIMIT) || 40);

  const todayIso = new Date().toISOString().slice(0, 10);
  const { count: usedToday } = await supabase
    .from('ai_usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('usage_date', todayIso);

  if (profile.role === 'student' && (usedToday || 0) >= dailyLimit) {
    return NextResponse.json({ error: 'Límite diario de mensajes alcanzado' }, { status: 429 });
  }

  const rawText = await request.text();
  if (rawText.length > 65000) {
    return NextResponse.json({ error: 'Mensaje demasiado largo' }, { status: 413 });
  }

  let body: {
    messages?: ChatMessage[];
    context?: string;
    tools?: Array<{
      name?: string;
      description?: string;
      input_schema?: Record<string, unknown>;
    }>;
  };
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  if (!messages.length || messages[0].role !== 'user') {
    return NextResponse.json({ error: 'Faltan mensajes válidos' }, { status: 400 });
  }

  const tools: ToolDef[] = (Array.isArray(body.tools) ? body.tools : []).slice(0, 8).map((x) => ({
    name: String(x.name || '').slice(0, 64),
    description: String(x.description || '').slice(0, 500),
    input_schema: x.input_schema || { type: 'object', properties: {} },
  }));

  const userContext = typeof body.context === 'string' ? body.context.slice(0, 8000) : '';
  const systemText = userContext
    ? `${GENY_SYSTEM_PROMPT}\n\n${userContext}`
    : GENY_SYSTEM_PROMPT;

  const requestedModel =
    settings?.ai_model?.trim() ||
    process.env.GENY_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    '';
  const wantsGemini = requestedModel.toLowerCase().startsWith('gemini');

  let provider: 'gemini' | 'anthropic';
  let activeModel: string;

  if (wantsGemini && geminiKey) {
    provider = 'gemini';
    activeModel = requestedModel;
  } else if (!wantsGemini && anthropicKey) {
    provider = 'anthropic';
    activeModel = requestedModel || 'claude-haiku-4-5';
  } else if (geminiKey) {
    provider = 'gemini';
    activeModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
  } else {
    provider = 'anthropic';
    activeModel = process.env.GENY_MODEL?.trim() || 'claude-haiku-4-5';
  }

  if (provider === 'gemini') {
    const geminiBody: Record<string, unknown> = {
      systemInstruction: { role: 'system', parts: [{ text: systemText }] },
      contents: toGeminiContents(messages),
      ...(tools.length
        ? {
            tools: [
              {
                functionDeclarations: tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: sanitizeGeminiSchema(t.input_schema),
                })),
              },
            ],
          }
        : {}),
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.6,
      },
    };

    const geminiResult = await callGoogleGemini(activeModel, geminiKey, geminiBody);

    if (!geminiResult.ok || !geminiResult.data) {
      console.error('[geny][gemini]', {
        status: geminiResult.status,
        model: geminiResult.resolvedModel,
        detail: geminiResult.detail,
      });

      const { status, detail, resolvedModel } = geminiResult;
      const detailSuffix = detail ? ` (${detail})` : '';

      if (status === 429) {
        return NextResponse.json(
          {
            error: `Se alcanzó el límite de cuota por minuto de tu API Key de Gemini${detailSuffix}. Espera unos segundos e intenta de nuevo.`,
          },
          { status: 429 }
        );
      }

      if (
        status === 401 ||
        status === 403 ||
        /API_KEY_INVALID|ACCESS_TOKEN_TYPE_UNSUPPORTED|PERMISSION_DENIED|BILLING/i.test(detail)
      ) {
        return NextResponse.json(
          {
            error: `Google rechazó la API Key de Gemini o requiere activar facturación/permisos en tu proyecto${detailSuffix}. Revisa la llave en /admin/integraciones (también puedes crear una llave directa en aistudio.google.com/apikey).`,
          },
          { status: 502 }
        );
      }

      if (status === 404) {
        return NextResponse.json(
          {
            error: `Ningún modelo Gemini compatible respondió (último intento: "${resolvedModel}")${detailSuffix}. Cambia de modelo o de API Key en /admin/integraciones.`,
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          error: `Gemini no pudo completar la respuesta (HTTP ${status})${detailSuffix}. Revisa la llave o modelo en /admin/integraciones.`,
        },
        { status: 502 }
      );
    }

    const resolvedModel = geminiResult.resolvedModel;
    const data = geminiResult.data as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: unknown[] };
      }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const candidate = data.candidates?.[0];
    const rawParts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const normalizedBlocks: Array<Record<string, unknown>> = [];

    rawParts.forEach((rawPart: unknown, idx: number) => {
      if (!rawPart || typeof rawPart !== 'object') return;
      const part = rawPart as {
        text?: string;
        thought?: boolean;
        thoughtSignature?: string;
        functionCall?: { name?: string; args?: Record<string, unknown> };
      };
      if (typeof part.text === 'string' && !part.thought && part.text.length > 0) {
        normalizedBlocks.push({ type: 'text', text: part.text });
      }
      if (part.functionCall?.name) {
        const block: Record<string, unknown> = {
          type: 'tool_use',
          id: `gemini_${Date.now()}_${idx}`,
          name: String(part.functionCall.name),
          input:
            part.functionCall.args && typeof part.functionCall.args === 'object'
              ? part.functionCall.args
              : {},
        };
        if (typeof part.thoughtSignature === 'string' && part.thoughtSignature) {
          block.thoughtSignature = part.thoughtSignature;
        }
        normalizedBlocks.push(block);
      }
    });

    const hasToolUse = normalizedBlocks.some((b) => b.type === 'tool_use');
    const stopReason = hasToolUse
      ? 'tool_use'
      : candidate?.finishReason === 'MAX_TOKENS'
        ? 'max_tokens'
        : 'end_turn';

    await supabase.from('ai_usage_logs').insert({
      user_id: user.id,
      usage_date: todayIso,
      model: resolvedModel,
      input_tokens: Number(data.usageMetadata?.promptTokenCount || 0),
      output_tokens: Number(data.usageMetadata?.candidatesTokenCount || 0),
    });

    return NextResponse.json({
      content: normalizedBlocks,
      stop_reason: stopReason,
      provider: 'gemini',
      model: resolvedModel,
    });
  }

  const anthropicBaseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(
    /\/$/,
    ''
  );

  const anthropicRes = await fetch(`${anthropicBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: activeModel,
      max_tokens: 750,
      system: systemText,
      messages: sanitizeAnthropicMessages(messages),
      ...(tools.length ? { tools } : {}),
    }),
  });

  if (!anthropicRes.ok) {
    const errJson = (await anthropicRes.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const detail = String(errJson?.error?.message || '').slice(0, 300);
    const detailSuffix = detail ? ` (${detail})` : '';
    console.error('[geny][anthropic]', {
      status: anthropicRes.status,
      model: activeModel,
      detail,
    });

    if (anthropicRes.status === 429) {
      return NextResponse.json(
        {
          error: `Se alcanzó el límite de cuota por minuto de tu API Key de Claude${detailSuffix}. Espera unos segundos e intenta de nuevo.`,
        },
        { status: 429 }
      );
    }

    if (anthropicRes.status === 401 || anthropicRes.status === 403) {
      return NextResponse.json(
        {
          error: `Anthropic rechazó la API Key de Claude o falta crédito en tu cuenta${detailSuffix}. Revisa ANTHROPIC_API_KEY en /admin/integraciones.`,
        },
        { status: 502 }
      );
    }

    if (anthropicRes.status === 404) {
      return NextResponse.json(
        {
          error: `El modelo "${activeModel}" no está disponible para tu llave de Claude${detailSuffix}. Cambia de modelo en /admin/integraciones.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: `Claude no pudo completar la respuesta (HTTP ${anthropicRes.status})${detailSuffix}. Revisa tu llave o modelo en /admin/integraciones.`,
      },
      { status: 502 }
    );
  }

  const data = await anthropicRes.json();

  await supabase.from('ai_usage_logs').insert({
    user_id: user.id,
    usage_date: todayIso,
    model: activeModel,
    input_tokens: Number(data?.usage?.input_tokens || 0),
    output_tokens: Number(data?.usage?.output_tokens || 0),
  });

  return NextResponse.json({
    content: data.content,
    stop_reason: data.stop_reason,
    provider: 'anthropic',
    model: activeModel,
  });
}
