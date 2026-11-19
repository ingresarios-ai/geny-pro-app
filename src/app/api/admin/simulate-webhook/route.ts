import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { provisionOrUpdateMember } from '@/lib/provisioning';
import type { Json } from '@/lib/database.types';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!adminProfile || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Solo Administradores' }, { status: 403 });
  }

  let body: {
    provider?: 'hotmart' | 'whop';
    scenario?: 'approve' | 'overdue' | 'cancel' | 'refund';
    email?: string;
    fullName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const provider = body.provider === 'whop' ? 'whop' : 'hotmart';
  const scenario = body.scenario || 'approve';
  const email = String(body.email || '')
    .trim()
    .toLowerCase();

  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: 'Ingresa un correo válido para la simulación' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;
  const { data: settings } = await db.from('app_settings').select('*').eq('id', 1).maybeSingle();
  const graceDays = settings?.grace_days ?? 3;

  const statusMap = {
    approve: 'active' as const,
    overdue: 'past_due' as const,
    cancel: 'canceled' as const,
    refund: 'refunded' as const,
  };

  const eventLabelMap = {
    hotmart: {
      approve: 'PURCHASE_APPROVED (Simulado)',
      overdue: 'PURCHASE_OVERDUE (Simulado)',
      cancel: 'SUBSCRIPTION_CANCELLATION (Simulado)',
      refund: 'PURCHASE_REFUNDED (Simulado)',
    },
    whop: {
      approve: 'membership.went_valid (Simulado)',
      overdue: 'payment.failed (Simulado)',
      cancel: 'membership.went_invalid (Simulado)',
      refund: 'payment.refunded (Simulado)',
    },
  };

  const internalEventMap = {
    approve: 'compra_aprobada',
    overdue: 'pago_atrasado',
    cancel: 'membresia_cancelada',
    refund: 'membresia_reembolsada',
  };

  const status = statusMap[scenario];
  const graceUntil =
    scenario === 'overdue'
      ? new Date(Date.now() + graceDays * 86400000).toISOString()
      : null;

  const res = await provisionOrUpdateMember(db, adminClient, settings, {
    email,
    fullName: body.fullName || 'Alumno Prueba',
    status,
    source: provider,
    planName: `Geny Pro · ${provider === 'whop' ? 'Whop' : 'Hotmart'}`,
    graceUntil,
    sendInviteEmail: false,
    eventName: internalEventMap[scenario],
    updatedByUserId: user.id,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
  });

  await db.from('webhook_logs').insert({
    direction: 'inbound',
    provider,
    event_type: eventLabelMap[provider][scenario],
    email,
    user_id: res.userId,
    status: 'processed',
    http_status: 200,
    payload: {
      simulado_por_admin: true,
      scenario,
      email,
      fullName: body.fullName || 'Alumno Prueba',
    } as Json,
    response_body: JSON.stringify({ status, userId: res.userId }),
  });

  return NextResponse.json({
    ok: true,
    status,
    userId: res.userId,
    createdAuthUser: res.createdAuthUser,
    serviceRoleActive: Boolean(adminClient),
  });
}

