import { describe, expect, it } from 'vitest';
import { seRoomPeopleLine, seTodayView, type SeToday } from '@ctf/shared';

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
    expect(seRoomPeopleLine(0, 0)).toBe('Quiet now');
    expect(seRoomPeopleLine(2, 3)).toBe('2 in the room, 3 listening as guests');
  });
});
