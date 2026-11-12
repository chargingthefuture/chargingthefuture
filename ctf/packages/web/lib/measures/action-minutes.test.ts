import { beforeEach, describe, expect, it, vi } from 'vitest';

const sql = vi.hoisted(() => ({ texts: [] as string[] }));
vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (text: string) => {
    sql.texts.push(text);
    return { rows: [] };
  }),
}));

import { dailyMinutesCte, readDaysWon, readRetention, readTimeToUnlock } from './action-minutes';
import { notExcludedAccount } from 'lib/unlock/excluded-accounts';

const EXCLUDED = 'NOT IN (SELECT user_id FROM unlock_excluded_accounts)';

beforeEach(() => {
  sql.texts = [];
});

describe('Adoption measures leave out demo/test accounts', () => {
  it('builds one condition from the marked accounts', () => {
    expect(notExcludedAccount('s.user_id')).toBe(`s.user_id ${EXCLUDED}`);
  });

  it('drops marked accounts from the daily action minutes behind Days won and retention', () => {
    expect(dailyMinutesCte('$3')).toContain(`WHERE user_id ${EXCLUDED}`);
  });

  it('reads Days won through that filter', async () => {
    await readDaysWon(new Date('2026-11-12T12:00:00Z'));
    expect(sql.texts[0]).toContain(EXCLUDED);
  });

  it('drops marked accounts from the came back sign-in reads', async () => {
    await readRetention({ ids: [], dates: [], source: { kind: 'provider' } }, new Date('2026-11-12T12:00:00Z'));
    const text = sql.texts[0];
    expect(text).toMatch(/recent AS \(SELECT DISTINCT user_id FROM login_events WHERE created_at >= \$2::date AND user_id NOT IN/);
    expect(text).toMatch(/WHERE created_at < \$2::date AND user_id NOT IN/);
  });

  it('drops marked accounts from time to unlock', async () => {
    await readTimeToUnlock(new Date('2026-11-12T12:00:00Z'));
    expect(sql.texts[0]).toContain(`s.user_id ${EXCLUDED}`);
  });
});
