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
      return { rows: [{ currency_code: 'USD', total: '250' }] };
    }
    if (sql.includes('socket_relay_requests')) {
      return { rows: [{ total: '4' }] };
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
    // 100 SC (weight 1) + 3 free requests + 250 USD (weight 1) + 4 open favors + 2 pending fiat
    // recurring lines (RACT has no weight, so it is surfaced not counted) + 30 declared SC.
    expect(result.projectedValueIndex).toBe(100 + 3 + 250 + 4 + 30);
    expect(result.perSource.map((s) => s.pluginSlug)).toEqual(PROJECTION_SOURCES.map((s) => s.pluginSlug));
  });

  it('reports the number of open posts behind the figure', async () => {
    const result = await projectOpenValueIndex();
    // 1 priced TrustTransport group + 3 free + 1 priced quote group + 4 favors + 2 pending fiat + 1 SC group.
    expect(result.openPostCount).toBe(1 + 3 + 1 + 4 + 2 + 1);
  });

  it('surfaces a value type with no contribution weight instead of zeroing it', async () => {
    const result = await projectOpenValueIndex();
    expect(result.unweightedCurrencies).toContain(RECURRING_ACTIVITY_COUNT_UNIT);
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
  });
});
