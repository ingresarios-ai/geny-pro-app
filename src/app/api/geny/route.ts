import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { evaluateMembershipAccess } from '@/lib/membership';

export const maxDuration = 60;

const GENY_SYSTEM_PROMPT = `Eres Geny, mentora de inteligencia financiera, trading y alto rendimiento de INGRESARIOS. Hablas en español latino, cálida, directa y motivadora, con frases cortas y humor ligero; usa emojis con moderación. Usas el método PEDEM (Planear, Ejecutar, Documentar, Evaluar, Mejorar) y dices "bitácora", nunca "journal". Basa tus respuestas en los datos del usuario cuando sean relevantes y cita cifras concretas. Es educativo: no prometas rentabilidad ni des recomendaciones personalizadas de comprar o vender un activo concreto; recuerda la gestión del riesgo cuando aplique. Si el usuario pide registrar algo, usa la herramienta correspondiente y confirma lo que guardaste. Responde en texto plano, sin markdown con # ni tablas; máximo 180 palabras salvo que pidan más.`;

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

function sanitizeGeminiSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { type: 'object', properties: {} };
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (!GEMINI_SCHEMA_KEYS.has(k)) continue;
    if (k === 'properties' && v && typeof v === 'object' && !Array.isArray(v)) {
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

export async function POST(request: Request) {
  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

  if (!anthropicKey && !geminiKey) {
    return NextResponse.json(
      { error: 'Geny IA requiere configurar GEMINI_API_KEY o ANTHROPIC_API_KEY en el servidor' },
      { status: 501 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
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
  ]);

  if (!evaluateMembershipAccess(profile, membership).allowed || !profile) {
    return NextResponse.json({ error: 'Membresía inactiva' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: settings } = admin
    ? await admin.from('app_settings').select('ai_model, default_ai_daily_limit').eq('id', 1).maybeSingle()
    : { data: null };

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
    activeModel = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  } else {
    provider = 'anthropic';
    activeModel = process.env.GENY_MODEL?.trim() || 'claude-haiku-4-5';
  }

  if (provider === 'gemini') {
    const geminiBaseUrl = (
      process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'
    ).replace(/\/$/, '');

    const geminiBody = {
      systemInstruction: { parts: [{ text: systemText }] },
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

    const geminiRes = await fetch(
      `${geminiBaseUrl}/v1beta/models/${encodeURIComponent(activeModel)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify(geminiBody),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json(
        { error: `Gemini respondió ${geminiRes.status}` },
        { status: geminiRes.status === 429 ? 429 : 502 }
      );
    }

    const data = await geminiRes.json();
    const candidate = data?.candidates?.[0];
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
      model: activeModel,
      input_tokens: Number(data?.usageMetadata?.promptTokenCount || 0),
      output_tokens: Number(data?.usageMetadata?.candidatesTokenCount || 0),
    });

    return NextResponse.json({
      content: normalizedBlocks,
      stop_reason: stopReason,
      provider: 'gemini',
      model: activeModel,
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
    return NextResponse.json(
      { error: `Claude respondió ${anthropicRes.status}` },
      { status: anthropicRes.status === 429 ? 429 : 502 }
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
