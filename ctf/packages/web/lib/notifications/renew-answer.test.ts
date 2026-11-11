import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn(), withDbTransaction: vi.fn() }));
vi.mock('./push', () => ({ sendWebPushToUser: vi.fn() }));

import { queryDb } from 'lib/db/postgres';
import { listNotifications } from './repository';
import { renewNoticeAnswer } from './renew-answer';

const sent = new Date('2026-11-10T12:00:00.000Z');
const before = new Date('2026-11-01T12:00:00.000Z');
const after = new Date('2026-11-10T13:00:00.000Z');

describe('renewNoticeAnswer', () => {
  it('is kept or closed only when that happened after the notice was sent', () => {
    expect(renewNoticeAnswer(sent, null)).toBeNull();
    expect(renewNoticeAnswer(sent, { renewedAt: before, closedAt: null })).toBeNull();
    expect(renewNoticeAnswer(sent, { renewedAt: after, closedAt: null })).toBe('kept');
    expect(renewNoticeAnswer(sent, { renewedAt: after, closedAt: after })).toBe('closed');
    expect(renewNoticeAnswer(sent, { renewedAt: null, closedAt: before })).toBeNull();
  });
});

describe('listNotifications', () => {
  beforeEach(() => vi.mocked(queryDb).mockReset());

  const row = (over: Record<string, unknown>) => ({
    id: 'n1',
    source_plugin: 'today',
    notification_type: 'today.renew',
    category: 'activity',
    summary: 'Still need this? Keep it up for 14 more days: A ride',
    link_path: '/apps/socket-relay?renew=socket-relay%3A1',
    target_ref: 'socket-relay:1@2026-11-10T12:00:00.000Z',
    read_at: null,
    created_at: sent,
    window_renewed_at: null,
    window_closed_at: null,
    window_found: false,
    ...over,
  });

  it('marks a day-14 notice kept once its card was renewed after it, read from the card window', async () => {
    vi.mocked(queryDb).mockResolvedValueOnce({ rows: [row({ window_found: true, window_renewed_at: after })] } as never);
    const [notice] = await listNotifications('me', 50);
    expect(notice.answer).toBe('kept');
    const [sql, params] = vi.mocked(queryDb).mock.calls[0];
    expect(sql).toContain('LEFT JOIN today_card_windows');
    expect(params).toEqual(['me', 50, 'today.renew']);
  });

  it('leaves a waiting notice and every other kind unanswered', async () => {
    vi.mocked(queryDb).mockResolvedValueOnce({
      rows: [row({}), row({ id: 'n2', notification_type: 'commons.reply', window_found: true, window_closed_at: after })],
    } as never);
    const notices = await listNotifications('me', 50);
    expect(notices.map((n) => n.answer)).toEqual([null, null]);
  });
});
