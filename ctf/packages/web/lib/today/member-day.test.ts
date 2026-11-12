import { describe, expect, it } from 'vitest';
import {
  seApplyCardMarks,
  seCanConfirmHelped,
  seCardShownDone,
  seHelpedConfirmedByAdmin,
  seMarkChangeFor,
  seNextDay,
  seReadChangeFor,
  seReadTodayDay,
  seStoriesForDay,
  type SeStoryPost,
  type SeTodayCard,
} from '@ctf/shared';

const now = new Date('2026-11-12T03:30:00Z');

describe("the member's own day", () => {
  it('uses the day the phone sends when it is within one day of UTC', () => {
    expect(seReadTodayDay({ day: '2026-11-11', dayStart: '2026-11-11T05:00:00.000Z' }, now)).toEqual({ day: '2026-11-11', startIso: '2026-11-11T05:00:00.000Z' });
    expect(seReadTodayDay({ day: '2026-11-13' }, now).day).toBe('2026-11-13');
  });

  it('falls back to the UTC day for a missing or far-off day', () => {
    expect(seReadTodayDay({}, now)).toEqual({ day: '2026-11-12', startIso: '2026-11-12T00:00:00.000Z' });
    expect(seReadTodayDay({ day: '2026-11-20', dayStart: 'not a time' }, now).day).toBe('2026-11-12');
    expect(seReadTodayDay({ day: '2026-02-30' }, now).day).toBe('2026-11-12');
  });

  it('releases stories by the member day, so two members a day apart see different stories', () => {
    const posts: SeStoryPost[] = Array.from({ length: 20 }, (_, index) => ({
      number: index + 1,
      slug: `p${index}`,
      title: `P${index}`,
      date: '2026-01-01',
      collection: 'posts',
      url: '',
      text: '',
    }));
    const behind = seStoriesForDay(posts, seReadTodayDay({ day: '2026-11-11' }, now).day).map((post) => post.slug);
    const ahead = seStoriesForDay(posts, seReadTodayDay({ day: '2026-11-12' }, now).day).map((post) => post.slug);
    expect(behind).not.toEqual(ahead);
    expect(seNextDay('2026-11-30')).toBe('2026-12-01');
  });
});

const base = { source: 's', label: 'L', title: 'T', body: null, createdAtIso: '2026-11-12T00:00:00.000Z', href: '/', actions: [] };
const othersAsk: SeTodayCard = { ...base, id: 'socket-relay:1', kind: 'ask', author: { accountId: 'b', handle: 'b' } };
const ownAsk: SeTodayCard = { ...othersAsk, id: 'socket-relay:2', author: { accountId: 'a', handle: 'a' }, mine: { leavesIso: '', dueIso: null, canClose: true, canRenew: true } };
const story: SeTodayCard = { ...base, id: 'blog-story:x', kind: 'story', author: null };

describe('check marks', () => {
  it('never shows one on another person\'s ask, and the dot does not change it', () => {
    const [shown] = seApplyCardMarks([othersAsk], [{ cardId: othersAsk.id, mark: 'done', markedAtIso: '2026-11-12T01:00:00.000Z' }], '2026-11-12T00:00:00.000Z');
    expect(shown.markedDoneAtIso).toBeUndefined();
    expect(seCardShownDone({ ...othersAsk, done: true })).toBe(false);
    expect(seMarkChangeFor({ cards: [othersAsk] }, 'read', othersAsk.id)).toBeNull();
  });

  it('marks a card read when it is opened, once, and never the member\'s own', () => {
    expect(seReadChangeFor({ cards: [story] }, story.id, 'a')).toEqual({ cardId: story.id, mark: 'done' });
    expect(seReadChangeFor({ cards: [{ ...story, markedDoneAtIso: 'x' }] }, story.id, 'a')).toBeNull();
    expect(seReadChangeFor({ cards: [othersAsk] }, othersAsk.id, 'a')).toBeNull();
    expect(seReadChangeFor({ cards: [ownAsk] }, ownAsk.id, 'a')).toBeNull();
    expect(seMarkChangeFor({ cards: [ownAsk] }, 'read', ownAsk.id)).toEqual({ cardId: ownAsk.id, mark: 'done' });
  });
});

describe('This helped me confirmation', () => {
  const answer = { accountId: 'b', handle: 'b', kinds: ['helped-me' as const], helpedConfirmed: false };
  it('offers Confirm to the author only, beside an unconfirmed This helped me from somebody else', () => {
    expect(seCanConfirmHelped({ canConfirmHelped: true, viewerId: 'a' }, answer)).toBe(true);
    expect(seCanConfirmHelped({ canConfirmHelped: false, viewerId: 'a' }, answer)).toBe(false);
    expect(seCanConfirmHelped({ canConfirmHelped: true, viewerId: 'a' }, { ...answer, helpedConfirmed: true })).toBe(false);
    expect(seCanConfirmHelped({ canConfirmHelped: true, viewerId: 'b' }, answer)).toBe(false);
    expect(seCanConfirmHelped({ canConfirmHelped: true, viewerId: 'a' }, { ...answer, kinds: ['help'] })).toBe(false);
  });

  it('gives blog stories, announcements and What Works to the System Architect', () => {
    expect(seHelpedConfirmedByAdmin('blog-story:a')).toBe(true);
    expect(seHelpedConfirmedByAdmin('what-works:1')).toBe(true);
    expect(seHelpedConfirmedByAdmin('socket-relay:1')).toBe(false);
  });
});
