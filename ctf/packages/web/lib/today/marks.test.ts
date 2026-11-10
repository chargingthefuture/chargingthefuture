import { describe, expect, it } from 'vitest';
import {
  seApplyCardMarks,
  seArchiveReplayForDay,
  seLegacyMarkChanges,
  seMarkCardInToday,
  seMarkChangeFor,
  seNewCommentsLine,
  seParseCardMarkChanges,
  seReplayIsRecent,
  type SeCardMark,
  type SeTodayCard,
} from '@ctf/shared';

const DAY_START = '2026-11-04T05:00:00.000Z';

function cardOf(id: string, extra: Partial<SeTodayCard> = {}): SeTodayCard {
  return { id, kind: 'story', source: id.split(':')[0], label: 'L', title: 'T', body: null, author: null, createdAtIso: DAY_START, href: '/', actions: [], ...extra };
}

const done = (cardId: string, markedAtIso: string): SeCardMark => ({ cardId, mark: 'done', markedAtIso });

describe('marks stored on the account', () => {
  it('keeps a card marked done today, shown done, and leaves it out from the next day', () => {
    const today = seApplyCardMarks([cardOf('blog-story:a')], [done('blog-story:a', '2026-11-04T15:00:00.000Z')], DAY_START);
    expect(today[0].markedDoneAtIso).toBe('2026-11-04T15:00:00.000Z');
    expect(seApplyCardMarks([cardOf('blog-story:a')], [done('blog-story:a', '2026-11-03T15:00:00.000Z')], DAY_START)).toEqual([]);
  });

  it('keeps a story or replay done in an earlier rotation off Today', () => {
    const replay = cardOf('beacon-replay:r', { kind: 'replay' });
    expect(seApplyCardMarks([replay], [done('beacon-replay:r', '2026-09-01T12:00:00.000Z')], DAY_START)).toEqual([]);
  });

  it('brings a done blog story back, not done, when a comment was written since', () => {
    const story = cardOf('blog-story:a', { commentTimesIso: ['2026-11-02T10:00:00.000Z', '2026-10-30T10:00:00.000Z', '2026-10-01T10:00:00.000Z'] });
    const [back] = seApplyCardMarks([story], [done('blog-story:a', '2026-10-15T12:00:00.000Z')], DAY_START);
    expect(back.newComments).toBe(2);
    expect(back.markedDoneAtIso).toBeUndefined();
    expect(back.commentTimesIso).toBeUndefined();
    expect(seNewCommentsLine(back.newComments)).toBe('2 new comments');
    expect(seNewCommentsLine(1)).toBe('1 new comment');
  });

  it('never brings back a card marked Not for me, even with new comments', () => {
    const story = cardOf('blog-story:a', { commentTimesIso: ['2026-11-04T10:00:00.000Z'] });
    expect(seApplyCardMarks([story], [{ cardId: 'blog-story:a', mark: 'not_for_me', markedAtIso: '2026-10-01T00:00:00.000Z' }], DAY_START)).toEqual([]);
  });

  it('turns a tap into the change the server stores, and draws it at once', () => {
    const today = { cards: [cardOf('blog-story:a'), cardOf('questions:q', { done: true })] };
    expect(seMarkChangeFor(today, 'read', 'blog-story:a')).toEqual({ cardId: 'blog-story:a', mark: 'done' });
    expect(seMarkChangeFor(today, 'read', 'questions:q')).toBeNull();
    const marked = seMarkCardInToday(today, { cardId: 'blog-story:a', mark: 'done' }, new Date(DAY_START));
    expect(seMarkChangeFor(marked, 'read', 'blog-story:a')).toEqual({ cardId: 'blog-story:a', mark: 'clear' });
    expect(seMarkCardInToday(marked, { cardId: 'blog-story:a', mark: 'not_for_me' }).cards.map((c) => c.id)).toEqual(['questions:q']);
  });

  it('reads one change or a batch, and refuses anything else', () => {
    expect(seParseCardMarkChanges({ cardId: 'blog-story:a', mark: 'clear' })).toEqual([{ cardId: 'blog-story:a', mark: 'clear' }]);
    expect(seParseCardMarkChanges({ marks: [{ cardId: 'blog-story:a', mark: 'done' }] })).toHaveLength(1);
    expect(seParseCardMarkChanges({ cardId: 'nocolon', mark: 'done' })).toBeNull();
    expect(seParseCardMarkChanges({ marks: [] })).toBeNull();
  });

  it('uploads the marks a device kept before, Not for me winning over done', () => {
    expect(seLegacyMarkChanges({ read: ['blog-story:a', 'blog-story:b'], hidden: ['blog-story:b'] })).toEqual([
      { cardId: 'blog-story:b', mark: 'not_for_me' },
      { cardId: 'blog-story:a', mark: 'done' },
    ]);
    expect(seLegacyMarkChanges(null)).toEqual([]);
  });
});

describe('older replays in a daily rotation', () => {
  const replays = [
    { id: 'c', broadcastIso: '2026-10-20T20:00:00.000Z' },
    { id: 'a', broadcastIso: '2026-09-01T20:00:00.000Z' },
    { id: 'b', broadcastIso: '2026-10-01T20:00:00.000Z' },
    { id: 'new', broadcastIso: '2026-11-02T20:00:00.000Z' },
  ];

  it('starts on the day it ships, oldest first, the same for everybody, and goes round again', () => {
    expect(seArchiveReplayForDay(replays, '2026-11-02')).toBeNull();
    expect(seArchiveReplayForDay(replays, '2026-11-03')?.id).toBe('a');
    expect(seArchiveReplayForDay(replays, '2026-11-04')?.id).toBe('b');
    expect(seArchiveReplayForDay(replays, '2026-11-05')?.id).toBe('c');
    expect(seArchiveReplayForDay(replays, '2026-11-07')?.id).toBe('a');
  });

  it('passes over a replay that is still one of the 7-day ones', () => {
    expect(seReplayIsRecent(replays[3], '2026-11-06')).toBe(true);
    expect(seArchiveReplayForDay(replays, '2026-11-06')?.id).toBe('a');
    expect(seReplayIsRecent(replays[3], '2026-11-10')).toBe(false);
  });
});
