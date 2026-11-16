import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppSettingsRow, Database, Json } from '@/lib/database.types';
import { dispatchToGhl } from '@/lib/ghl';

export interface ProvisionMemberInput {
  email: string;
  fullName?: string;
  phone?: string;
  country?: string;
  role?: 'student' | 'mentor' | 'admin';
  status: 'active' | 'past_due' | 'canceled' | 'expired' | 'refunded' | 'paused' | 'inactive';
  source: 'hotmart' | 'whop' | 'manual';
  planName?: string;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalOrderId?: string | null;
  expiresAt?: string | null;
  graceUntil?: string | null;
  notes?: string;
  password?: string;
  sendInviteEmail?: boolean;
  eventName: string;
  updatedByUserId?: string | null;
  appUrl?: string;
}

export async function provisionOrUpdateMember(
  db: SupabaseClient<Database>,
  adminAuthClient: SupabaseClient<Database> | null,
  settings: AppSettingsRow | null,
  input: ProvisionMemberInput
): Promise<{
  userId: string | null;
  email: string;
  createdAuthUser: boolean;
  invitedByEmail: boolean;
}> {
  const email = input.email.trim().toLowerCase();
  const role = input.role || 'student';
  const planName = input.planName?.trim() || 'Geny Pro';
  const fullName = input.fullName?.trim() || email.split('@')[0] || 'Trader';
  const phone = input.phone?.trim() || '';
  const country = input.country?.trim() || '';

  // 1. Always upsert pending_memberships as durable authorization source
  await db.from('pending_memberships').upsert(
    {
      email,
      full_name: fullName,
      phone,
      country,
      role,
      status: input.status,
      source: input.source,
      plan_name: planName,
      external_customer_id: input.externalCustomerId ?? null,
      external_subscription_id: input.externalSubscriptionId ?? null,
      external_order_id: input.externalOrderId ?? null,
      expires_at: input.expiresAt ?? null,
      grace_until: input.graceUntil ?? null,
      notes: input.notes ?? '',
    },
    { onConflict: 'email' }
  );

  // 2. Locate existing profile by email OR by external subscription/customer ID (critical for Whop Discord/Apple emails)
  let existingProfileId: string | null = null;

  const { data: byEmail } = await db
    .from('profiles')
    .select('id, email, full_name, phone, country, stage, active_days_count, last_active_date, last_module, consent_at, created_at')
    .eq('email', email)
    .maybeSingle();

  if (byEmail) {
    existingProfileId = byEmail.id;
  } else if (input.externalSubscriptionId) {
    const { data: bySub } = await db
      .from('memberships')
      .select('user_id')
      .eq('external_subscription_id', input.externalSubscriptionId)
      .maybeSingle();
    if (bySub) existingProfileId = bySub.user_id;
  } else if (input.externalCustomerId) {
    const { data: byCust } = await db
      .from('memberships')
      .select('user_id')
      .eq('external_customer_id', input.externalCustomerId)
      .maybeSingle();
    if (byCust) existingProfileId = byCust.user_id;
  }

  let createdAuthUser = false;
  let invitedByEmail = false;

  // 3. Create or invite user in Supabase Auth when service_role is available and user doesn't exist yet
  if (!existingProfileId && adminAuthClient && (input.status === 'active' || input.source === 'manual')) {
    const siteUrl = (
      input.appUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');

    if (input.password && input.password.length >= 6) {
      const { data: created, error } = await adminAuthClient.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone,
          country,
          role,
          membership_active: input.status === 'active' ? 'true' : 'false',
        },
      });
      if (!error && created.user) {
        existingProfileId = created.user.id;
        createdAuthUser = true;
      }
    } else if (input.sendInviteEmail !== false) {
      const { data: invited, error } = await adminAuthClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            full_name: fullName,
            phone,
            country,
            role,
            membership_active: input.status === 'active' ? 'true' : 'false',
          },
          redirectTo: `${siteUrl}/auth/callback?next=/actualizar-clave`,
        }
      );
      if (!error && invited.user) {
        existingProfileId = invited.user.id;
        createdAuthUser = true;
        invitedByEmail = true;
      } else {
        // Fallback: create confirmed user without password so they can sign in with OTP / Magic Link immediately
        const { data: created } = await adminAuthClient.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            phone,
            country,
            role,
            membership_active: input.status === 'active' ? 'true' : 'false',
          },
        });
        if (created?.user) {
          existingProfileId = created.user.id;
          createdAuthUser = true;
        }
      }
    }
  }

  // 4. Update profile & membership if user exists
  if (existingProfileId) {
    const profilePatch: Database['public']['Tables']['profiles']['Update'] = {};
    if (input.fullName?.trim()) profilePatch.full_name = fullName;
    if (phone) profilePatch.phone = phone;
    if (country) profilePatch.country = country;
    if (input.role) profilePatch.role = role;

    if (Object.keys(profilePatch).length > 0) {
      await db.from('profiles').update(profilePatch).eq('id', existingProfileId);
    }

    await db.from('memberships').upsert(
      {
        user_id: existingProfileId,
        status: input.status,
        source: input.source,
        plan_name: planName,
        external_customer_id: input.externalCustomerId ?? undefined,
        external_subscription_id: input.externalSubscriptionId ?? undefined,
        external_order_id: input.externalOrderId ?? undefined,
        buyer_email: email,
        expires_at: input.expiresAt ?? null,
        grace_until: input.graceUntil ?? null,
        canceled_at: ['canceled', 'refunded', 'expired'].includes(input.status)
          ? new Date().toISOString()
          : null,
        notes: input.notes ?? '',
        updated_by: input.updatedByUserId ?? null,
      },
      { onConflict: 'user_id' }
    );

    await db
      .from('pending_memberships')
      .update({ claimed_by: existingProfileId, claimed_at: new Date().toISOString() })
      .eq('email', email);

    // Log user event & dispatch to GHL
    const { data: evRow } = await db
      .from('user_events')
      .insert({
        user_id: existingProfileId,
        email,
        event_name: input.eventName,
        stage: byEmail?.stage || 'Registrado',
        module: 'membresia',
        payload: {
          status: input.status,
          source: input.source,
          plan_name: planName,
          expires_at: input.expiresAt ?? null,
        } as Json,
      })
      .select('id')
      .maybeSingle();

    const { data: freshProfile } = await db
      .from('profiles')
      .select(
        'id, email, full_name, phone, country, stage, active_days_count, last_active_date, last_module, consent_at, created_at'
      )
      .eq('id', existingProfileId)
      .maybeSingle();

    const { data: stateRow } = await db
      .from('user_app_state')
      .select('*')
      .eq('user_id', existingProfileId)
      .maybeSingle();

    if (freshProfile) {
      await dispatchToGhl({
        db,
        settings,
        profile: freshProfile,
        membership: {
          status: input.status,
          source: input.source,
          plan_name: planName,
          expires_at: input.expiresAt ?? null,
        },
        stateSummary: stateRow,
        eventName: input.eventName,
        category: 'membership',
        userEventId: evRow?.id,
      });
    }
  }

  return {
    userId: existingProfileId,
    email,
    createdAuthUser,
    invitedByEmail,
  };
}
