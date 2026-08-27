import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The active-member reading is one SQL query over the sign-in record, so these tests read the SQL
// the module produces rather than a database. The mock answers the table-existence probe, then
// records the query the reading actually ran.
const executed: { sql: string; values: readonly unknown[] }[] = [];
// Kept across tests (unlike `executed`, which is cleared each time) so the probe count below counts
// every existence probe the module has ever run, not just the ones in that one test.
const probes: string[] = [];

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    executed.push({ sql, values });
    if (sql.includes('to_regclass')) {
      probes.push(sql);
      return { rows: [{ reg: 'login_events' }] };
    }
    return { rows: [{ v: '3' }] };
  }),
}));

const {
  MEMBER_ACTIVITY_TABLE,
  countActiveMembersInWeek,
  countMemberDaysInWeek,
  listActiveMemberIdsLastDays,
  elapsedDaysInWeek,
} = await import('lib/engagement/member-activity');

beforeEach(() => {
  executed.length = 0;
});

// The owner's definition (2026-08-27): a member is active on a day the sign-in record holds a row
// for them, and that is the whole of it. This has drifted twice toward "anything the member's rows
// show they did", so it is pinned here.
describe('what counts as active', () => {
  it('is the sign-in record', () => {
    expect(MEMBER_ACTIVITY_TABLE).toBe('login_events');
  });

  it('reads no table but the sign-in record', async () => {
    await countActiveMembersInWeek('2026-08-24');
    await countMemberDaysInWeek('2026-08-24');
    await listActiveMemberIdsLastDays(7);

    const reads = executed.filter((query) => !query.sql.includes('to_regclass'));
    expect(reads).toHaveLength(3);
    for (const read of reads) {
      expect(read.sql).toContain('FROM login_events');
      // Any of these appearing means the definition has been widened again.
      for (const table of [
        'click_log_incidents',
        'mood_submissions',
        'feed_community_posts',
        'feed_community_replies',
        'feed_community_post_reactions',
        'peer_programming_messages',
        'audit_trail',
        'audit_log',
        'UNION',
      ]) {
        expect(read.sql).not.toContain(table);
      }
    }
  });

  it('windows the week on the seven days from the week start', async () => {
    await countActiveMembersInWeek('2026-08-24');
    const read = executed.find((query) => !query.sql.includes('to_regclass'));
    expect(read?.sql).toContain("created_at >= $1::date AND created_at < $1::date + INTERVAL '7 days'");
    expect(read?.values[0]).toBe('2026-08-24');
  });

  it('asks whether the table exists once, not on every read', async () => {
    await countActiveMembersInWeek('2026-08-24');
    await countActiveMembersInWeek('2026-08-17');
    expect(probes).toHaveLength(1);
  });
});

// The audit script names the same table. If the two disagree, the audit explains a number the
// dashboard is not showing.
describe('the audit script', () => {
  const script = readFileSync(
    resolve(__dirname, '../../../../scripts/audit-active-members.mjs'),
    'utf8',
  );

  it('audits the same table the reading counts', () => {
    expect(script).toContain(`const SIGN_IN_TABLE = '${MEMBER_ACTIVITY_TABLE}'`);
  });

  it('reads no other table', () => {
    for (const table of [
      'click_log_incidents',
      'mood_submissions',
      'feed_community_posts',
      'peer_programming_messages',
      'audit_trail',
      'audit_log',
    ]) {
      expect(script).not.toContain(table);
    }
  });
});

// The divisor behind "daily active members". The live week averages over the days it has had; a past
// week always divides by 7.
describe('elapsedDaysInWeek', () => {
  it('counts only the days a live week has had', () => {
    expect(elapsedDaysInWeek('2026-06-08', new Date('2026-06-10T12:00:00Z'))).toBe(3);
  });

  it('gives a finished week all seven days', () => {
    expect(elapsedDaysInWeek('2026-06-08', new Date('2026-07-01T12:00:00Z'))).toBe(7);
  });

  it('never divides by less than one day', () => {
    expect(elapsedDaysInWeek('2026-06-08', new Date('2026-06-08T00:00:00Z'))).toBe(1);
  });
});
