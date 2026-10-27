import { describe, expect, it } from 'vitest';
import { seDaysWonLines, seRoomPeopleLine, seTalkLine, seTodayView, type SeToday } from '@ctf/shared';

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
  cards: [card('a', 'ask'), card('b', 'offer'), card('c', 'story')],
  unavailable: ['trust-transport', 'chyme'],
};

describe('seTodayView', () => {
  it('hides the done count until a card has been opened', () => {
    expect(seTodayView(today, { read: [], hidden: [] }, 'all').doneLine).toBeNull();
    expect(seTodayView(today, { read: ['a'], hidden: [] }, 'all').doneLine).toBe('1 of 3 done');
  });

  it('leaves out hidden cards and filters by kind', () => {
    const view = seTodayView(today, { read: [], hidden: ['b'] }, 'all');
    expect(view.cards.map((c) => c.id)).toEqual(['a', 'c']);
    expect(seTodayView(today, { read: [], hidden: [] }, 'asks').cards.map((c) => c.id)).toEqual(['a']);
  });

  it('names sources that failed in plain words', () => {
    expect(seTodayView(today, { read: [], hidden: [] }, 'all').missingLine).toBe('Could not load rides, the Main Room this time.');
  });

  it('says how many are in a room', () => {
    expect(seRoomPeopleLine(0, 0)).toBe('Quiet right now');
    expect(seRoomPeopleLine(2, 3)).toBe('2 in the room, 3 listening as guests');
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
    expect(seDaysWonLines({ total: 2, thisWeek: 0.5 }).small.startsWith('0.5 this week.')).toBe(true);
  });
});
