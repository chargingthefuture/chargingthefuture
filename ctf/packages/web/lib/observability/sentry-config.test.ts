import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveWebSentryDsn, shouldEnableWebSentry } from './sentry-config';

const DSN = 'https://public@example.ingest.sentry.io/1';

describe('resolveWebSentryDsn and the OBSERVABILITY_PROVIDER switch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the DSN when the provider is unset', () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    vi.stubEnv('OBSERVABILITY_PROVIDER', '');
    expect(resolveWebSentryDsn()).toBe(DSN);
  });

  it('returns the DSN when the provider is sentry, in any case', () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    vi.stubEnv('OBSERVABILITY_PROVIDER', ' Sentry ');
    expect(resolveWebSentryDsn()).toBe(DSN);
  });

  it('returns no DSN, so reporting is off, when the provider names anything else', () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    vi.stubEnv('CTF_SKIP_SENTRY_NEXTJS', '');
    vi.stubEnv('NEXT_PHASE', '');
    vi.stubEnv('OBSERVABILITY_PROVIDER', 'noop');
    expect(resolveWebSentryDsn()).toBe('');
    expect(shouldEnableWebSentry()).toBe(false);
  });
});
