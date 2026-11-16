import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { evaluateMembershipAccess } from '@/lib/membership';
import { SignOutButton } from '@/components/SignOutButton';
import { ShieldAlert, ExternalLink, RefreshCw, MessageCircle } from 'lucide-react';

export default async function RenovarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: profile }, { data: membership }, { data: links }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('memberships').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('portal_links').select('*').eq('id', 1).maybeSingle(),
  ]);

  const access = evaluateMembershipAccess(profile, membership);
  if (access.allowed) {
    redirect('/');
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ width: 'min(540px, 100%)' }}>
        <div className="panel" style={{ borderColor: 'rgba(255, 77, 109, 0.45)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <ShieldAlert size={30} color="var(--loss)" />
            <div>
              <h1 style={{ fontSize: 22 }}>Membresía no activa</h1>
              <span className={`badge ${access.status}`} style={{ marginTop: 4 }}>
                {access.statusLabel}
              </span>
            </div>
          </div>

          <p style={{ color: '#D4DEE7', margin: '10px 0' }}>
            Hola <b>{profile?.full_name || user.email}</b> ({user.email}). {access.reason}
          </p>

          <div
            style={{
              background: 'rgba(140, 255, 46, 0.06)',
              border: '1px solid rgba(140, 255, 46, 0.3)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 13.5,
              marginBottom: 18,
            }}
          >
            <b>Tus datos están a salvo:</b> Tu bitácora de operaciones, avance del Reto 21, metas y estrategias siguen guardados. En cuanto actives o renueves tu membresía volverás exactamente donde te quedaste.
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {links?.renewal_url_whop ? (
              <a
                href={links.renewal_url_whop}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ width: '100%' }}
              >
                Activar / Renovar en Whop <ExternalLink size={16} />
              </a>
            ) : null}

            {links?.renewal_url_hotmart ? (
              <a
                href={links.renewal_url_hotmart}
                target="_blank"
                rel="noopener noreferrer"
                className={links?.renewal_url_whop ? 'btn ghost' : 'btn'}
                style={{ width: '100%' }}
              >
                Activar / Renovar en Hotmart <ExternalLink size={16} />
              </a>
            ) : null}

            {links?.support_whatsapp_url ? (
              <a
                href={links.support_whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn ghost"
                style={{ width: '100%' }}
              >
                <MessageCircle size={16} /> Contactar soporte por WhatsApp
              </a>
            ) : null}
          </div>

          <div
            className="inline"
            style={{ justifyContent: 'space-between', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}
          >
            <Link href="/" className="btn sm ghost">
              <RefreshCw size={14} /> Ya renové, verificar acceso
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
