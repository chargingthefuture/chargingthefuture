import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The gate in front of a taxonomy read, which now answers to two kinds of caller: a member, and
// one named machine. These drive the branch rather than the credential itself (that is
// lib/auth/service-consumer.test.ts) -- what matters here is that a service caller never reaches
// the member checks, and that a caller who is not one still does.

const evaluatePluginAccess = vi.fn();
vi.mock('lib/auth/server-authz', () => ({
  evaluatePluginAccess: (...args: unknown[]) => evaluatePluginAccess(...args),
}));

const KEPT = process.env.TAXONOMY_SERVICE_TOKENS;

function read(headers: Record<string, string> = {}) {
  return new Request('https://app.example.invalid/api/skills-taxonomy/hierarchy', { headers });
}

describe('requireTaxonomyReadAccess', () => {
  beforeEach(() => {
    evaluatePluginAccess.mockReset();
    process.env.TAXONOMY_SERVICE_TOKENS = 'one-percent:a-secret-that-is-long-enough-0123456789';
  });
  afterEach(() => {
    if (KEPT === undefined) delete process.env.TAXONOMY_SERVICE_TOKENS;
    else process.env.TAXONOMY_SERVICE_TOKENS = KEPT;
  });

  it('lets the named consumer through without asking anything about a member', async () => {
    const { requireTaxonomyReadAccess } = await import('./read-gate');
    const gate = await requireTaxonomyReadAccess(
      read({ authorization: 'Bearer one-percent.a-secret-that-is-long-enough-0123456789' }),
    );

    expect(gate.allowed).toBe(true);
    if (!gate.allowed) return;
    expect(gate.reader).toEqual({
      kind: 'service',
      actorId: 'service:one-percent',
      reason: 'approved_consumer',
    });
    // A machine has no Unlock tier and no account to restrict, so asking would be asking a
    // question about a person who is not there.
    expect(evaluatePluginAccess).not.toHaveBeenCalled();
  });

  // The mobile app sends a Clerk session token on this same header. A token that is not a
  // service credential has to fall through rather than be refused.
  it('falls through to the member path for any other bearer token', async () => {
    evaluatePluginAccess.mockResolvedValue({ allowed: true, userId: 'user_123', role: null });
    const { requireTaxonomyReadAccess } = await import('./read-gate');
    const gate = await requireTaxonomyReadAccess(read({ authorization: 'Bearer a-clerk-token' }));

    expect(evaluatePluginAccess).toHaveBeenCalledTimes(1);
    expect(gate.allowed).toBe(true);
    if (!gate.allowed) return;
    expect(gate.reader).toEqual({
      kind: 'member',
      actorId: 'user_123',
      reason: 'approved_user_or_admin',
    });
  });

  // A route that does not hand over the request cannot be reached by a machine at all. That is
  // what keeps the service credential off every admin route and every write.
  it('is member-only when a route does not opt in', async () => {
    evaluatePluginAccess.mockResolvedValue({ allowed: true, userId: 'user_123', role: null });
    const { requireTaxonomyReadAccess } = await import('./read-gate');
    const gate = await requireTaxonomyReadAccess();

    expect(evaluatePluginAccess).toHaveBeenCalledTimes(1);
    expect(gate.allowed).toBe(true);
    if (!gate.allowed) return;
    expect(gate.reader.kind).toBe('member');
  });

  it('refuses a member the member path refuses', async () => {
    evaluatePluginAccess.mockResolvedValue({ allowed: false, status: 403, code: 'forbidden' });
    const { requireTaxonomyReadAccess } = await import('./read-gate');
    const gate = await requireTaxonomyReadAccess(read());

    expect(gate.allowed).toBe(false);
    if (gate.allowed) return;
    expect(gate.response.status).toBe(403);
  });

  // With no credential configured, a service token is just another string and the caller is
  // asked to be a member like anybody else.
  it('is member-only when no credential is configured', async () => {
    delete process.env.TAXONOMY_SERVICE_TOKENS;
    evaluatePluginAccess.mockResolvedValue({ allowed: false, status: 401, code: 'unauthorized' });
    const { requireTaxonomyReadAccess } = await import('./read-gate');
    const gate = await requireTaxonomyReadAccess(
      read({ authorization: 'Bearer one-percent.a-secret-that-is-long-enough-0123456789' }),
    );

    expect(evaluatePluginAccess).toHaveBeenCalledTimes(1);
    expect(gate.allowed).toBe(false);
  });
});
