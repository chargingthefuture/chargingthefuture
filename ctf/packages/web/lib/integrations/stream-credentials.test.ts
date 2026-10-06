import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const isDemoMode = vi.fn<() => Promise<boolean>>();
vi.mock('lib/feature-flags', () => ({ isDemoMode: () => isDemoMode() }));

import { runWithForcedPool } from 'lib/db/postgres';
import { resolveStreamCredentials } from './stream-credentials';

const ENV_KEYS = ['STREAM_API_KEY', 'STREAM_API_SECRET', 'STREAM_API_KEY_STAGING', 'STREAM_API_SECRET_STAGING'] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.STREAM_API_KEY = 'prod-key';
  process.env.STREAM_API_SECRET = 'prod-secret';
  process.env.STREAM_API_KEY_STAGING = 'demo-key';
  process.env.STREAM_API_SECRET_STAGING = 'demo-secret';
  isDemoMode.mockReset();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('resolveStreamCredentials', () => {
  it('follows demo mode when nothing pins the schema', async () => {
    isDemoMode.mockResolvedValue(true);
    expect(await resolveStreamCredentials()).toEqual({ apiKey: 'demo-key', apiSecret: 'demo-secret' });
    isDemoMode.mockResolvedValue(false);
    expect(await resolveStreamCredentials()).toEqual({ apiKey: 'prod-key', apiSecret: 'prod-secret' });
  });

  it('uses the demo app inside a deletion pinned to the demo schema, with no signed-in caller', async () => {
    isDemoMode.mockResolvedValue(false);
    const credentials = await runWithForcedPool('demo', () => resolveStreamCredentials());
    expect(credentials).toEqual({ apiKey: 'demo-key', apiSecret: 'demo-secret' });
    expect(isDemoMode).not.toHaveBeenCalled();
  });

  it('uses the production app inside work pinned to the public schema, even for a demo participant', async () => {
    isDemoMode.mockResolvedValue(true);
    const credentials = await runWithForcedPool('public', () => resolveStreamCredentials());
    expect(credentials).toEqual({ apiKey: 'prod-key', apiSecret: 'prod-secret' });
  });

  it('never falls back to production when pinned to demo and the demo pair is missing', async () => {
    delete process.env.STREAM_API_KEY_STAGING;
    expect(await runWithForcedPool('demo', () => resolveStreamCredentials())).toBeNull();
  });
});
