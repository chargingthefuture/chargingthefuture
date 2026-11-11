import { describe, expect, it } from 'vitest';
import {
  SE_HOLIDAY_ASKS,
  seAskSuggestionParts,
  seAskSuggestions,
  seAskTasks,
  seNextTalk,
  seTalkDays,
  seTalkFirstOpenDay,
  seTalkRow,
  type SeTalkSlot,
} from '@ctf/shared';

describe('+ New ask suggestions', () => {
  it('carries all 44 holiday asks', () => {
    expect(SE_HOLIDAY_ASKS.flatMap((group) => group.asks)).toHaveLength(44);
  });

  it('offers one from each group before anything is typed', () => {
    expect(seAskSuggestions('').map((item) => item.group)).toEqual(['Food', 'Getting around', 'Warmth', 'Care', 'Home', 'Paperwork and services']);
  });

  it('matches every typed word, and names the group', () => {
    expect(seAskSuggestions('ride pharmacy')).toEqual([{ text: 'A ride to the pharmacy or grocery store', group: 'Getting around' }]);
    expect(seAskSuggestions('zzz')).toEqual([]);
  });
});

describe('+ New ask, to the board', () => {
  it('bolds the part of a suggestion that matches what was typed', () => {
    expect(seAskSuggestionParts('A ride to', 'A ride to the pharmacy')).toEqual({ lead: 'A ride to', rest: ' the pharmacy' });
    expect(seAskSuggestionParts('pharmacy', 'A ride to the pharmacy')).toEqual({ lead: '', rest: 'A ride to the pharmacy' });
  });

  it('leaves blank small tasks out', () => {
    expect(seAskTasks(['  Find the form ', '', '   ', 'Call the office'])).toEqual(['Find the form', 'Call the office']);
  });
});

describe('+ New talk, to the board', () => {
  const now = new Date(2026, 9, 28, 12, 0);
  const at = (hour: number, minute = 0) => new Date(2026, 9, 28, hour, minute).toISOString();
  const open = (start: string, end: string): SeTalkSlot => ({ slotStartIso: start, slotEndIso: end, state: 'open', isOnAir: false, booking: null });
  const booked: SeTalkSlot = { slotStartIso: at(15), slotEndIso: at(16, 30), state: 'booked', isOnAir: false, booking: { hostUsername: 'marisol_k', title: 'Rides and errands this week' } };

  it('shows open, booked and picked slots as the board does', () => {
    const slot = open(at(19), at(20, 30));
    expect(seTalkRow(slot, null)).toMatchObject({ title: 'Open', sub: 'Take this slot', look: 'open', pickable: true });
    expect(seTalkRow(slot, slot.slotStartIso)).toMatchObject({ title: 'Your talk', sub: 'Picked', look: 'picked' });
    expect(seTalkRow(booked, null)).toMatchObject({ title: 'Rides and errands this week', sub: 'Hosted by marisol_k', look: 'booked', pickable: false });
  });

  it('lists seven days from today, each with the slots not yet ended', () => {
    const days = seTalkDays([open(at(9), at(10, 30)), booked, open(at(19), at(20, 30))], now);
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ letter: 'W', date: 28, today: true });
    expect(days[1].letter).toBe('T');
    expect(days[0].slots.map((slot) => slot.slotStartIso)).toEqual([at(15), at(19)]);
    expect(seTalkFirstOpenDay(days)).toBe(days[0].key);
  });

  it('finds the next booked talk for a member not verified yet', () => {
    expect(seNextTalk([open(at(13, 30), at(15)), booked], now)).toMatchObject({ title: 'Rides and errands this week', host: 'marisol_k' });
    expect(seNextTalk([open(at(13, 30), at(15))], now)).toBeNull();
  });
});
