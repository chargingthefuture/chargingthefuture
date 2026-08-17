import { describe, it, expect, vi, beforeEach } from 'vitest';

// Covers the LightHouse housing source, where the double-count risk is real: the same tenancy is
// touched by two sources (LightHouse for the arrangement made, Recurring Activity for the months after)
// and by two figures (the real index for an accepted match, the projection for a listing nobody has
// taken). The SQL is what keeps those apart, so the SQL is what is asserted.
const executed: string[] = [];
const recurringSql: string[] = [];

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string) => {
    executed.push(sql);
    if (sql.includes('lighthouse_matches')) {
      return { rows: [{ currency_code: 'USD', total: '1200' }, { currency_code: 'FREE', total: '2' }] };
    }
    if (sql.includes('socket_relay_fulfillments')) {
      // Two closed favors that offered ServiceCredits (15 total), one that offered 30 USD, and three
      // with no named value — each recognized at the value its request posted (issue #120 columns).
      return {
        rows: [
          { currency_code: 'SC', total: '15' },
          { currency_code: 'USD', total: '30' },
          { currency_code: 'FREE', total: '3' },
        ],
      };
    }
    if (sql.includes('recurring_activities')) {
      recurringSql.push(sql);
      // 3 confirmed fiat lines; 500 declared credits on lines whose value is the only record;
      // 2 credits lines declared from an app that already settles every exchange itself.
      if (sql.includes("currency_code <> 'SC'")) return { rows: [{ total: '3' }] };
      // The declared value is scaled to a monthly figure by cadence in SQL, so match the prefix
      // rather than the exact call — the database does that arithmetic, not this mock.
      if (sql.includes('SUM(sc_value')) return { rows: [{ total: '500' }] };
      return { rows: [{ total: '2' }] };
    }
    return { rows: [] };
  }),
}));

const {
  lighthouseHousingSource,
  recurringActivitySource,
  socketRelayFavorSource,
  foldVolumesIntoIndex,
  DEFAULT_CONTRIBUTION_WEIGHTS,
  RECOGNITION_SOURCES,
} = await import('./recognition');
const { PER_OCCURRENCE_ORIGIN_PLUGINS } = await import('lib/shared/recurring-activity-interface');

beforeEach(() => {
  executed.length = 0;
  recurringSql.length = 0;
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

describe('socketRelayFavorSource', () => {
  it('recognizes a completed favor at the value its request posted, and an unpriced one at one point', async () => {
    const volumes = await socketRelayFavorSource.loadVolumes();
    const folded = foldVolumesIntoIndex(volumes, DEFAULT_CONTRIBUTION_WEIGHTS);
    // 15 offered ServiceCredits + 30 offered USD + 3 favors with no named value. Before issue #120's
    // optional price columns were folded in, every completed favor counted one point regardless of the
    // value its post named, which under-read the index.
    expect(folded.valueIndex).toBe(15 + 30 + 3);
    expect(folded.unweightedCurrencies).toEqual([]);
  });

  it('reads only favors the requester closed as successful, priced from the request row', async () => {
    await socketRelayFavorSource.loadVolumes();
    const sql = executed.join('\n');
    expect(sql).toContain("close_reason = 'successful'");
    // The posted value lives on the request, so the fulfillment must join back to it — and only the
    // request's posted price is read, never a transfer ledger (the standalone SocketRelay credits
    // transfer route is deliberately not counted, or one favor could count twice).
    expect(sql).toContain('JOIN socket_relay_requests');
    expect(sql).not.toContain('service_credits_transfers');
  });

  it('is registered as a recognition source exactly once', () => {
    const registered = RECOGNITION_SOURCES.filter((s) => s.pluginSlug === 'socket-relay');
    expect(registered).toHaveLength(1);
  });
});

describe('recurringActivitySource', () => {
  it('counts a declared value only where that value is the only record of the exchange', async () => {
    const volumes = await recurringActivitySource.loadVolumes();
    const credits = volumes.find((v) => v.currencyCode === 'SC');
    // The 500 declared credits count; the 2 lines declared inside an app that settles every exchange
    // itself do NOT add their declared value, or the same credits would be counted twice.
    expect(credits?.amount).toBe(500);
  });

  it('still counts those relationships — one point each, like a money line', async () => {
    const volumes = await recurringActivitySource.loadVolumes();
    const byCount = volumes.find((v) => v.currencyCode === 'RACT');
    // 3 confirmed money lines + 2 credits lines counted as relationships instead of value.
    expect(byCount?.amount).toBe(5);
    const folded = foldVolumesIntoIndex(volumes, DEFAULT_CONTRIBUTION_WEIGHTS);
    expect(folded.valueIndex).toBe(505);
    expect(folded.unweightedCurrencies).toEqual([]);
  });

  it('reads only confirmed lines, and splits them by the app they were declared from', async () => {
    await recurringActivitySource.loadVolumes();
    const sql = recurringSql.join('\n');
    expect(sql).toContain("status = 'active'");
    expect(sql).not.toContain("status = 'pending'");
    expect(sql).toContain('origin_plugin');
    expect(PER_OCCURRENCE_ORIGIN_PLUGINS).not.toContain('lighthouse');
  });
});
