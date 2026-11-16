import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  let body: { email?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    // When service_role is not yet set in local dev, allow OTP request; database trigger + /renovar still enforce membership
    return NextResponse.json({ allowed: true });
  }

  const [{ data: profile }, { data: pending }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, role, memberships(status, expires_at, grace_until)')
      .eq('email', email)
      .maybeSingle(),
    admin
      .from('pending_memberships')
      .select('id, status, role')
      .eq('email', email)
      .maybeSingle(),
  ]);

  if (profile) {
    return NextResponse.json({ allowed: true });
  }

  if (pending && (pending.role === 'admin' || pending.role === 'mentor' || ['active', 'past_due'].includes(pending.status))) {
    return NextResponse.json({ allowed: true });
  }

  return NextResponse.json({
    allowed: false,
    reason: 'Este correo no tiene una membresía registrada en Geny Pro. Usa el correo con el que realizaste tu compra en Hotmart o Whop.',
  });
}
