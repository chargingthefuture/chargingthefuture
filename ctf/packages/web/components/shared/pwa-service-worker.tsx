'use client';

import { useEffect } from 'react';
import { reportError } from '../../lib/observability/report';

// Registers the service worker (public/sw.js) app-wide on load, so the web app meets the PWA
// install criteria everywhere (owner decision, 2026-07-20 — make the web app installable on
// Android). The Foundation call-alerts component also registers it when a member enables push;
// registration is idempotent, so both paths coexist. Renders nothing.
export function PwaServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // Register after load so it never competes with first paint.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((registerError: unknown) => {
        // The app works without it, but the install prompt and push delivery depend on it, so a
        // failure is reported rather than lost.
        reportError(registerError, { area: 'pwa', op: 'service_worker_register' });
      });
    };
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
