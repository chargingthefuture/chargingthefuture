export function resolveWebSentryDsn(): string {
  // NEXT_PUBLIC_SENTRY_DSN must be read here, by that literal name: Next.js inlines only
  // NEXT_PUBLIC_* variables into browser bundles, so in the browser the plain SENTRY_DSN read is
  // always empty. Until this chain existed the client never saw a DSN, Sentry.init never ran in the
  // browser, and no member-side error reached Sentry (agent-team pass finding). The server keeps
  // reading SENTRY_DSN; set NEXT_PUBLIC_SENTRY_DSN to the same value in Infisical/Render.
  return (process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? '').trim();
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
