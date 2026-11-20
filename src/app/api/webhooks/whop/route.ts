import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { provisionOrUpdateMember } from '@/lib/provisioning';
import { resolvePublicAppUrl } from '@/lib/app-url';
import type { Json } from '@/lib/database.types';

export const maxDuration = 60;

function verifyWhopRequest(rawBody: string, headers: Headers, secret: string): boolean {
  if (!secret) return false;

  // 1. Direct secret header fallback (useful for custom Whop header or testing)
  const directSecret = headers.get('x-whop-secret') || '';
  if (
    directSecret &&
    directSecret.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(directSecret), Buffer.from(secret))
  ) {
    return true;
  }

  // 2. Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature: "v1,<base64>")
  const msgId = headers.get('webhook-id') || headers.get('svix-id');
  const msgTs = headers.get('webhook-timestamp') || headers.get('svix-timestamp');
  const msgSig = headers.get('webhook-signature') || headers.get('svix-signature');

  if (msgId && msgTs && msgSig) {
    const tsSec = Number(msgTs);
    if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 300) {
      return false;
    }

    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    let keyBytes: Buffer;
    try {
      keyBytes = secret.startsWith('whsec_')
        ? Buffer.from(cleanSecret, 'base64')
        : Buffer.from(cleanSecret, 'utf8');
    } catch {
      keyBytes = Buffer.from(cleanSecret, 'utf8');
    }
    const toSign = `${msgId}.${msgTs}.${rawBody}`;
    const expectedB64 = crypto.createHmac('sha256', keyBytes).update(toSign).digest('base64');
    const candidates = msgSig
      .split(' ')
      .map((part) => part.replace(/^v1,/, '').trim())
      .filter(Boolean);

    for (const cand of candidates) {
      if (
        cand.length === expectedB64.length &&
        crypto.timingSafeEqual(Buffer.from(cand), Buffer.from(expectedB64))
      ) {
        return true;
      }
    }
  }

  // 3. Legacy x-whop-signature hex HMAC-SHA256
  const legacySig = headers.get('x-whop-signature') || '';
  if (legacySig) {
    const hex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const cleanLegacy = legacySig.replace(/^sha256=/, '').trim();
    if (
      cleanLegacy.length === hex.length &&
      crypto.timingSafeEqual(Buffer.from(cleanLegacy), Buffer.from(hex))
    ) {
      return true;
    }
  }

  return false;
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor' },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { data: settings } = await admin
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (settings && !settings.whop_enabled) {
    return NextResponse.json({ ok: true, ignored: 'whop_disabled' });
  }

  const secret = (
    settings?.whop_webhook_secret ||
    process.env.WHOP_WEBHOOK_SECRET ||
    ''
  ).trim();

  if (!verifyWhopRequest(rawBody, request.headers, secret)) {
    await admin.from('webhook_logs').insert({
      direction: 'inbound',
      provider: 'whop',
      event_type: String(body.action || body.type || 'unknown'),
      status: 'failed',
      http_status: 401,
      payload: body as Json,
      error_message: secret
        ? 'Firma de webhook Whop inválida'
        : 'Whop Webhook Secret no configurado en Admin',
    });
    return NextResponse.json({ error: 'Firma Whop inválida' }, { status: 401 });
  }

  const eventType = String(body.action || body.type || body.event || '').toLowerCase();
  const externalEventId =
    request.headers.get('webhook-id') ||
    request.headers.get('svix-id') ||
    (body.id && body.data ? String(body.id) : null);

  if (externalEventId) {
    const { data: dup } = await admin
      .from('webhook_logs')
      .select('id')
      .eq('direction', 'inbound')
      .eq('provider', 'whop')
      .eq('external_event_id', externalEventId)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({ ok: true, idempotent: true });
    }
  }

  const data = (body.data && typeof body.data === 'object' ? body.data : body) as Record<
    string,
    unknown
  >;
  const userObj = (data.user && typeof data.user === 'object' ? data.user : {}) as Record<
    string,
    unknown
  >;
  const productObj = (
    data.product && typeof data.product === 'object' ? data.product : {}
  ) as Record<string, unknown>;

  const email = String(data.email || userObj.email || '')
    .trim()
    .toLowerCase();

  if (!email || !email.includes('@')) {
    await admin.from('webhook_logs').insert({
      direction: 'inbound',
      provider: 'whop',
      event_type: eventType || 'unknown',
      external_event_id: externalEventId,
      status: 'ignored',
      http_status: 200,
      payload: body as Json,
      error_message: 'Evento Whop sin email',
    });
    return NextResponse.json({ ok: true, ignored: 'missing_email' });
  }

  const fullName = String(userObj.name || userObj.username || data.name || '').trim();
  const whopUserId = String(userObj.id || data.user_id || '').trim() || null;
  const membershipId = String(data.membership_id || data.id || '').trim() || null;
  const planName = String(productObj.title || productObj.name || 'Geny Pro · Whop').slice(0, 80);

  let expiresIso: string | null = null;
  const rawExp = data.renewal_period_end ?? data.expires_at ?? data.valid_until;
  if (typeof rawExp === 'number' && rawExp > 1_000_000) {
    expiresIso = new Date(rawExp > 10_000_000_000 ? rawExp : rawExp * 1000).toISOString();
  } else if (typeof rawExp === 'string' && rawExp) {
    const parsed = Date.parse(rawExp);
    if (!Number.isNaN(parsed)) expiresIso = new Date(parsed).toISOString();
  }

  const graceDays = settings?.grace_days ?? 3;
  const originUrl = new URL(request.url).origin;

  let mappedStatus:
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'expired'
    | 'refunded'
    | null = null;
  let internalEventName = 'membresia_actualizada';
  let graceUntil: string | null = null;

  if (
    [
      'membership.went_valid',
      'membership_went_valid',
      'membership.activated',
      'membership_activated',
      'payment.succeeded',
      'payment_succeeded',
    ].includes(eventType)
  ) {
    mappedStatus = 'active';
    internalEventName = eventType.includes('payment') ? 'renovacion' : 'compra_aprobada';
  } else if (['payment.failed', 'payment_failed'].includes(eventType)) {
    mappedStatus = 'past_due';
    internalEventName = 'pago_atrasado';
    graceUntil = new Date(Date.now() + graceDays * 86400000).toISOString();
  } else if (
    [
      'membership.went_invalid',
      'membership_went_invalid',
      'membership.deactivated',
      'membership_deactivated',
    ].includes(eventType)
  ) {
    mappedStatus = 'canceled';
    internalEventName = 'membresia_cancelada';
  } else if (['payment.refunded', 'payment_refunded'].includes(eventType)) {
    mappedStatus = 'refunded';
    internalEventName = 'membresia_reembolsada';
  }

  if (!mappedStatus) {
    await admin.from('webhook_logs').insert({
      direction: 'inbound',
      provider: 'whop',
      event_type: eventType || 'unhandled',
      external_event_id: externalEventId,
      email,
      status: 'ignored',
      http_status: 200,
      payload: body as Json,
    });
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  const result = await provisionOrUpdateMember(admin, admin, settings, {
    email,
    fullName,
    status: mappedStatus,
    source: 'whop',
    planName,
    externalCustomerId: whopUserId,
    externalSubscriptionId: membershipId,
    expiresAt: mappedStatus === 'active' ? expiresIso : undefined,
    graceUntil,
    eventName: internalEventName,
    appUrl: resolvePublicAppUrl(originUrl),
  });

  await admin.from('webhook_logs').insert({
    direction: 'inbound',
    provider: 'whop',
    event_type: eventType,
    external_event_id: externalEventId,
    email,
    user_id: result.userId,
    status: 'processed',
    http_status: 200,
    payload: body as Json,
    response_body: JSON.stringify({
      mappedStatus,
      createdAuthUser: result.createdAuthUser,
      invitedByEmail: result.invitedByEmail,
    }),
  });

  return NextResponse.json({
    ok: true,
    status: mappedStatus,
    userId: result.userId,
  });
}

