import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  csrfDeny: null as Response | null,
  admin: true,
  setFail: null as Error | null,
  set: [] as { userId: string; on: boolean; actorUserId: string }[],
  audits: [] as Record<string, unknown>[],
}));

vi.mock('lib/unlock/_lib', () => ({
  ensureUnlockMutationCsrf: vi.fn(() => state.csrfDeny),
  requireUnlockAdminAccess: vi.fn(async () =>
    state.admin
      ? { allowed: true, auth: { userId: 'admin_1' } }
      : { allowed: false, response: new Response(JSON.stringify({ ok: false }), { status: 403 }) },
  ),
  resolveUnlockRequestId: vi.fn(() => 'req_1'),
  unlockErrorResponse: vi.fn((message: string, status: number) => new Response(JSON.stringify({ ok: false, message }), { status })),
}));
vi.mock('lib/demo-mode/demo-accounts', () => ({
  setDemoAccount: vi.fn(async (input: { userId: string; on: boolean; actorUserId: string }) => {
    if (state.setFail) throw state.setFail;
    state.set.push(input);
  }),
}));
vi.mock('lib/unlock/repository', () => ({
  insertUnlockAudit: vi.fn(async (entry: Record<string, unknown>) => {
    state.audits.push(entry);
  }),
}));
vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));

import { POST } from 'app/api/unlock/admin/demo-accounts/route';

function post(body: unknown): Request {
  return new Request('http://localhost/api/unlock/admin/demo-accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  state.csrfDeny = null;
  state.admin = true;
  state.setFail = null;
  state.set = [];
  state.audits = [];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('POST /api/unlock/admin/demo-accounts', () => {
  it('switches an account to demo data and audits it', async () => {
    const res = await POST(post({ userId: 'user_demo', demo: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: 'user_demo', demo: true });
    expect(state.set).toEqual([{ userId: 'user_demo', on: true, actorUserId: 'admin_1' }]);
    expect(state.audits[0]).toMatchObject({ command: 'unlock.admin.signups.demo', targetUserId: 'user_demo', metadata: { demo: true } });
  });

  it('switches it back', async () => {
    await POST(post({ userId: 'user_demo', demo: false }));
    expect(state.set[0].on).toBe(false);
  });

  it('refuses a caller who is not an admin', async () => {
    state.admin = false;
    const res = await POST(post({ userId: 'user_demo', demo: true }));
    expect(res.status).toBe(403);
    expect(state.set).toEqual([]);
  });

  it('refuses a request without the CSRF header', async () => {
    state.csrfDeny = new Response(null, { status: 403 });
    const res = await POST(post({ userId: 'user_demo', demo: true }));
    expect(res.status).toBe(403);
    expect(state.set).toEqual([]);
  });

  it('refuses a missing user id or a demo value that is not true or false', async () => {
    expect((await POST(post({ demo: true }))).status).toBe(400);
    expect((await POST(post({ userId: 'user_demo', demo: 'yes' }))).status).toBe(400);
    expect((await POST(post('{not json'))).status).toBe(400);
    expect(state.set).toEqual([]);
  });

  it('says what failed when the write fails', async () => {
    state.setFail = new Error('connection refused');
    const res = await POST(post({ userId: 'user_demo', demo: true }));
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(await res.json())).toContain('demo data switch could not be changed');
    expect(state.audits).toEqual([]);
  });
});
