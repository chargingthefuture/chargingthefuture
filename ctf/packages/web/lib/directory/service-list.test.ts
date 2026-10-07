import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The page-of-profiles read for One Percent's Find matches. Same credential and same exclusions as
// the single read, stricter limits, and an audit line that never names who was on the page. These
// tests pin each of those, through the route handler where the behavior is the route's.

const queryDb = vi.fn();
vi.mock('lib/db/postgres', () => ({ queryDb: (...args: unknown[]) => queryDb(...args) }));

const audits: Array<Record<string, unknown>> = [];
vi.mock('lib/directory/audit', () => ({
  logDirectoryAudit: (event: Record<string, unknown>) => audits.push(event),
}));
vi.mock('lib/observability/report', () => ({ reportError: () => undefined }));

const KEPT = process.env.DIRECTORY_SERVICE_TOKENS;
const KEPT_TAXONOMY = process.env.TAXONOMY_SERVICE_TOKENS;
const GOOD = 'Bearer one-percent.an-invented-directory-secret-000';

let clock = Date.parse('2026-01-01T00:00:00Z');

function request(query = '', authorization: string | null = GOOD) {
  return new Request(`https://example.test/api/directory/service/profiles${query}`, {
    headers: authorization ? { authorization, 'x-forwarded-for': '203.0.113.9' } : {},
  });
}

function row(n: number, extra: Record<string, unknown> = {}) {
  return {
    cursor_created_at: `2026-01-0${n}T00:00:00.000000Z`,
    id: `demo-profile-${n}`,
    claimed: n % 2 === 0,
    first_name: 'Invented',
    last_name: `Person ${n}`,
    headline: null,
    job_title_name: 'Plumber',
    sector_name: 'Trades',
    skills: ['Pipe fitting'],
    profile_url: null,
    city: null,
    state: null,
    country: 'US',
    ...extra,
  };
}

async function get(query = '', authorization: string | null = GOOD) {
  // Each call lands in a fresh one-second window so the burst limit only bites where a test wants it.
  clock += 2_000;
  vi.setSystemTime(clock);
  const { GET } = await import('@/app/api/directory/service/profiles/route');
  return GET(request(query, authorization));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  queryDb.mockReset();
  audits.length = 0;
  process.env.DIRECTORY_SERVICE_TOKENS = 'one-percent:an-invented-directory-secret-000';
  process.env.TAXONOMY_SERVICE_TOKENS = 'one-percent:an-invented-taxonomy-secret-000';
});

afterEach(() => {
  vi.useRealTimers();
  if (KEPT === undefined) delete process.env.DIRECTORY_SERVICE_TOKENS;
  else process.env.DIRECTORY_SERVICE_TOKENS = KEPT;
  if (KEPT_TAXONOMY === undefined) delete process.env.TAXONOMY_SERVICE_TOKENS;
  else process.env.TAXONOMY_SERVICE_TOKENS = KEPT_TAXONOMY;
});

describe('GET /api/directory/service/profiles — who gets in', () => {
  it('refuses a request with no credential', async () => {
    const response = await get('', null);
    expect(response.status).toBe(401);
    expect(queryDb).not.toHaveBeenCalled();
  });

  it('refuses the taxonomy credential and an unknown consumer', async () => {
    expect((await get('', 'Bearer one-percent.an-invented-taxonomy-secret-000')).status).toBe(401);
    expect((await get('', 'Bearer somebody-else.an-invented-directory-secret-000')).status).toBe(401);
    expect(queryDb).not.toHaveBeenCalled();
  });

  it('refuses a second page inside the same second', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    expect((await get()).status).toBe(200);
    const { GET } = await import('@/app/api/directory/service/profiles/route');
    const again = await GET(request());
    expect(again.status).toBe(429);
    expect(again.headers.get('Retry-After')).toBeTruthy();
  });
});

describe('GET /api/directory/service/profiles — what comes back', () => {
  it('keeps the restriction rule in the query and hides nothing for being unclaimed', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    await get();
    const sql = String(queryDb.mock.calls[0][0]);
    // Restricted owners with scope all or contact are left out; trading alone is not a reason.
    expect(sql).toMatch(/account_restrictions/);
    expect(sql).toMatch(/restriction_scope IN \('all', 'contact'\)/);
    expect(sql).not.toMatch(/trading/);
    // Deleting a profile removes its row, so the table itself is the deleted-profile filter; the
    // read must not reach for anything else that could bring one back.
    expect(sql).toMatch(/FROM directory_profiles p/);
    expect(sql).not.toMatch(/directory_deletion_events|directory_user_extension/);
    expect(sql).not.toMatch(/AND p\.claimed_by_user_id IS NOT NULL/);
    // Nothing but the desk's fields.
    expect(sql).not.toMatch(/\bbio\b|venmo|monero|bitcoin|service_credits_address|claimed_by_user_id AS|nominated_by|invited_by/);
  });

  it('answers the same fields as the single read and no account id', async () => {
    queryDb.mockResolvedValue({ rows: [row(1), row(2)] });
    const response = await get();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['nextCursor', 'profiles']);
    expect(body.nextCursor).toBeNull();
    expect(Object.keys(body.profiles[0]).sort()).toEqual(
      ['city', 'claimed', 'country', 'firstName', 'headline', 'id', 'jobTitle', 'lastName', 'profileUrl', 'sector', 'skills', 'state'],
    );
    expect(body.profiles.map((p: { claimed: boolean }) => p.claimed)).toEqual([false, true]);
    expect(JSON.stringify(body)).not.toMatch(/user_|claimedByUserId|cursor_created_at/);
  });

  it('pages 50 by default and caps a larger ask at 100', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    await get();
    expect(queryDb.mock.calls[0][1]).toEqual([51]);
    await get('?limit=500');
    expect(queryDb.mock.calls[1][1]).toEqual([101]);
    await get('?limit=7');
    expect(queryDb.mock.calls[2][1]).toEqual([8]);
  });

  it('refuses a limit that is not a whole number above zero, and a cursor it did not give out', async () => {
    expect((await get('?limit=0')).status).toBe(400);
    expect((await get('?limit=ten')).status).toBe(400);
    expect((await get('?cursor=not-a-cursor')).status).toBe(400);
    const forged = Buffer.from(JSON.stringify({ c: "x' OR '1'='1", i: 'a', n: 2 })).toString('base64url');
    expect((await get(`?cursor=${forged}`)).status).toBe(400);
    expect(queryDb).not.toHaveBeenCalled();
  });

  it('walks pages in a fixed order and starts each one after the last row of the page before', async () => {
    queryDb.mockResolvedValueOnce({ rows: [row(1), row(2), row(3)] });
    const first = await (await get('?limit=2')).json();
    expect(first.profiles.map((p: { id: string }) => p.id)).toEqual(['demo-profile-1', 'demo-profile-2']);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(String(queryDb.mock.calls[0][0])).toMatch(/ORDER BY p\.created_at ASC, p\.id::text ASC\s+LIMIT \$1/);

    queryDb.mockResolvedValueOnce({ rows: [row(3)] });
    const second = await (await get(`?limit=2&cursor=${first.nextCursor}`)).json();
    const [sql, params] = queryDb.mock.calls[1];
    expect(String(sql)).toMatch(/\(p\.created_at, p\.id::text\) > \(\$2::timestamptz, \$3::text\)/);
    expect(params).toEqual([3, '2026-01-02T00:00:00.000000Z', 'demo-profile-2']);
    expect(second.profiles.map((p: { id: string }) => p.id)).toEqual(['demo-profile-3']);
    expect(second.nextCursor).toBeNull();
  });

  it('audits the consumer, page size and page number, and never a profile id', async () => {
    queryDb.mockResolvedValueOnce({ rows: [row(1), row(2), row(3)] });
    const first = await (await get('?limit=2')).json();
    queryDb.mockResolvedValueOnce({ rows: [row(3)] });
    await get(`?limit=2&cursor=${first.nextCursor}`);
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({
      actorId: 'service:one-percent',
      command: 'directory.profile.service.list',
      targetId: 'page-1',
      metadata: { pageSize: 2, page: 1, returned: 2, hasMore: true },
    });
    expect(audits[1]).toMatchObject({ targetId: 'page-2', metadata: { page: 2, returned: 1, hasMore: false } });
    expect(JSON.stringify(audits)).not.toMatch(/demo-profile/);
  });

  it('says the database did not answer when the query fails', async () => {
    queryDb.mockRejectedValue(new Error('connection refused'));
    const response = await get();
    expect(response.status).toBe(503);
    expect((await response.json()).message).toMatch(/did not answer/);
  });
});
