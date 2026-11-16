'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';
import { useState } from 'react';

export function SignOutButton({ className = 'btn sm ghost' }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button type="button" className={className} onClick={handleSignOut} disabled={busy}>
      <LogOut size={15} />
      {busy ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
