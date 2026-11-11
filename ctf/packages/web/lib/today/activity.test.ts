import { describe, expect, it } from 'vitest';
import { seActivityIcon, seActivityNeed, seActivityOutcome, seActivityPairRef, seActivityTint, seActivityView, seActivityWhen, seAgo, seTheme, type SeActivityItem } from '@ctf/shared';

const item = (id: string, notificationType: string, isRead: boolean, createdAtIso: string, targetRef: string | null = null, linkPath: string | null = null): SeActivityItem => ({
  id,
  notificationType,
  summary: id,
  linkPath,
  targetRef,
  answer: null,
  isRead,
  createdAtIso,
});

describe('Activity', () => {
  it('puts what waits on the member in Needs you, then today, then earlier, newest first', () => {
    const now = new Date(2026, 9, 27, 15, 0);
    const today = (hour: number) => new Date(2026, 9, 27, hour, 0).toISOString();
    const view = seActivityView(
      [
        item('reply', 'commons.reply', false, today(10)),
        item('invite', 'recurring-activity.invited', false, today(9), 'act-1'),
        item('old-invite', 'recurring-activity.invited', true, today(11), 'act-0'),
        item('yesterday', 'service-credits.received', false, new Date(2026, 9, 26, 20, 0).toISOString()),
      ],
      now,
    );
    expect(view.needs.map((n) => n.item.id)).toEqual(['invite']);
    expect(view.today.map((i) => i.id)).toEqual(['old-invite', 'reply']);
    expect(view.earlier.map((i) => i.id)).toEqual(['yesterday']);
  });

  it('answers a Recurring Activity invite through its confirm and decline routes', () => {
    const need = seActivityNeed(item('n', 'recurring-activity.invited', false, '2026-10-27T10:00:00.000Z', 'act-1'));
    expect(need?.buttons.map((b) => [b.label, b.path])).toEqual([
      ['Confirm', '/api/recurring-activity/act-1/confirm'],
      ["That's not right", '/api/recurring-activity/act-1/decline'],
    ]);
  });

  it('agrees to a Just us two request with the asker, and Not now only marks it read', () => {
    const ref = seActivityPairRef('socket-relay:abc', 'user_wren');
    const need = seActivityNeed(item('n', 'today.card.pair_request', false, '2026-10-27T10:00:00.000Z', ref));
    expect(need?.partnerId).toBe('user_wren');
    expect(need?.buttons[0]).toMatchObject({ label: 'Agree', path: '/api/today/cards/socket-relay%3Aabc/pair/agree', body: { partnerId: 'user_wren' } });
    expect(need?.buttons[1]).toMatchObject({ label: 'Not now', path: null });
  });

  it('keeps an ask up from its day-14 notice', () => {
    const need = seActivityNeed(item('n', 'today.renew', false, '2026-10-27T10:00:00.000Z', null, '/apps/socket-relay?renew=socket-relay%3A1'));
    expect(need?.buttons.map((b) => b.path)).toEqual(['/api/today/cards/socket-relay%3A1/renew']);
  });

  it('shows a day-14 notice kept up or closed since as a plain row with what happened', () => {
    const notice = item('n', 'today.renew', false, '2026-10-27T10:00:00.000Z', null, '/apps/socket-relay?renew=socket-relay%3A1');
    expect(seActivityNeed({ ...notice, answer: 'kept' })).toBeNull();
    expect(seActivityOutcome({ ...notice, answer: 'kept' })).toBe('Kept up on Today for 14 more days.');
    expect(seActivityOutcome({ ...notice, answer: 'closed' })).toBe('Closed. It has left Today.');
    expect(seActivityOutcome(notice)).toBeNull();
  });

  it('shows a notice with no target as a plain row', () => {
    expect(seActivityNeed(item('n', 'today.card.pair_request', false, '2026-10-27T10:00:00.000Z'))).toBeNull();
    expect(seActivityNeed(item('n', 'commons.reply', false, '2026-10-27T10:00:00.000Z', 'post-1'))).toBeNull();
  });

  it('gives each kind its icon and a tint drawn from the theme', () => {
    expect(seActivityIcon('service-credits.received')).toBe('check');
    expect(seActivityIcon('today.renew')).toBe('calendar');
    expect(seActivityIcon('comic.answer.published')).toBe('star');
    expect(seActivityIcon('commons.reply')).toBe('reply');
    expect(seActivityTint(seTheme('burgundy', 'light'), 'reply')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('writes the full date and time', () => {
    expect(seActivityWhen('2026-10-26T18:12:00.000Z')).toMatch(/^October 2\d, 2026 at \d{1,2}:\d{2} [AP]M \S+$/);
  });

  it('says how long ago', () => {
    const now = new Date('2026-10-27T12:00:00.000Z');
    expect(seAgo('2026-10-27T11:59:30.000Z', now)).toBe('Just now');
    expect(seAgo('2026-10-27T11:00:00.000Z', now)).toBe('1 h ago');
    expect(seAgo('2026-10-25T12:00:00.000Z', now)).toBe('2 days ago');
  });
});
