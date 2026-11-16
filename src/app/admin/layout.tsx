import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminNav } from '@/components/AdminNav';
import { SignOutButton } from '@/components/SignOutButton';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/admin');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['admin', 'mentor'].includes(profile.role)) {
    redirect('/');
  }

  return (
    <div className="adm-shell">
      <header className="adm-header">
        <div className="inline" style={{ gap: 14 }}>
          <a href="/" className="logo" title="Volver a Geny Pro">
            <svg viewBox="0 0 46 40" aria-hidden="true">
              <path d="M23 2 44 38H33L23 20 13 38H2Z" fill="#8CFF2E" />
              <path d="M23 20 33 38H13Z" fill="#3E8F00" />
            </svg>
            <span>
              <span className="t">
                GENY <span className="pro">ADMIN</span>
              </span>
              <span className="by">Panel de Control · INGRESARIOS</span>
            </span>
          </a>
        </div>

        <AdminNav />

        <div className="inline">
          <a href="/" className="btn sm ghost">
            <ArrowLeft size={15} /> App Alumno
          </a>
          <SignOutButton />
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
