import { describe, it, expect, vi, beforeEach } from 'vitest';

// Covers the LightHouse housing source, where the double-count risk is real: the same tenancy is
// touched by two sources (LightHouse for the arrangement made, Recurring Activity for the months after)
// and by two figures (the real index for an accepted match, the projection for a listing nobody has
// taken). The SQL is what keeps those apart, so the SQL is what is asserted.
const executed: string[] = [];

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string) => {
    executed.push(sql);
    if (sql.includes('lighthouse_matches')) {
      return { rows: [{ currency_code: 'USD', total: '1200' }, { currency_code: 'FREE', total: '2' }] };
    }
    return { rows: [] };
  }),
}));

const { lighthouseHousingSource, foldVolumesIntoIndex, DEFAULT_CONTRIBUTION_WEIGHTS, RECOGNITION_SOURCES } =
  await import('./recognition');

beforeEach(() => {
  executed.length = 0;
});

describe('lighthouseHousingSource', () => {
  it('recognizes one month of listed rent per accepted arrangement, and one point per no-rent home', async () => {
    const volumes = await lighthouseHousingSource.loadVolumes();
    const folded = foldVolumesIntoIndex(volumes, DEFAULT_CONTRIBUTION_WEIGHTS);
    expect(folded.valueIndex).toBe(1202);
    expect(folded.unweightedCurrencies).toEqual([]);
  });

  it('reads only arrangements the host accepted, and reads them once', async () => {
    await lighthouseHousingSource.loadVolumes();
    const sql = executed.join('\n');
    expect(sql).toContain("m.status IN ('accepted', 'completed')");
    // 'pending' is a request nobody answered and 'rejected'/'canceled' never happened — neither is
    // recognized value. A match in 'accepted' and later 'completed' is one arrangement, one row.
    expect(sql).not.toContain("'pending'");
    expect(sql).not.toContain("'rejected'");
  });

  it('never multiplies rent across months — Recurring Activity owns the months after the first', async () => {
    await lighthouseHousingSource.loadVolumes();
    const sql = executed.join('\n');
    // No month arithmetic of any kind: no cadence, no duration, no move-in-to-now span.
    expect(sql).not.toMatch(/months?_|INTERVAL|AGE\(|EXTRACT\(/i);
  });

  it('is registered as a recognition source exactly once', () => {
    const registered = RECOGNITION_SOURCES.filter((s) => s.pluginSlug === 'lighthouse');
    expect(registered).toHaveLength(1);
  });
});
