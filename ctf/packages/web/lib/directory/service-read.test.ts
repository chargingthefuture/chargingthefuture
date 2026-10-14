import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The Directory profile read for One Percent. The limits that matter are enforced in the query and
// the gate, so these tests pin them: only a DIRECTORY_SERVICE_TOKENS consumer gets in, a profile
// comes back claimed or not and says which, a claimed one whose owner is restricted from connecting
// doesn't come back, and an id that could not be a Directory id never reaches the database.

const queryDb = vi.fn();
vi.mock('lib/db/postgres', () => ({ queryDb: (...args: unknown[]) => queryDb(...args) }));

const KEPT = process.env.DIRECTORY_SERVICE_TOKENS;
const KEPT_TAXONOMY = process.env.TAXONOMY_SERVICE_TOKENS;

function request(authorization?: string) {
  return new Request('https://example.test/api/directory/service/profiles/x', {
    headers: authorization ? { authorization, 'x-forwarded-for': '203.0.113.9' } : {},
  });
}

describe('requireDirectoryServiceRead', () => {
  beforeEach(() => {
    process.env.DIRECTORY_SERVICE_TOKENS = 'one-percent:an-invented-directory-secret-000';
    process.env.TAXONOMY_SERVICE_TOKENS = 'one-percent:an-invented-taxonomy-secret-000';
  });
  afterEach(() => {
    if (KEPT === undefined) delete process.env.DIRECTORY_SERVICE_TOKENS;
    else process.env.DIRECTORY_SERVICE_TOKENS = KEPT;
    if (KEPT_TAXONOMY === undefined) delete process.env.TAXONOMY_SERVICE_TOKENS;
    else process.env.TAXONOMY_SERVICE_TOKENS = KEPT_TAXONOMY;
  });

  it('lets the directory consumer through and names it for the audit line', async () => {
    const { requireDirectoryServiceRead } = await import('./service-read');
    const gate = requireDirectoryServiceRead(request('Bearer one-percent.an-invented-directory-secret-000'));
    expect(gate).toEqual({ allowed: true, actorId: 'service:one-percent' });
  });

  it('refuses a request with no credential, with a 401 that names the setting', async () => {
    const { requireDirectoryServiceRead } = await import('./service-read');
    const gate = requireDirectoryServiceRead(request());
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.response.status).toBe(401);
      expect(JSON.stringify(await gate.response.json())).toContain('DIRECTORY_SERVICE_TOKENS');
    }
  });

  it('refuses the taxonomy credential', async () => {
    const { requireDirectoryServiceRead } = await import('./service-read');
    const gate = requireDirectoryServiceRead(request('Bearer one-percent.an-invented-taxonomy-secret-000'));
    expect(gate.allowed).toBe(false);
  });

  it('refuses everybody when the setting is empty', async () => {
    delete process.env.DIRECTORY_SERVICE_TOKENS;
    const { requireDirectoryServiceRead } = await import('./service-read');
    const gate = requireDirectoryServiceRead(request('Bearer one-percent.an-invented-directory-secret-000'));
    expect(gate.allowed).toBe(false);
  });
});

describe('getProfileForService', () => {
  beforeEach(() => queryDb.mockReset());

  it('reads a profile claimed or not, says which, and keeps the restriction rule', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    const { getProfileForService } = await import('./service-read');
    await getProfileForService('00000000-0000-4000-8000-000000000001');
    const sql = String(queryDb.mock.calls[0][0]);
    expect(sql).toMatch(/\(p\.claimed_by_user_id IS NOT NULL\) AS claimed/);
    expect(sql).not.toMatch(/AND p\.claimed_by_user_id IS NOT NULL/);
    expect(sql).toMatch(/account_restrictions/);
    expect(sql).toMatch(/restriction_scope IN \('all', 'contact'\)/);
    expect(sql).not.toMatch(/\bbio\b|venmo|monero|bitcoin|service_credits_address|claimed_by_user_id AS/);
  });

  it('answers null for a missing profile', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    const { getProfileForService } = await import('./service-read');
    expect(await getProfileForService('00000000-0000-4000-8000-000000000001')).toBeNull();
  });

  it('never queries for an id that could not be a Directory id', async () => {
    const { getProfileForService } = await import('./service-read');
    expect(await getProfileForService("1' OR '1'='1")).toBeNull();
    expect(await getProfileForService('')).toBeNull();
    expect(queryDb).not.toHaveBeenCalled();
  });

  it('maps a row to the fields the desk shows', async () => {
    queryDb.mockResolvedValue({
      rows: [{
        id: 'demo-profile-1', claimed: false, first_name: 'Invented', last_name: 'Person', headline: 'Plumber',
        job_title_name: 'Plumber', sector_name: 'Trades', skills: ['Pipe fitting'],
        profile_url: 'https://example.test/invented', city: 'Nowhere', state: null, country: 'US',
      }],
    });
    const { getProfileForService } = await import('./service-read');
    expect(await getProfileForService('demo-profile-1')).toEqual({
      id: 'demo-profile-1', claimed: false, firstName: 'Invented', lastName: 'Person', headline: 'Plumber',
      jobTitle: 'Plumber', sector: 'Trades', skills: ['Pipe fitting'],
      profileUrl: 'https://example.test/invented', city: 'Nowhere', state: null, country: 'US',
    });
  });
});

describe('getClaimedProfileForAccountService', () => {
  beforeEach(() => queryDb.mockReset());

  it('asks for the claimed profile that account owns, with the same restriction rule', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    const { getClaimedProfileForAccountService } = await import('./service-read');
    await getClaimedProfileForAccountService('user_inventedAccount0001');
    const [sql, params] = queryDb.mock.calls[0];
    expect(String(sql)).toMatch(/p\.claimed_by_user_id = \$1/);
    expect(String(sql)).toMatch(/restriction_scope IN \('all', 'contact'\)/);
    expect(String(sql)).not.toMatch(/\bbio\b|claimed_by_user_id AS/);
    expect(params).toEqual(['user_inventedAccount0001']);
  });

  it('picks the same listing every time for an account that owns two', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    const { getClaimedProfileForAccountService } = await import('./service-read');
    await getClaimedProfileForAccountService('user_inventedAccount0001');
    const [sql] = queryDb.mock.calls[0];
    expect(String(sql)).toMatch(/ORDER BY p\.created_at ASC, p\.id::text ASC\s+LIMIT 1/);
  });

  it('never queries for something that could not be an account id', async () => {
    const { getClaimedProfileForAccountService } = await import('./service-read');
    expect(await getClaimedProfileForAccountService("user_x' OR '1'='1")).toBeNull();
    expect(await getClaimedProfileForAccountService('00000000-0000-4000-8000-000000000001')).toBeNull();
    expect(await getClaimedProfileForAccountService('')).toBeNull();
    expect(queryDb).not.toHaveBeenCalled();
  });

  it('answers the same fields as the by-id read', async () => {
    queryDb.mockResolvedValue({
      rows: [{
        id: 'demo-profile-2', claimed: true, first_name: 'Invented', last_name: 'Client', headline: null,
        job_title_name: 'Electrician', sector_name: 'Trades', skills: [],
        profile_url: null, city: null, state: null, country: null,
      }],
    });
    const { getClaimedProfileForAccountService } = await import('./service-read');
    const profile = await getClaimedProfileForAccountService('user_inventedAccount0002');
    expect(profile?.id).toBe('demo-profile-2');
    expect(profile?.jobTitle).toBe('Electrician');
    expect(profile?.claimed).toBe(true);
    expect(Object.keys(profile || {})).not.toContain('claimedByUserId');
  });
});
