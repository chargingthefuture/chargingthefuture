export function resolveWebSentryDsn(): string {
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
