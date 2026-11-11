import { describe, expect, it } from 'vitest';
import { seApplyMutes, seCardMutedNote, seCardMuteRequest, seDaysWonLines, seMuteRowLabel, seMutePostTargetValid, seNormalizeMuteWords, seTalkLine, seTodayView, type SeToday } from '@ctf/shared';

const card = (id: string, kind: 'ask' | 'offer' | 'story') => ({
  id,
  kind,
  source: 's',
  label: 'x',
  title: id,
  body: null,
  author: null,
  createdAtIso: '2026-10-27T00:00:00.000Z',
  href: '/',
  actions: [],
});

const today: SeToday = {
  generatedAtIso: '2026-10-27T00:00:00.000Z',
  presence: null,
  daysWon: null,
  broadcast: null,
  rooms: [],
  week: [],
  cards: [card('a', 'ask'), card('b', 'offer'), card('c', 'story')],
  unavailable: ['trust-transport', 'chyme'],
};

describe('seTodayView', () => {
  it('leaves out hidden cards and filters by kind', () => {
    const view = seTodayView(today, { read: [], hidden: ['b'] }, 'all');
    expect(view.cards.map((c) => c.id)).toEqual(['a', 'c']);
    expect(seTodayView(today, { read: [], hidden: [] }, 'asks').cards.map((c) => c.id)).toEqual(['a']);
  });

  it('names sources that failed in plain words', () => {
    expect(seTodayView(today, { read: [], hidden: [] }, 'all').missingLine).toBe('Could not load rides, the Main Room this time.');
  });

  it('says which talk is on or next', () => {
    const now = new Date('2026-10-27T12:00:00');
    const talk = { title: 'Rent and repairs', host: 'ana', startIso: new Date('2026-10-27T21:00:00').toISOString(), endIso: new Date('2026-10-27T22:30:00').toISOString(), onAir: false };
    expect(seTalkLine(null, now)).toBeNull();
    expect(seTalkLine(talk, now)).toBe('Next: Rent and repairs with @ana · Today · 9:00 PM');
    expect(seTalkLine({ ...talk, onAir: true }, now)).toBe('On now: Rent and repairs with @ana');
  });

  it('says how many days were won', () => {
    expect(seDaysWonLines({ total: 1234.5, thisWeek: 3 }).big).toBe('1,234.5');
    expect(seDaysWonLines({ total: 2, thisWeek: 0.5 }).small).toBe('Our progress this week: 0.5 days won.');
  });

  it('leaves out cards by a muted person or with muted words', () => {
    const base = { kind: 'ask' as const, source: 's', label: 'Ask', body: null, createdAtIso: '2026-10-27T00:00:00.000Z', href: '/', actions: [] };
    const cards = [
      { ...base, id: 'a', title: 'Need a ride', author: { accountId: 'u1', handle: '@one' } },
      { ...base, id: 'b', title: 'Spare blankets', author: { accountId: 'u2', handle: '@two' } },
      { ...base, id: 'c', title: 'Groceries', author: null },
    ];
    const kept = seApplyMutes(cards, [
      { kind: 'person', target: 'u1' },
      { kind: 'words', target: seNormalizeMuteWords('  SPARE  blankets ') },
    ]);
    expect(kept.map((card) => card.id)).toEqual(['c']);
  });

  it('leaves out a muted post and nothing else', () => {
    const base = { kind: 'ask' as const, source: 's', label: 'Ask', body: null, createdAtIso: '2026-10-27T00:00:00.000Z', href: '/', actions: [] };
    const cards = [
      { ...base, id: 'socket-relay:1', title: 'Need a ride', author: { accountId: 'u1', handle: '@one' } },
      { ...base, id: 'socket-relay:2', title: 'Need a ride home', author: { accountId: 'u1', handle: '@one' } },
    ];
    const kept = seApplyMutes(cards, [{ kind: 'post', target: 'socket-relay:1' }]);
    expect(kept.map((card) => card.id)).toEqual(['socket-relay:2']);
  });

  it('labels each kind of mute in the Muted list', () => {
    expect(seMuteRowLabel({ kind: 'person', target: 'u1', label: '@one' })).toBe('@one');
    expect(seMuteRowLabel({ kind: 'post', target: 'socket-relay:1', label: 'Need a ride' })).toBe('Post: Need a ride');
    expect(seMuteRowLabel({ kind: 'post', target: 'socket-relay:1', label: null })).toBe('Post: a card in Today');
    expect(seMuteRowLabel({ kind: 'words', target: 'rent', label: null })).toBe('“rent”');
  });

  it('builds what muting from a card sends, and the line shown after', () => {
    const base = { kind: 'ask' as const, source: 's', label: 'Ask', body: null, createdAtIso: '2026-10-27T00:00:00.000Z', href: '/', actions: [] };
    const card = { ...base, id: 'socket-relay:1', title: 'Need a ride', author: { accountId: 'u1', handle: '@one' } };
    const story = { ...base, id: 'blog-story:a', title: 'A story', author: null };
    expect(seCardMuteRequest(card, 'post')).toEqual({ kind: 'post', target: 'socket-relay:1', label: 'Need a ride' });
    expect(seCardMuteRequest(card, 'person')).toEqual({ kind: 'person', target: 'u1', label: '@one' });
    expect(seCardMuteRequest(story, 'person')).toBeNull();
    expect(seCardMutedNote(card, 'person')).toBe('@one is muted. Their cards leave Today.');
    expect(seCardMutedNote(story, 'post')).toBe('Post muted. It leaves Today, and its conversation sends you no notices.');
  });

  it('takes a Today card id as a post mute and nothing else', () => {
    expect(seMutePostTargetValid('socket-relay:abc')).toBe(true);
    expect(seMutePostTargetValid('blog-story:https://example.org/a:b')).toBe(true);
    expect(seMutePostTargetValid('no colon')).toBe(false);
    expect(seMutePostTargetValid(`a:${'x'.repeat(200)}`)).toBe(false);
  });
});
