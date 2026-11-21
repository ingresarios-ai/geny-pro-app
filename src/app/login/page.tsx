'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next') || '/';
  const nextPath =
    rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\')
      ? rawNext
      : '/';
  const urlError = searchParams.get('error');

  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    urlError === 'enlace_expirado'
      ? 'El enlace expiró o ya fue utilizado. Solicita un nuevo código o enlace.'
      : ''
  );
  const [info, setInfo] = useState('');
  const [supportUrl, setSupportUrl] = useState('');
  const [privacyUrl, setPrivacyUrl] = useState('');

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase
      .from('portal_links')
      .select('support_whatsapp_url, privacy_url')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const wa = String(data.support_whatsapp_url || '').trim();
        const priv = String(data.privacy_url || '').trim();
        if (wa.startsWith('https://')) setSupportUrl(wa);
        if (priv.startsWith('https://')) setPrivacyUrl(priv);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handlePasswordSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);

    try {
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr) {
        setError(
          'Correo o contraseña incorrectos. Si acabas de comprar y aún no tienes clave, usa "Acceso con código al correo" o "¿Olvidaste o creas tu clave?".'
        );
        setBusy(false);
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError('No pudimos conectar con el servidor. Intenta de nuevo.');
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Escribe primero tu correo electrónico arriba para enviarte el enlace.');
      return;
    }
    setError('');
    setInfo('');
    setBusy(true);

    try {
      const checkRes = await fetch('/api/auth/check-buyer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const checkJson = await checkRes.json();
      if (!checkJson.allowed) {
        setError(checkJson.reason || 'Este correo no tiene membresía registrada.');
        setBusy(false);
        return;
      }

      const supabase = createClient();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/actualizar-clave`,
      });

      if (resetErr) {
        setError(resetErr.message);
      } else {
        setInfo(
          'Te enviamos un enlace a tu correo para crear o restablecer tu contraseña. Revisa también Spam o Promociones.'
        );
      }
    } catch {
      setError('No pudimos enviar el correo en este momento.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setError('');
    setInfo('');
    setBusy(true);

    try {
      const checkRes = await fetch('/api/auth/check-buyer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const checkJson = await checkRes.json();
      if (!checkJson.allowed) {
        setError(
          checkJson.reason ||
            'Este correo no tiene una membresía activa. Usa el mismo correo de tu compra en Hotmart o Whop.'
        );
        setBusy(false);
        return;
      }

      const supabase = createClient();
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (otpErr) {
        setError(otpErr.message);
      } else {
        setOtpSent(true);
        setInfo(
          'Te enviamos un correo con un enlace directo y un código de acceso. Haz clic en el enlace o escribe el código aquí abajo.'
        );
      }
    } catch {
      setError('Error de red al enviar el código.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const supabase = createClient();
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpCode.trim(),
        type: 'email',
      });

      if (verifyErr) {
        setError('Código inválido o vencido. Revisa el correo o solicita uno nuevo.');
        setBusy(false);
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError('No pudimos verificar el código.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="logo" style={{ cursor: 'default' }}>
            <svg viewBox="0 0 46 40" aria-hidden="true">
              <path d="M23 2 44 38H33L23 20 13 38H2Z" fill="#8CFF2E" />
              <path d="M23 20 33 38H13Z" fill="#3E8F00" />
            </svg>
            <span>
              <span className="t">
                GENY <span className="pro">PRO</span>
              </span>
              <span className="by">by INGRESARIOS</span>
            </span>
          </div>
        </div>

        <div className="panel glow">
          <div className="ph" style={{ marginBottom: 8 }}>
            <h1 style={{ fontSize: 23 }}>Ingresa a tu cuenta</h1>
          </div>
          <p className="hint" style={{ marginBottom: 16 }}>
            Acceso exclusivo para miembros activos de Geny Pro. Tu avance se sincroniza en todos tus dispositivos.
          </p>

          <div
            className="tfs"
            role="tablist"
            aria-label="Método de ingreso"
            style={{ width: '100%', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr' }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'password'}
              aria-pressed={mode === 'password'}
              onClick={() => {
                setMode('password');
                setError('');
                setInfo('');
              }}
              style={{ fontFamily: 'var(--body)' }}
            >
              Con contraseña
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'otp'}
              aria-pressed={mode === 'otp'}
              onClick={() => {
                setMode('otp');
                setError('');
                setInfo('');
              }}
              style={{ fontFamily: 'var(--body)' }}
            >
              Código / enlace al correo
            </button>
          </div>

          {error ? (
            <p className="r21alert" role="alert" style={{ marginBottom: 12 }}>
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="r21ok" role="status" style={{ marginBottom: 12 }}>
              {info}
            </p>
          ) : null}

          {mode === 'password' ? (
            <form className="f" onSubmit={handlePasswordSignIn}>
              <div>
                <label htmlFor="signin-email" style={{ display: 'block', marginBottom: 5, fontSize: 13, color: 'var(--muted)' }}>
                  Correo electrónico de tu compra
                </label>
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  enterKeyHint="next"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@correo.com"
                />
              </div>

              <div>
                <label htmlFor="current-password" style={{ display: 'block', marginBottom: 5, fontSize: 13, color: 'var(--muted)' }}>
                  Contraseña
                </label>
                <div className="pwd-wrap">
                  <input
                    id="current-password"
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    enterKeyHint="done"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                  />
                  <button
                    type="button"
                    className="pwd-toggle"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPwd ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn" disabled={busy} style={{ width: '100%', marginTop: 4 }}>
                {busy ? 'Ingresando…' : 'Iniciar sesión'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={busy}
                  style={{
                    background: 'none',
                    border: 0,
                    color: 'var(--lime)',
                    fontSize: 13,
                    textDecoration: 'underline',
                  }}
                >
                  ¿Olvidaste o aún no creas tu contraseña?
                </button>
              </div>
            </form>
          ) : !otpSent ? (
            <form className="f" onSubmit={handleSendOtp}>
              <div>
                <label htmlFor="otp-email" style={{ display: 'block', marginBottom: 5, fontSize: 13, color: 'var(--muted)' }}>
                  Correo electrónico de tu compra
                </label>
                <input
                  id="otp-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  enterKeyHint="send"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@correo.com"
                />
              </div>
              <button type="submit" className="btn" disabled={busy} style={{ width: '100%' }}>
                {busy ? 'Enviando acceso…' : 'Enviar enlace y código a mi correo'}
              </button>
              <p className="hint" style={{ textAlign: 'center' }}>
                Ideal para tu primer ingreso después de comprar en Hotmart o Whop.
              </p>
            </form>
          ) : (
            <form className="f" onSubmit={handleVerifyOtp}>
              <div>
                <label htmlFor="otp-code" style={{ display: 'block', marginBottom: 5, fontSize: 13, color: 'var(--muted)' }}>
                  Código recibido en {email}
                </label>
                <input
                  id="otp-code"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  enterKeyHint="done"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="num"
                  style={{ fontSize: 20, letterSpacing: '0.2em', textAlign: 'center' }}
                />
              </div>
              <button type="submit" className="btn" disabled={busy} style={{ width: '100%' }}>
                {busy ? 'Verificando…' : 'Verificar e ingresar'}
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode('');
                }}
              >
                Usar otro correo o reenviar
              </button>
            </form>
          )}
        </div>

        <p className="hint" style={{ textAlign: 'center' }}>
          ¿Compraste en Whop o Hotmart con otro correo?{' '}
          {supportUrl ? (
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--lime)', textDecoration: 'underline' }}
            >
              Escribe a soporte de INGRESARIOS
            </a>
          ) : (
            'Escribe a soporte de INGRESARIOS'
          )}{' '}
          para actualizar tu acceso en segundos.
          {privacyUrl ? (
            <>
              {' · '}
              <a
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--muted)', textDecoration: 'underline' }}
              >
                Política de privacidad
              </a>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-shell"><p className="muted">Cargando…</p></div>}>
      <LoginFormInner />
    </Suspense>
  );
}

