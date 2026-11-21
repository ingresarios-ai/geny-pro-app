'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck } from 'lucide-react';

declare global {
  interface Window {
    __GENY_SIGNOUT__?: () => Promise<void>;
    bootGenyPro?: (boot: Record<string, unknown>) => void;
  }
}

export interface GenyProAppProps {
  userId: string;
  email: string;
  firstName: string;
  role: string;
  membershipLabel: string;
  isGracePeriod: boolean;
  graceEndsAt: string | null;
  renewalUrlWhop: string;
  renewalUrlHotmart: string;
  initialState: Record<string, unknown> | null;
}

export function GenyProApp({
  userId,
  email,
  firstName,
  role,
  membershipLabel,
  isGracePeriod,
  graceEndsAt,
  renewalUrlWhop,
  renewalUrlHotmart,
  initialState,
}: GenyProAppProps) {
  useEffect(() => {
    window.__GENY_SIGNOUT__ = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = '/login';
    };

    if (typeof window.bootGenyPro === 'function') {
      window.bootGenyPro({
        userId,
        email,
        firstName,
        role,
        membershipLabel,
        initialState,
      });
    }
  }, [userId, email, firstName, role, membershipLabel, initialState]);

  const isStaff = role === 'admin' || role === 'mentor';
  const renewLink = renewalUrlWhop || renewalUrlHotmart;

  return (
    <>
      <div className="wrap">
        <header className="top">
          <button type="button" className="logo" data-go="inicio" aria-label="Ir al inicio">
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
          </button>

          <nav className="tabs" id="tabs" aria-label="Módulos" />

          <div className="icons">
            {isStaff ? (
              <a
                href="/admin"
                className="btn sm ghost"
                style={{ borderColor: 'rgba(140,255,46,.5)', color: 'var(--lime)' }}
                title="Abrir Panel de Administración"
              >
                <ShieldCheck size={16} />
                Admin
              </a>
            ) : null}

            <div
              className="mode-switch"
              id="modeSwitch"
              role="group"
              aria-label="Versión de la interfaz"
              title="Cambia en cualquier momento entre la versión Original y la Nueva versión guiada"
            >
              <button type="button" data-ui="classic" aria-pressed="false">
                Original
              </button>
              <button type="button" data-ui="guided" aria-pressed="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
                Nueva
              </button>
            </div>

            <button type="button" className="ibtn" id="bell" aria-label="Avisos" aria-expanded="false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />
              </svg>
              <span className="dot" id="bellDot" hidden />
            </button>

            <button type="button" className="ibtn" id="me" aria-label="Mi cuenta" aria-expanded="false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="10" r="3.5" />
                <path d="M5.5 19c1.5-3 4-4 6.5-4s5 1 6.5 4" />
              </svg>
            </button>

            <div className="pop" id="pop" hidden />
          </div>
        </header>

        {isGracePeriod ? (
          <div className="banner danger-banner">
            <span>
              <b>Aviso de suscripción:</b> Tu último cobro está pendiente. Tienes acceso de cortesía
              {graceEndsAt
                ? ` hasta el ${new Date(graceEndsAt).toLocaleDateString('es', {
                    day: 'numeric',
                    month: 'long',
                  })}`
                : ''}{' '}
              mientras se actualiza tu método de pago.
            </span>
            {renewLink ? (
              <a
                href={renewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn sm danger"
              >
                Actualizar pago
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="banner" id="demo" hidden>
          <span>Estás viendo datos de ejemplo para que explores cómo funciona Geny Pro.</span>
          <button type="button" className="btn sm" data-act="clearDemo">
            Empezar con mis datos
          </button>
        </div>

        <main id="view" aria-live="polite" />
      </div>

      <nav className="mob-tabs" id="mobTabs" aria-label="Navegación móvil" hidden />

      <button
        type="button"
        className="geny-fab"
        id="genyFab"
        aria-label="Abrir consola Geny AI"
        aria-expanded="false"
        aria-controls="genyDrawer"
        hidden
      >
        <span className="g-led" aria-hidden="true" />
        <span>Geny AI</span>
      </button>

      <dialog className="geny-drawer" id="genyDrawer" aria-label="Consola Geny AI">
        <div className="geny-drawer-scroller" id="genyDrawerScroller">
          <div className="geny-drawer-sheet" id="genyDrawerSheet">
            <div className="geny-drawer-head">
              <div className="inline" style={{ gap: 10, flexWrap: 'nowrap' }}>
                <div className="geny-drawer-avatar" id="dAvatar" />
                <div>
                  <strong>Geny AI · Co-Pilot</strong>
                  <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                    Co-Pilot cuantitativo · consulta o ejecuta registros
                  </span>
                </div>
              </div>
              <div className="inline" style={{ gap: 6 }}>
                <button
                  type="button"
                  className="btn sm ghost"
                  id="genyDrawerFull"
                  title="Abrir consola en pantalla completa"
                >
                  Expandir
                </button>
                <button
                  type="button"
                  className="x"
                  id="genyDrawerClose"
                  aria-label="Cerrar panel de Geny AI"
                  autoFocus
                  style={{ fontSize: 18, padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="chips geny-drawer-chips" id="dChips" />
            <div className="msgs" id="dMsgs" />
            <form className="compose" id="dCompose">
              <textarea
                id="dQ"
                placeholder="Pregúntale a Geny o pídele registrar algo…"
                aria-label="Mensaje para Geny"
              />
              <button className="btn" id="dSend" type="submit">
                Enviar
              </button>
            </form>
          </div>
        </div>
      </dialog>

      <div id="modalRoot" />
      <div className="toast" id="toast" role="status" hidden />

      <Script
        src="/vendor/lightweight-charts.js"
        strategy="afterInteractive"
      />
      <Script
        src="/vendor/xlsx.full.min.js"
        strategy="afterInteractive"
      />
      <Script
        src="/geny-engine.js?v=20261121b"
        strategy="afterInteractive"
        onReady={() => {
          if (typeof window.bootGenyPro === 'function') {
            window.bootGenyPro({
              userId,
              email,
              firstName,
              role,
              membershipLabel,
              initialState,
            });
          }
        }}
      />
    </>
  );
}

