import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { evaluateMembershipAccess } from '@/lib/membership';
import { GenyProApp } from '@/components/GenyProApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: profile }, { data: membership }, { data: appState }, { data: portalLinks }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('memberships').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_app_state').select('state').eq('user_id', user.id).maybeSingle(),
      supabase.from('portal_links').select('*').eq('id', 1).maybeSingle(),
    ]);

  const access = evaluateMembershipAccess(profile, membership);
  if (!access.allowed) {
    redirect('/renovar');
  }

  const fullName = profile?.full_name || user.email?.split('@')[0] || 'Trader';
  const firstName = fullName.trim().split(/\s+/)[0].slice(0, 30) || 'Trader';
  const sourceLabels: Record<string, string> = {
    hotmart: 'Hotmart',
    whop: 'Whop',
    manual: 'Acceso directo',
  };
  const membershipLabel =
    profile?.role === 'admin'
      ? 'Super Admin'
      : profile?.role === 'mentor'
        ? 'Mentor'
        : `${access.statusLabel} · ${sourceLabels[access.source] || access.source}`;

  const initialState =
    appState?.state &&
    typeof appState.state === 'object' &&
    !Array.isArray(appState.state) &&
    Object.keys(appState.state).length > 0
      ? (appState.state as Record<string, unknown>)
      : null;

  return (
    <GenyProApp
      userId={user.id}
      email={profile?.email || user.email || ''}
      firstName={firstName}
      role={profile?.role || 'student'}
      membershipLabel={membershipLabel}
      isGracePeriod={access.isGracePeriod}
      graceEndsAt={access.graceEndsAt}
      renewalUrlWhop={portalLinks?.renewal_url_whop || ''}
      renewalUrlHotmart={portalLinks?.renewal_url_hotmart || ''}
      initialState={initialState}
    />
  );
}

