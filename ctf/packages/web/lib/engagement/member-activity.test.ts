import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The active-member reading is one SQL union built from a table of sources, so these tests read the
// SQL the module produces rather than a database. The mock answers the existence probe with every
// candidate table, then records the query the reading actually ran.
const executed: { sql: string; values: readonly unknown[] }[] = [];
// Kept across tests (unlike `executed`, which is cleared each time) so the probe count below counts
// every existence probe the module has ever run, not just the ones in that one test.
const probes: string[] = [];

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    executed.push({ sql, values });
    if (sql.includes('to_regclass')) {
      probes.push(sql);
      const candidates = (values[0] ?? []) as string[];
      return { rows: candidates.map((table_name) => ({ table_name })) };
    }
    return { rows: [{ v: '3' }] };
  }),
}));

const {
  MEMBER_ACTIVITY_SOURCES,
  NON_MEMBER_ACTIVITY_ACTOR_IDS,
  countActiveMembersInWeek,
  elapsedDaysInWeek,
} = await import('lib/engagement/member-activity');

beforeEach(() => {
  executed.length = 0;
});

// The reading is the sum of what every source saw. A source that is in the list but missing from
// the query is a plugin's members quietly dropped from the headcount.
describe('the week reading', () => {
  it('counts every available source', async () => {
    await countActiveMembersInWeek('2026-06-08');
    const read = executed.find((query) => query.sql.includes('member_days'));
    expect(read).toBeDefined();
    for (const source of MEMBER_ACTIVITY_SOURCES) {
      expect(read?.sql).toContain(`FROM ${source.table}`);
      expect(read?.sql).toContain(`${source.userColumn} AS user_id`);
    }
  });

  it('leaves out the actors that are not people', async () => {
    await countActiveMembersInWeek('2026-06-08');
    const read = executed.find((query) => query.sql.includes('member_days'));
    expect(read?.sql).toContain('<> ALL ($2::text[])');
    expect(read?.values[1]).toEqual(NON_MEMBER_ACTIVITY_ACTOR_IDS);
    // The Commons standing notice is authored by the platform, not by a member, and used to be
    // counted as one more person turning up on the day it was written.
    expect(NON_MEMBER_ACTIVITY_ACTOR_IDS).toContain('system:commons-guidance');
  });

  it('asks the database which tables exist once, not once per table', async () => {
    await countActiveMembersInWeek('2026-06-08');
    await countActiveMembersInWeek('2026-06-15');
    // One probe for the whole process, covering all 37 candidate tables — the reading used to run
    // one `to_regclass` round trip per table on every call.
    expect(probes).toHaveLength(1);
  });
});

// The audit script keeps its own copy of the source list because it runs as a plain Node script with
// no build step. A copy that drifts explains a number the dashboard is not showing, so it is checked
// here rather than left to whoever edits one file and forgets the other.
describe('the audit script copy of the source list', () => {
  const script = readFileSync(
    resolve(__dirname, '../../../../scripts/audit-active-members.mjs'),
    'utf8',
  );

  function sourcesIn(text: string, listName: string): string[] {
    const start = text.indexOf(`${listName} = [`);
    const list = text.slice(start, text.indexOf('];', start));
    return [...list.matchAll(/table: '([^']+)', userColumn: '([^']+)', dateColumn: '([^']+)'/g)].map(
      (match) => `${match[1]}.${match[2]}.${match[3]}`,
    );
  }

  it('matches the module, table for table', () => {
    const expected = MEMBER_ACTIVITY_SOURCES.map(
      (source) => `${source.table}.${source.userColumn}.${source.dateColumn}`,
    );
    expect(sourcesIn(script, 'const SOURCES')).toEqual(expected);
  });

  it('leaves out the same non-member actors', () => {
    const start = script.indexOf('const NON_MEMBER_ACTOR_IDS = [');
    const list = script.slice(start, script.indexOf('];', start));
    const actors = [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(actors).toEqual([...NON_MEMBER_ACTIVITY_ACTOR_IDS]);
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
