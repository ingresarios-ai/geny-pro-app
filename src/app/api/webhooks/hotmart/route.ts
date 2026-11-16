import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { provisionOrUpdateMember } from '@/lib/provisioning';
import type { Json } from '@/lib/database.types';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor' },
      { status: 503 }
    );
  }

  const rawText = await request.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { data: settings } = await admin
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (settings && !settings.hotmart_enabled) {
    return NextResponse.json({ ok: true, ignored: 'hotmart_disabled' });
  }

  const expectedToken = (
    settings?.hotmart_hottok ||
    process.env.HOTMART_HOTTOK ||
    ''
  ).trim();

  const receivedToken = (
    request.headers.get('x-hotmart-hottok') ||
    String(body.hottok || '')
  ).trim();

  if (!expectedToken || !receivedToken || !safeEqual(receivedToken, expectedToken)) {
    await admin.from('webhook_logs').insert({
      direction: 'inbound',
      provider: 'hotmart',
      event_type: String(body.event || 'unknown'),
      status: 'failed',
      http_status: 401,
      payload: body as Json,
      error_message: expectedToken
        ? 'X-Hotmart-Hottok inválido'
        : 'Hotmart Hottok no configurado en Admin',
    });
    return NextResponse.json({ error: 'Token Hottok no válido' }, { status: 401 });
  }

  const eventType = String(body.event || '').toUpperCase();
  const externalEventId = body.id ? String(body.id) : null;

  if (externalEventId) {
    const { data: dup } = await admin
      .from('webhook_logs')
      .select('id')
      .eq('direction', 'inbound')
      .eq('provider', 'hotmart')
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
  const buyer = (data.buyer && typeof data.buyer === 'object' ? data.buyer : {}) as Record<
    string,
    unknown
  >;
  const purchase = (
    data.purchase && typeof data.purchase === 'object' ? data.purchase : {}
  ) as Record<string, unknown>;
  const subscription = (
    data.subscription && typeof data.subscription === 'object' ? data.subscription : {}
  ) as Record<string, unknown>;
  const subscriber = (
    subscription.subscriber && typeof subscription.subscriber === 'object'
      ? subscription.subscriber
      : {}
  ) as Record<string, unknown>;
  const planObj = (
    subscription.plan && typeof subscription.plan === 'object' ? subscription.plan : {}
  ) as Record<string, unknown>;
  const productObj = (
    data.product && typeof data.product === 'object' ? data.product : {}
  ) as Record<string, unknown>;
  const addressObj = (
    buyer.address && typeof buyer.address === 'object' ? buyer.address : {}
  ) as Record<string, unknown>;

  const email = String(buyer.email || data.email || '')
    .trim()
    .toLowerCase();

  if (!email || !email.includes('@')) {
    await admin.from('webhook_logs').insert({
      direction: 'inbound',
      provider: 'hotmart',
      event_type: eventType || 'unknown',
      external_event_id: externalEventId,
      status: 'ignored',
      http_status: 200,
      payload: body as Json,
      error_message: 'Evento sin correo del comprador',
    });
    return NextResponse.json({ ok: true, ignored: 'missing_email' });
  }

  const fullName = String(buyer.name || data.name || '').trim();
  const phone = String(buyer.checkout_phone || buyer.phone || '').trim();
  const country = String(addressObj.country || buyer.country || '').trim();
  const planName = String(planObj.name || productObj.name || 'Geny Pro · Hotmart').slice(0, 80);
  const subCode = subscriber.code ? String(subscriber.code) : null;
  const txId = purchase.transaction ? String(purchase.transaction) : null;
  const buyerUcode = buyer.ucode ? String(buyer.ucode) : null;

  let nextChargeIso: string | null = null;
  const rawNextCharge = purchase.date_next_charge;
  if (typeof rawNextCharge === 'number' && rawNextCharge > 1_000_000_000) {
    nextChargeIso = new Date(
      rawNextCharge > 10_000_000_000 ? rawNextCharge : rawNextCharge * 1000
    ).toISOString();
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

  if (['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'].includes(eventType)) {
    mappedStatus = 'active';
    internalEventName = 'compra_aprobada';
  } else if (['PURCHASE_OVERDUE', 'PURCHASE_DELAYED'].includes(eventType)) {
    mappedStatus = 'past_due';
    internalEventName = 'pago_atrasado';
    graceUntil = new Date(Date.now() + graceDays * 86400000).toISOString();
  } else if (['PURCHASE_REFUNDED', 'PURCHASE_PROTEST', 'PURCHASE_CHARGEBACK'].includes(eventType)) {
    mappedStatus = 'refunded';
    internalEventName = 'membresia_reembolsada';
  } else if (['PURCHASE_CANCELED', 'SUBSCRIPTION_CANCELLATION'].includes(eventType)) {
    mappedStatus = 'canceled';
    internalEventName = 'membresia_cancelada';
  } else if (eventType === 'PURCHASE_EXPIRED') {
    mappedStatus = 'expired';
    internalEventName = 'membresia_vencida';
  }

  if (!mappedStatus) {
    await admin.from('webhook_logs').insert({
      direction: 'inbound',
      provider: 'hotmart',
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
    phone,
    country,
    status: mappedStatus,
    source: 'hotmart',
    planName,
    externalCustomerId: buyerUcode,
    externalSubscriptionId: subCode,
    externalOrderId: txId,
    expiresAt: mappedStatus === 'active' ? nextChargeIso : undefined,
    graceUntil,
    eventName: internalEventName,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || originUrl,
  });

  await admin.from('webhook_logs').insert({
    direction: 'inbound',
    provider: 'hotmart',
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
