import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryDb = vi.fn();
vi.mock('lib/db/postgres', () => ({ queryDb: (...args: unknown[]) => queryDb(...args) }));
vi.mock('lib/identity/resolve-usernames', () => ({
  resolveUsernames: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, id === 'user_a' ? 'ana' : null]))),
}));

import { countMilestoneQueueSince, listMilestoneQueue } from './milestone-queue';

beforeEach(() => queryDb.mockReset());

describe('listMilestoneQueue', () => {
  it('maps rows of both stages and caps the page size', async () => {
    queryDb.mockResolvedValueOnce({
      rows: [
        {
          enrollment_id: 'e1', milestone_id: 'm1', stage: 'awaiting_release', cohort_title: 'Cohort',
          milestone_name: 'First', required_task: 'Ship it', sequence_no: 1, user_id: 'user_a',
          validation_note: 'Looks good', queued_at: new Date('2026-10-01T00:00:00Z'),
        },
        {
          enrollment_id: 'e2', milestone_id: 'm1', stage: 'awaiting_validation', cohort_title: 'Cohort',
          milestone_name: 'First', required_task: 'Ship it', sequence_no: 1, user_id: 'user_b',
          validation_note: null, queued_at: new Date('2026-10-02T00:00:00Z'),
        },
      ],
    });
    const items = await listMilestoneQueue(500);
    const [sql, params] = queryDb.mock.calls[0];
    expect(sql).toContain("v.status = 'validated'");
    expect(sql).toContain('v.id IS NULL');
    expect(params).toEqual([200]);
    expect(items.map((item) => [item.stage, item.learnerName])).toEqual([
      ['awaiting_release', 'ana'],
      ['awaiting_validation', null],
    ]);
    expect(items[0].queuedAtIso).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('countMilestoneQueueSince', () => {
  it('counts the same rows as the list, since the given time', async () => {
    queryDb.mockResolvedValueOnce({ rows: [{ n: 3 }] });
    const since = new Date('2026-10-01T00:00:00Z');
    await expect(countMilestoneQueueSince(since)).resolves.toBe(3);
    const [sql, params] = queryDb.mock.calls[0];
    expect(sql).toContain("v.status = 'validated'");
    expect(params).toEqual([since]);
  });
});
