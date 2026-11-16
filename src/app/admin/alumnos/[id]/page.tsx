import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudentDossierClient } from '@/components/StudentDossierClient';

export const dynamic = 'force-dynamic';

export default async function StudentDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: viewerProfile },
    { data: profile },
    { data: membership },
    { data: appState },
    { data: events },
    { data: notes },
    { data: aiLogs },
  ] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user?.id || '').maybeSingle(),
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('memberships').select('*').eq('user_id', id).maybeSingle(),
    supabase.from('user_app_state').select('*').eq('user_id', id).maybeSingle(),
    supabase
      .from('user_events')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('mentor_notes')
      .select('*')
      .eq('student_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_usage_logs')
      .select('usage_date, input_tokens, output_tokens')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <StudentDossierClient
      isAdmin={viewerProfile?.role === 'admin'}
      profile={profile}
      membership={membership}
      appState={appState}
      events={events || []}
      initialNotes={notes || []}
      aiCountRecent={(aiLogs || []).length}
    />
  );
}
