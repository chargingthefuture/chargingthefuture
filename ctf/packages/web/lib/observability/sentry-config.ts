export function resolveWebSentryDsn(): string {
  // SENTRY_DSN is the standard key on Render.
  // RAILWAY_SENTRY_DSN is kept as a fallback during the Railway → Render migration window.
  return (process.env.SENTRY_DSN ?? process.env.RAILWAY_SENTRY_DSN ?? '').trim();
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
