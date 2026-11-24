import { describe, expect, it } from 'vitest';
import { SE_OPEN_WORDS, seOpenCards, type SeTodayCard } from '@ctf/shared';

const ME = 'me-1';

function cardOf(id: string, extra: Partial<SeTodayCard> = {}): SeTodayCard {
  return { id, kind: 'ask', source: id.split(':')[0], label: 'Ask', title: 'T', body: null, author: null, createdAtIso: '2026-11-20T10:00:00.000Z', href: '/', actions: [], ...extra };
}

describe('Me → Open', () => {
  it('lists the member’s own asks, offers and posts, and the cards they joined, in Today’s order', () => {
    const mine = { leavesIso: '2026-12-04T10:00:00.000Z', dueIso: null, canClose: true, canRenew: true };
    const items = seOpenCards(
      [
        cardOf('socket-relay:1', { mine }),
        cardOf('commons:2', { kind: 'story', author: { accountId: ME, handle: 'me' } }),
        cardOf('trust-transport:3', { joined: true }),
        cardOf('lighthouse:4'),
      ],
      ME,
    );
    expect(items.map((item) => [item.card.id, item.state])).toEqual([
      ['socket-relay:1', 'yours'],
      ['commons:2', 'yours'],
      ['trust-transport:3', 'joined'],
    ]);
    expect(items[0].line.startsWith(`${SE_OPEN_WORDS.yours} · On Today until`)).toBe(true);
    expect(items[1].line).toBe(SE_OPEN_WORDS.yours);
    expect(items[2].line).toBe(SE_OPEN_WORDS.joined);
  });

  it('shows the member’s goal with its progress until it is reached', () => {
    const open = seOpenCards([cardOf('peer-programming:g', { goal: { taken: 2, total: 5, reached: false, helpers: 1 } })], ME);
    expect(open[0].line).toBe(`${SE_OPEN_WORDS.goal} · 2 of 5 tasks taken`);
    expect(seOpenCards([cardOf('peer-programming:g', { goal: { taken: 5, total: 5, reached: true, helpers: 2 } })], ME)).toEqual([]);
  });

  it('leaves out cards the server marks done, keeps a card only read today, and lists a card once', () => {
    const items = seOpenCards(
      [
        cardOf('questions:q', { joined: true, done: true }),
        cardOf('blog-story:a', { kind: 'story', joined: true, markedDoneAtIso: '2026-11-23T10:00:00.000Z' }),
        cardOf('blog-story:a', { kind: 'story', joined: true }),
      ],
      ME,
    );
    expect(items.map((item) => item.card.id)).toEqual(['blog-story:a']);
  });

  it('is empty when the member is part of nothing', () => {
    expect(seOpenCards([cardOf('socket-relay:9', { author: { accountId: 'other', handle: 'o' } })], ME)).toEqual([]);
  });
});
