'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ActualizarClavePage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Elige una contraseña de al menos 8 caracteres.');
      return;
    }

    setError('');
    setBusy(true);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({ password });

    if (updErr) {
      setError(updErr.message);
      setBusy(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="panel glow">
          <div className="ph" style={{ marginBottom: 8 }}>
            <h1 style={{ fontSize: 22 }}>Configura tu contraseña</h1>
          </div>
          <p className="hint" style={{ marginBottom: 16 }}>
            Guarda una contraseña segura para entrar rápido a Geny Pro desde tu computadora o celular.
          </p>

          {error ? (
            <p className="r21alert" role="alert" style={{ marginBottom: 12 }}>
              {error}
            </p>
          ) : null}

          <form className="f" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="new-password" style={{ display: 'block', marginBottom: 5, fontSize: 13, color: 'var(--muted)' }}>
                Nueva contraseña (mínimo 8 caracteres)
              </label>
              <div className="pwd-wrap">
                <input
                  id="new-password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Escribe tu nueva contraseña"
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                >
                  {showPwd ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Guardando…' : 'Guardar contraseña e ir a Geny Pro'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

