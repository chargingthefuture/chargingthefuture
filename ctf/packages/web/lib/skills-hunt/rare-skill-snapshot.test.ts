import { describe, expect, it, vi } from 'vitest';

const gaps = vi.fn();
vi.mock('lib/shared/workforce-interface', () => ({ fetchOccupationGapReport: () => gaps() }));

import { snapshotRareSkillsForRound } from './rare-skill-snapshot';

function fakeClient(skillNames: string[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const client = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM skills_taxonomy_skills')) return { rows: skillNames.map((name) => ({ name })), rowCount: skillNames.length };
      return { rows: [], rowCount: 0 };
    }),
  };
  return { client, calls };
}

describe('rare-skill snapshot (issue #2870)', () => {
  it('stores the skills under the rare job titles, not the job title names', async () => {
    gaps.mockResolvedValue([
      { jobTitleId: 'jt-scarce', occupation: 'Marketing Specialist', target: 10, recruited: 1, gap: 9 },
      { jobTitleId: 'jt-scarce', occupation: 'Marketing Specialist', target: 10, recruited: 1, gap: 9 },
      { jobTitleId: 'jt-full', occupation: 'Tutors', target: 10, recruited: 9, gap: 1 },
    ]);
    const { client, calls } = fakeClient(['Social Media Marketing', 'Copywriting']);
    const result = await snapshotRareSkillsForRound(client as never, 'round-1');

    expect(result).toEqual({ snapshotted: 2 });
    const skillRead = calls.find((c) => c.sql.includes('FROM skills_taxonomy_skills'));
    expect(skillRead?.params[0]).toEqual(['jt-scarce']);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO skills_hunt_rare_skills_lookup'));
    expect(insert?.params[1]).toEqual(['Social Media Marketing', 'Copywriting']);
  });

  it('writes nothing when no job title is under-recruited', async () => {
    gaps.mockResolvedValue([{ jobTitleId: 'jt-full', occupation: 'Tutors', target: 10, recruited: 9, gap: 1 }]);
    const { client, calls } = fakeClient([]);
    expect(await snapshotRareSkillsForRound(client as never, 'round-1')).toEqual({ snapshotted: 0 });
    expect(calls.some((c) => c.sql.includes('INSERT'))).toBe(false);
  });
});
