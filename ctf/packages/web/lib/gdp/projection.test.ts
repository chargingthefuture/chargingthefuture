import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every projection source reads the database, so the DB layer is mocked and each query is answered by
// matching on the table it reads. The mock also records the SQL, which lets the isolation test below
// assert on what the projection is allowed to read.
const executed: string[] = [];

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string) => {
    executed.push(sql);
    if (sql.includes('trust_transport_requests')) {
      // Two priced requests (100 SC total) and three free ones, folded as SC=1 and FREE=1 per post.
      return { rows: [{ currency_code: 'SC', total: '100' }, { currency_code: 'FREE', total: '3' }] };
    }
    if (sql.includes('foundation_quote_requests')) {
      // The second row is a value type with no contribution weight, to prove it is surfaced not zeroed.
      return { rows: [{ currency_code: 'USD', total: '250' }, { currency_code: 'XTS', total: '99' }] };
    }
    if (sql.includes('lighthouse_properties')) {
      // One priced home at 1200 USD/month plus two listings with no priced rent.
      return { rows: [{ currency_code: 'USD', total: '1200' }, { currency_code: 'FREE', total: '2' }] };
    }
    if (sql.includes('socket_relay_requests')) {
      // One favor offering 15 ServiceCredits, one offering 30 USD, and two with no named value — a
      // priced post projects at its posted amount, an unpriced one at one point (issue #120 columns).
      return {
        rows: [
          { currency_code: 'SC', total: '15' },
          { currency_code: 'USD', total: '30' },
          { currency_code: 'FREE', total: '2' },
        ],
      };
    }
    if (sql.includes('recurring_activities') && sql.includes('COUNT(*)')) {
      return { rows: [{ total: '2' }] };
    }
    if (sql.includes('recurring_activities')) {
      return { rows: [{ total: '30' }] };
    }
    return { rows: [] };
  }),
}));

const { countOpenPosts, projectOpenValueIndex, PROJECTION_SOURCES } = await import('./projection');
const { FREE_CODE, RECURRING_ACTIVITY_COUNT_UNIT } = await import('./recognition');

beforeEach(() => {
  executed.length = 0;
});

describe('countOpenPosts', () => {
  it('treats a count-unit volume as that many posts and a priced volume as one', () => {
    expect(countOpenPosts([{ amount: 4, currencyCode: FREE_CODE }])).toBe(4);
    expect(countOpenPosts([{ amount: 2, currencyCode: RECURRING_ACTIVITY_COUNT_UNIT }])).toBe(2);
    expect(countOpenPosts([{ amount: 900, currencyCode: 'USD' }])).toBe(1);
  });

  it('is zero when nothing is open', () => {
    expect(countOpenPosts([])).toBe(0);
  });
});

describe('projectOpenValueIndex', () => {
  it('folds every open source with the same weights the real index uses', async () => {
    const result = await projectOpenValueIndex();
    // 100 SC (weight 1) + 3 free requests + 250 USD (weight 1) + one month of a 1200 USD listing +
    // 2 no-rent listings + favors at their posted value (15 SC + 30 USD + 2 unpriced) + 2 pending fiat
    // recurring lines (one RACT point each) + 30 declared SC. The 99 in an unweighted type is excluded,
    // not counted.
    expect(result.projectedValueIndex).toBe(100 + 3 + 250 + 1200 + 2 + 15 + 30 + 2 + 2 + 30);
    expect(result.perSource.map((s) => s.pluginSlug)).toEqual(PROJECTION_SOURCES.map((s) => s.pluginSlug));
  });

  it('reports the number of open posts behind the figure', async () => {
    const result = await projectOpenValueIndex();
    // 1 priced TrustTransport group + 3 free + 2 quote groups (one priced, one in an unweighted type —
    // still a real open post) + 1 priced listing group + 2 no-rent listings + 2 priced favor groups +
    // 2 unpriced favors + 2 pending fiat + 1 SC group.
    expect(result.openPostCount).toBe(1 + 3 + 2 + 1 + 2 + 2 + 2 + 2 + 1);
  });

  it('surfaces a value type with no contribution weight instead of zeroing it', async () => {
    const result = await projectOpenValueIndex();
    expect(result.unweightedCurrencies).toContain('XTS');
  });

  it('counts a pending fiat recurring line as one point, matching the weekly job', async () => {
    const result = await projectOpenValueIndex();
    const recurring = result.perSource.find((s) => s.pluginSlug === 'recurring-activity');
    // 2 pending fiat lines (one RACT point each) + 30 declared ServiceCredits.
    expect(recurring?.valueIndex).toBe(32);
    expect(result.unweightedCurrencies).not.toContain(RECURRING_ACTIVITY_COUNT_UNIT);
  });

  it('only ever reads open rows — never a settled one the real index already counts', async () => {
    await projectOpenValueIndex();
    const sql = executed.join('\n');
    // The recognition sources own these: earnings entries, successful fulfillments, settled quotes,
    // confirmed recurring lines, and the credits ledger. If any of them appear here, a post would be
    // counted twice — once as projected and once as real.
    expect(sql).not.toContain('trust_transport_earnings_ledger');
    expect(sql).not.toContain('socket_relay_fulfillments');
    expect(sql).not.toContain('service_credits_transfers');
    expect(sql).not.toContain('service_credits_governance_events');
    expect(sql).not.toContain('foundation_call_sessions');
    expect(sql).not.toContain('settled_at');
    expect(sql).not.toContain("'active'");
    // LightHouse is the one place both figures read the same table, so the projection must exclude a
    // home that already has an accepted or completed match — that home belongs to the real index.
    expect(sql).toContain('NOT EXISTS');
  });

  it('projects a LightHouse listing at one month, leaving later months to Recurring Activity', async () => {
    const result = await projectOpenValueIndex();
    const lighthouse = result.perSource.find((s) => s.pluginSlug === 'lighthouse');
    // One month of the 1200 USD listing plus one point per no-rent listing — never a multiple of the
    // rent, because the months after the first are declared in Recurring Activity, not counted here.
    expect(lighthouse?.valueIndex).toBe(1202);
    expect(lighthouse?.openCount).toBe(3);
  });

  it('projects a priced favor at its posted value, and an unpriced one at one point', async () => {
    const result = await projectOpenValueIndex();
    const socketRelay = result.perSource.find((s) => s.pluginSlug === 'socket-relay');
    // 15 offered ServiceCredits + 30 offered USD + 2 favors with no named value. Before issue #120's
    // optional price columns were folded in, every favor counted one point regardless of its posted
    // value, which under-read the board.
    expect(socketRelay?.valueIndex).toBe(15 + 30 + 2);
    expect(socketRelay?.openCount).toBe(4);
  });
});
