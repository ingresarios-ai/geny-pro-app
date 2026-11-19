import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkIpRateLimit(request: Request): boolean {
  const fwd = request.headers.get('x-forwarded-for');
  const ip =
    (fwd ? fwd.split(',')[0].trim() : '') ||
    request.headers.get('x-real-ip')?.trim() ||
    'local';
  const now = Date.now();

  if (ipBuckets.size > 500) {
    for (const [key, bucket] of ipBuckets) {
      if (bucket.resetAt <= now) {
        ipBuckets.delete(key);
      }
    }
  }

  const cur = ipBuckets.get(ip);
  if (!cur || cur.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (cur.count >= RATE_LIMIT_MAX) {
    return false;
  }

  cur.count += 1;
  return true;
}

export async function POST(request: Request) {
  if (!checkIpRateLimit(request)) {
    return NextResponse.json(
      {
        allowed: false,
        reason: 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
      },
      { status: 429 }
    );
  }

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
