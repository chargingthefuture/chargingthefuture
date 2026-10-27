import { describe, expect, it } from 'vitest';
import { seActivityView, seAgo, type SeActivityItem } from '@ctf/shared';

const item = (id: string, notificationType: string, isRead: boolean, createdAtIso: string): SeActivityItem => ({
  id,
  notificationType,
  summary: id,
  linkPath: null,
  isRead,
  createdAtIso,
});

describe('Activity', () => {
  it('puts an unanswered invite first, then the rest newest first', () => {
    const view = seActivityView([
      item('reply', 'commons.reply', false, '2026-10-27T10:00:00.000Z'),
      item('invite', 'recurring-activity.invited', false, '2026-10-26T10:00:00.000Z'),
      item('old-invite', 'recurring-activity.invited', true, '2026-10-27T11:00:00.000Z'),
    ]);
    expect(view.answer.map((i) => i.id)).toEqual(['invite']);
    expect(view.happened.map((i) => i.id)).toEqual(['old-invite', 'reply']);
  });

  it('says how long ago', () => {
    const now = new Date('2026-10-27T12:00:00.000Z');
    expect(seAgo('2026-10-27T11:59:30.000Z', now)).toBe('Just now');
    expect(seAgo('2026-10-27T11:00:00.000Z', now)).toBe('1 h ago');
    expect(seAgo('2026-10-25T12:00:00.000Z', now)).toBe('2 days ago');
  });
});
