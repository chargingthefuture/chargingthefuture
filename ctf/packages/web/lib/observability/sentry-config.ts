// The one secret this reads is SENTRY_DSN — the key that already exists in Infisical. There is no
// NEXT_PUBLIC_ copy of it and none should be added: a second key holding the same value is a
// duplicate that can drift.
//
// Getting that value into the browser takes one step, because Next.js inlines only NEXT_PUBLIC_*
// names into client bundles, so a plain process.env.SENTRY_DSN read is empty there. Instead the root
// layout renders the value the server already holds into the page as a global (see
// `SENTRY_DSN_GLOBAL` and its use in app/layout.tsx), and the browser reads it from there. That also
// keeps it a runtime value: no build argument, and rotating the secret takes effect on restart
// rather than requiring an image rebuild.
//
// A Sentry DSN is designed to sit in client code — it only permits sending events to the project —
// so rendering it into the page is its intended use, not an exposure.

/** Name of the window property the layout writes the DSN to. Keep in sync with app/layout.tsx. */
export const SENTRY_DSN_GLOBAL = '__ctfSentryDsn';

export function resolveWebSentryDsn(): string {
  if (typeof window !== 'undefined') {
    const fromPage = (window as unknown as Record<string, unknown>)[SENTRY_DSN_GLOBAL];
    return typeof fromPage === 'string' ? fromPage.trim() : '';
  }
  return (process.env.SENTRY_DSN ?? '').trim();
}

export function shouldEnableWebSentry(): boolean {
  if (process.env.CTF_SKIP_SENTRY_NEXTJS === '1') {
    return false;
  }

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return false;
  }

  return resolveWebSentryDsn().length > 0;
}
