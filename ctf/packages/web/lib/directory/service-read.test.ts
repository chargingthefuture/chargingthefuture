import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The claimed-profile read for One Percent. The limits that matter are enforced in the query and
// the gate, so these tests pin them: only a DIRECTORY_SERVICE_TOKENS consumer gets in, the query
// asks for claimed rows only, and an id that could not be a Directory id never reaches the
// database.

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

describe('getClaimedProfileForService', () => {
  beforeEach(() => queryDb.mockReset());

  it('asks for a claimed profile only', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    const { getClaimedProfileForService } = await import('./service-read');
    await getClaimedProfileForService('00000000-0000-4000-8000-000000000001');
    const sql = String(queryDb.mock.calls[0][0]);
    expect(sql).toMatch(/claimed_by_user_id IS NOT NULL/);
    expect(sql).not.toMatch(/\bbio\b|venmo|monero|bitcoin|service_credits_address|claimed_by_user_id AS/);
  });

  it('answers null for an unclaimed or missing profile', async () => {
    queryDb.mockResolvedValue({ rows: [] });
    const { getClaimedProfileForService } = await import('./service-read');
    expect(await getClaimedProfileForService('00000000-0000-4000-8000-000000000001')).toBeNull();
  });

  it('never queries for an id that could not be a Directory id', async () => {
    const { getClaimedProfileForService } = await import('./service-read');
    expect(await getClaimedProfileForService("1' OR '1'='1")).toBeNull();
    expect(await getClaimedProfileForService('')).toBeNull();
    expect(queryDb).not.toHaveBeenCalled();
  });

  it('maps a row to the fields the desk shows', async () => {
    queryDb.mockResolvedValue({
      rows: [{
        id: 'demo-profile-1', first_name: 'Invented', last_name: 'Person', headline: 'Plumber',
        job_title_name: 'Plumber', sector_name: 'Trades', skills: ['Pipe fitting'],
        profile_url: 'https://example.test/invented', city: 'Nowhere', state: null, country: 'US',
      }],
    });
    const { getClaimedProfileForService } = await import('./service-read');
    expect(await getClaimedProfileForService('demo-profile-1')).toEqual({
      id: 'demo-profile-1', firstName: 'Invented', lastName: 'Person', headline: 'Plumber',
      jobTitle: 'Plumber', sector: 'Trades', skills: ['Pipe fitting'],
      profileUrl: 'https://example.test/invented', city: 'Nowhere', state: null, country: 'US',
    });
  });
});
