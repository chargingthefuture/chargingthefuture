import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryDb, notifySafe } = vi.hoisted(() => ({
  queryDb: vi.fn<(sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>>(),
  notifySafe: vi.fn<(input: { targetRef?: string | null }) => Promise<void>>(async () => undefined),
}));
vi.mock('lib/db/postgres', () => ({ queryDb }));
vi.mock('lib/notifications/repository', () => ({ notifySafe }));

import { sendDueRenewNotices } from './renew-notices';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const DAY = 86_400_000;
const row = (id: string, daysAgo: number, extra: Record<string, unknown> = {}) => ({
  id,
  owner: 'poster',
  title: 'Groceries',
  start: new Date(NOW.getTime() - daysAgo * DAY),
  due_at: null,
  shown_until: null,
  outcome: null,
  ...extra,
});

describe('the daily day-14 run', () => {
  beforeEach(() => {
    queryDb.mockReset();
    notifySafe.mockClear();
  });

  it('notifies the poster of each item at day 14, keyed by its window end, and nobody else', async () => {
    queryDb.mockImplementation(async (_sql, params) => ({
      rows: params[0] === 'socket-relay' ? [row('a', 13.5), row('b', 5), row('c', 13.5, { shown_until: new Date(NOW.getTime() + 10 * DAY) })] : [],
    }));
    const result = await sendDueRenewNotices(NOW);
    expect(result).toEqual({ checked: 3, due: 1 });
    expect(notifySafe).toHaveBeenCalledTimes(1);
    const end = new Date(NOW.getTime() - 13.5 * DAY + 14 * DAY).toISOString();
    expect(notifySafe.mock.calls[0][0]).toEqual(
      expect.objectContaining({ userId: 'poster', notificationType: 'today.renew', targetRef: `socket-relay:a@${end}` }),
    );
  });

  it('sends the same key on a second run, so the notice is not sent twice', async () => {
    queryDb.mockImplementation(async (_sql, params) => ({ rows: params[0] === 'lighthouse' ? [row('p', 13.2)] : [] }));
    await sendDueRenewNotices(NOW);
    await sendDueRenewNotices(new Date(NOW.getTime() + 60_000));
    const refs = notifySafe.mock.calls.map((call) => call[0].targetRef);
    expect(refs[0]).toBe(refs[1]);
  });
});
