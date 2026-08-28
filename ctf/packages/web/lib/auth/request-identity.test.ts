import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Signing in is a Clerk event. The day is recorded where Clerk identity is resolved, not where a
// plugin access check runs — a member who reached only an SSR page, or a route that uses the
// identity layer directly, still turned up (owner decision, 2026-08-27). These tests drive the two
// authenticated paths and assert the recording happens on both.
const recorded: string[] = [];

vi.mock('lib/engagement/login-activity', () => ({
  recordLoginEvent: vi.fn((userId: string) => {
    recorded.push(userId);
  }),
}));

const verifyBearerIdentity = vi.fn();
vi.mock('lib/auth/verify-bearer', () => ({
  verifyBearerIdentity: (...args: unknown[]) => verifyBearerIdentity(...args),
}));

let requestHeaders = new Headers();
vi.mock('next/headers', () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: () => undefined }),
}));

const { resolveRequestIdentity } = await import('lib/auth/request-identity');

beforeEach(() => {
  recorded.length = 0;
  requestHeaders = new Headers();
  verifyBearerIdentity.mockReset();
  verifyBearerIdentity.mockResolvedValue(null);
});

describe('recording that a member turned up', () => {
  it('records a verified web session', async () => {
    requestHeaders.set('x-ctf-authenticated', 'true');
    requestHeaders.set('x-ctf-user-id', 'user_web');

    const identity = await resolveRequestIdentity();

    expect(identity.isAuthenticated).toBe(true);
    expect(recorded).toEqual(['user_web']);
  });

  it('records a verified bearer token, which is how the mobile app arrives', async () => {
    verifyBearerIdentity.mockResolvedValue({
      userId: 'user_mobile',
      username: null,
      firstName: null,
      lastName: null,
      role: null,
    });
    requestHeaders.set('authorization', 'Bearer token');

    const identity = await resolveRequestIdentity();

    expect(identity.isAuthenticated).toBe(true);
    expect(recorded).toEqual(['user_mobile']);
  });

  it('records nobody for an unauthenticated request', async () => {
    const identity = await resolveRequestIdentity();

    expect(identity.isAuthenticated).toBe(false);
    expect(recorded).toEqual([]);
  });

  it('ignores identity headers the middleware did not vouch for', async () => {
    // Without `x-ctf-authenticated` the headers are whatever a client sent, so they identify nobody
    // and must not put a row in the sign-in record.
    requestHeaders.set('x-ctf-user-id', 'user_spoofed');

    const identity = await resolveRequestIdentity();

    expect(identity.isAuthenticated).toBe(false);
    expect(recorded).toEqual([]);
  });
});

// The access gate is one caller of the identity layer among many. It must not carry its own copy of
// the recording, or a member's day depends again on a plugin check having run.
describe('the plugin access gate', () => {
  it('does not record sign-ins itself', () => {
    const gate = readFileSync(resolve(__dirname, 'server-authz.ts'), 'utf8');
    expect(gate).not.toContain('recordLoginEvent');
  });
});
