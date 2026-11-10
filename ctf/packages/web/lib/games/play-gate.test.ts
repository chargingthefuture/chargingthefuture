import { beforeEach, describe, expect, it, vi } from 'vitest';

const access = vi.hoisted(() => ({ evaluatePluginAccess: vi.fn() }));
const failing = vi.hoisted(() => ({ on: false }));
vi.mock('lib/auth/server-authz', () => ({
  evaluatePluginAccess: (...args: unknown[]) =>
    failing.on ? Promise.reject(new Error('database unreachable')) : access.evaluatePluginAccess(...args),
}));
const reported = vi.hoisted(() => ({ ops: [] as string[] }));
vi.mock('lib/observability/report', () => ({
  reportError: (_error: unknown, context: { op: string }) => {
    reported.ops.push(context.op);
  },
}));

import { DAILY_PLAY_ACCESS, readDailyGate } from './play-gate';

// Playing the puzzle of the day is for any signed-in member (owner decision, 2026-11-10). The /games
// page sends the play screens only when this answers 'play'.
describe('who may play the puzzle of the day', () => {
  beforeEach(() => access.evaluatePluginAccess.mockReset());

  it('asks for a signed-in member, approved or not', async () => {
    access.evaluatePluginAccess.mockResolvedValue({ allowed: true, userId: 'u1' });
    await readDailyGate();
    expect(access.evaluatePluginAccess).toHaveBeenCalledWith(DAILY_PLAY_ACCESS);
    expect(DAILY_PLAY_ACCESS.minUnlockTier).not.toBe('approved_full');
  });

  it('lets a signed-in member play', async () => {
    access.evaluatePluginAccess.mockResolvedValue({ allowed: true, userId: 'u1' });
    expect(await readDailyGate()).toEqual({ gate: 'play', reason: null });
  });

  it('tells a visitor with no session to sign in', async () => {
    access.evaluatePluginAccess.mockResolvedValue({ allowed: false, status: 401, code: 'AUTH_UNAUTHORIZED', reason: 'no_active_session' });
    expect((await readDailyGate()).gate).toBe('sign-in');
  });

  it('closes it to a restricted account', async () => {
    access.evaluatePluginAccess.mockResolvedValue({ allowed: false, status: 403, code: 'AUTH_FORBIDDEN_POLICY', reason: 'account_restricted' });
    expect((await readDailyGate()).gate).toBe('closed');
  });

  it('does not let anyone play when the check itself fails, and says why', async () => {
    // A plain function rather than the mock: vitest counts a rejected promise held in a mock's
    // results as this test's own failure, even though readDailyGate catches it.
    failing.on = true;
    const read = await readDailyGate();
    failing.on = false;
    expect(read.gate).toBe('unavailable');
    expect(read.reason).toContain('database unreachable');
    expect(reported.ops).toContain('play_gate');
  });
});
