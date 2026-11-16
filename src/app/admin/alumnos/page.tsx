import { createClient } from '@/lib/supabase/server';
import { AdminUsersClient, type AdminUserRecord } from '@/components/AdminUsersClient';

export const dynamic = 'force-dynamic';

export default async function AdminAlumnosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: viewerProfile },
    { data: profiles },
    { data: memberships },
    { data: states },
    { data: pending },
  ] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user?.id || '').maybeSingle(),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('memberships').select('*'),
    supabase.from('user_app_state').select('*'),
    supabase
      .from('pending_memberships')
      .select('*')
      .is('claimed_by', null)
      .order('created_at', { ascending: false }),
  ]);

  const memMap = new Map((memberships || []).map((m) => [m.user_id, m]));
  const stateMap = new Map((states || []).map((s) => [s.user_id, s]));

  const records: AdminUserRecord[] = (profiles || []).map((p) => {
    const m = memMap.get(p.id);
    const st = stateMap.get(p.id);
    return {
      id: p.id,
      pendingId: null,
      isPendingClaim: false,
      email: p.email,
      fullName: p.full_name,
      phone: p.phone,
      country: p.country,
      role: p.role,
      stage: p.stage,
      status: m?.status || 'inactive',
      source: m?.source || 'manual',
      planName: m?.plan_name || 'Geny Pro',
      expiresAt: m?.expires_at || null,
      graceUntil: m?.grace_until || null,
      activeDays: p.active_days_count || 0,
      lastActiveAt: p.last_active_at || null,
      lastModule: p.last_module || 'inicio',
      createdAt: p.created_at,
      isDemo: st ? st.is_demo : true,
      generalScore: st?.general_score || 0,
      retoDays: st?.reto21_closed_days || 0,
      tradesCount: st?.trades_count || 0,
      totalPnl: Number(st?.total_pnl || 0),
      winRate: Number(st?.win_rate || 0),
    };
  });

  const existingEmails = new Set(records.map((r) => r.email.toLowerCase()));
  for (const pm of pending || []) {
    if (existingEmails.has(pm.email.toLowerCase())) continue;
    records.push({
      id: `pending-${pm.id}`,
      pendingId: pm.id,
      isPendingClaim: true,
      email: pm.email,
      fullName: pm.full_name || pm.email.split('@')[0],
      phone: pm.phone || '',
      country: pm.country || '',
      role: pm.role,
      stage: 'Pendiente 1er ingreso',
      status: pm.status,
      source: pm.source,
      planName: pm.plan_name,
      expiresAt: pm.expires_at,
      graceUntil: pm.grace_until,
      activeDays: 0,
      lastActiveAt: null,
      lastModule: '—',
      createdAt: pm.created_at,
      isDemo: true,
      generalScore: 0,
      retoDays: 0,
      tradesCount: 0,
      totalPnl: 0,
      winRate: 0,
    });
  }

  return (
    <AdminUsersClient
      initialRecords={records}
      isAdmin={viewerProfile?.role === 'admin'}
    />
  );
}
