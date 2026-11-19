import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { evaluateMembershipAccess } from '@/lib/membership';

const GENY_SYSTEM_PROMPT = `Eres Geny, mentora de inteligencia financiera, trading y alto rendimiento de INGRESARIOS. Hablas en español latino, cálida, directa y motivadora, con frases cortas y humor ligero; usa emojis con moderación. Usas el método PEDEM (Planear, Ejecutar, Documentar, Evaluar, Mejorar) y dices "bitácora", nunca "journal". Basa tus respuestas en los datos del usuario cuando sean relevantes y cita cifras concretas. Es educativo: no prometas rentabilidad ni des recomendaciones personalizadas de comprar o vender un activo concreto; recuerda la gestión del riesgo cuando aplique. Si el usuario pide registrar algo, usa la herramienta correspondiente y confirma lo que guardaste. Responde en texto plano, sin markdown con # ni tablas; máximo 180 palabras salvo que pidan más.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Geny IA no está configurada aún' }, { status: 501 });
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
    messages?: Array<{ role: string; content: unknown }>;
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

  const tools = (Array.isArray(body.tools) ? body.tools : []).slice(0, 8).map((x) => ({
    name: String(x.name || '').slice(0, 64),
    description: String(x.description || '').slice(0, 500),
    input_schema: x.input_schema || { type: 'object', properties: {} },
  }));

  const userContext = typeof body.context === 'string' ? body.context.slice(0, 8000) : '';
  const systemText = userContext
    ? `${GENY_SYSTEM_PROMPT}\n\n${userContext}`
    : GENY_SYSTEM_PROMPT;

  const model =
    settings?.ai_model?.trim() || process.env.GENY_MODEL || 'claude-haiku-4-5';

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(
    /\/$/,
    ''
  );

  const anthropicRes = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 750,
      system: systemText,
      messages,
      ...(tools.length ? { tools } : {}),
    }),
  });

  if (!anthropicRes.ok) {
    return NextResponse.json(
      { error: `El modelo respondió ${anthropicRes.status}` },
      { status: anthropicRes.status === 429 ? 429 : 502 }
    );
  }

  const data = await anthropicRes.json();

  await supabase.from('ai_usage_logs').insert({
    user_id: user.id,
    usage_date: todayIso,
    model,
    input_tokens: Number(data?.usage?.input_tokens || 0),
    output_tokens: Number(data?.usage?.output_tokens || 0),
  });

  return NextResponse.json({
    content: data.content,
    stop_reason: data.stop_reason,
  });
}

