import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { provisionOrUpdateMember } from '@/lib/provisioning';
import type { Database } from '@/lib/database.types';

async function requireAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado', status: 401 as const, supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    return { error: 'Se requiere rol de Administrador', status: 403 as const, supabase, user, profile: null };
  }

  return { error: null, status: 200 as const, supabase, user, profile };
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    users?: Array<{
      email?: string;
      fullName?: string;
      phone?: string;
      country?: string;
      role?: 'student' | 'mentor' | 'admin';
      status?: 'active' | 'past_due' | 'canceled' | 'expired' | 'refunded' | 'paused' | 'inactive';
      source?: 'hotmart' | 'whop' | 'manual';
      planName?: string;
      expiresAt?: string | null;
      notes?: string;
      password?: string;
      sendInviteEmail?: boolean;
    }>;
    email?: string;
    fullName?: string;
    phone?: string;
    country?: string;
    role?: 'student' | 'mentor' | 'admin';
    status?: 'active' | 'past_due' | 'canceled' | 'expired' | 'refunded' | 'paused' | 'inactive';
    source?: 'hotmart' | 'whop' | 'manual';
    planName?: string;
    expiresAt?: string | null;
    notes?: string;
    password?: string;
    sendInviteEmail?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || auth.supabase;
  const { data: settings } = await db.from('app_settings').select('*').eq('id', 1).maybeSingle();
  const originUrl = new URL(request.url).origin;

  const list = Array.isArray(body.users) ? body.users.slice(0, 200) : [body];
  const results = [];

  for (const item of list) {
    const email = String(item.email || '')
      .trim()
      .toLowerCase();
    if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) {
      results.push({ email, ok: false, error: 'Correo inválido' });
      continue;
    }

    const res = await provisionOrUpdateMember(db, adminClient, settings, {
      email,
      fullName: item.fullName,
      phone: item.phone,
      country: item.country,
      role: item.role || 'student',
      status: item.status || 'active',
      source: item.source || 'manual',
      planName: item.planName || 'Geny Pro',
      expiresAt: item.expiresAt || null,
      notes: item.notes || '',
      password: item.password,
      sendInviteEmail: item.sendInviteEmail !== false,
      eventName: 'alta_manual_admin',
      updatedByUserId: auth.user.id,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || originUrl,
    });

    results.push({
      email: res.email,
      ok: true,
      userId: res.userId,
      createdAuthUser: res.createdAuthUser,
      invitedByEmail: res.invitedByEmail,
      serviceRoleActive: Boolean(adminClient),
    });
  }

  return NextResponse.json({ ok: true, results });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    userId?: string;
    pendingId?: string;
    email?: string;
    fullName?: string;
    phone?: string;
    country?: string;
    role?: 'student' | 'mentor' | 'admin';
    dailyAiLimitOverride?: number | null;
    status?: 'active' | 'past_due' | 'canceled' | 'expired' | 'refunded' | 'paused' | 'inactive';
    source?: 'hotmart' | 'whop' | 'manual';
    planName?: string;
    expiresAt?: string | null;
    graceUntil?: string | null;
    notes?: string;
    newPassword?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || auth.supabase;

  // Update pending pre-approval if pendingId provided without userId
  if (body.pendingId && !body.userId) {
    const { error } = await db
      .from('pending_memberships')
      .update({
        ...(body.status ? { status: body.status } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.fullName !== undefined ? { full_name: body.fullName } : {}),
        ...(body.expiresAt !== undefined ? { expires_at: body.expiresAt || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      })
      .eq('id', body.pendingId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.userId) {
    return NextResponse.json({ error: 'Falta userId' }, { status: 400 });
  }

  const { data: curProf } = await db
    .from('profiles')
    .select('email')
    .eq('id', body.userId)
    .maybeSingle();

  const normalizedNewEmail = body.email ? body.email.trim().toLowerCase() : '';
  const wantsEmailChange = Boolean(normalizedNewEmail && normalizedNewEmail !== curProf?.email);
  const wantsPwdChange = Boolean(body.newPassword && body.newPassword.trim().length > 0);

  if ((wantsEmailChange || wantsPwdChange) && !adminClient) {
    return NextResponse.json(
      {
        error:
          'Configura SUPABASE_SERVICE_ROLE_KEY en el servidor para cambiar el correo o la contraseña de un alumno.',
      },
      { status: 400 }
    );
  }

  if (wantsPwdChange && body.newPassword!.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres.' },
      { status: 400 }
    );
  }

  // Handle email or password update in Supabase Auth if requested
  if ((wantsEmailChange || wantsPwdChange) && adminClient) {
    const authPatch: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (wantsEmailChange) {
      authPatch.email = normalizedNewEmail;
      authPatch.email_confirm = true;
    }
    if (wantsPwdChange) {
      authPatch.password = body.newPassword!;
    }
    const { error: authErr } = await adminClient.auth.admin.updateUserById(
      body.userId,
      authPatch
    );
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }
  }

  // Update profile fields
  const profilePatch: Database['public']['Tables']['profiles']['Update'] = {};
  if (wantsEmailChange) profilePatch.email = normalizedNewEmail;
  if (body.fullName !== undefined) profilePatch.full_name = body.fullName.trim() || 'Trader';
  if (body.phone !== undefined) profilePatch.phone = body.phone.trim();
  if (body.country !== undefined) profilePatch.country = body.country.trim();
  if (body.role) profilePatch.role = body.role;
  if (body.dailyAiLimitOverride !== undefined) {
    profilePatch.daily_ai_limit_override = body.dailyAiLimitOverride;
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error: profErr } = await db
      .from('profiles')
      .update(profilePatch)
      .eq('id', body.userId);
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // Update membership fields
  if (
    wantsEmailChange ||
    body.status !== undefined ||
    body.source !== undefined ||
    body.planName !== undefined ||
    body.expiresAt !== undefined ||
    body.graceUntil !== undefined ||
    body.notes !== undefined
  ) {
    const { data: curMem } = await db
      .from('memberships')
      .select('*')
      .eq('user_id', body.userId)
      .maybeSingle();

    const nextStatus = body.status ?? curMem?.status ?? 'active';
    const { error: memErr } = await db.from('memberships').upsert(
      {
        user_id: body.userId,
        status: nextStatus,
        source: body.source ?? curMem?.source ?? 'manual',
        plan_name: body.planName ?? curMem?.plan_name ?? 'Geny Pro',
        buyer_email: wantsEmailChange ? normalizedNewEmail : curMem?.buyer_email ?? curProf?.email ?? null,
        expires_at: body.expiresAt !== undefined ? body.expiresAt || null : curMem?.expires_at ?? null,
        grace_until:
          body.graceUntil !== undefined ? body.graceUntil || null : curMem?.grace_until ?? null,
        notes: body.notes !== undefined ? body.notes : curMem?.notes ?? '',
        canceled_at: ['canceled', 'refunded', 'expired'].includes(nextStatus)
          ? new Date().toISOString()
          : null,
        updated_by: auth.user.id,
      },
      { onConflict: 'user_id' }
    );
    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
