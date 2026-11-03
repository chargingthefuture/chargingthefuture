import { describe, expect, it } from 'vitest';
import { seRoomCountsLine, seWeaversLine, seWeekDays } from '@ctf/shared';

describe('Today week strip and room lines', () => {
  it('runs Monday to Sunday with today marked and talks on their day', () => {
    const now = new Date(2026, 10, 4, 15, 0); // Wednesday, November 4
    const talk = { title: 'Holiday asks', host: 'teodor_b', startIso: new Date(2026, 10, 6, 19, 0).toISOString(), endIso: new Date(2026, 10, 6, 20, 0).toISOString(), onAir: false };
    const days = seWeekDays([talk], now);
    expect(days.map((d) => `${d.letter}${d.date}`)).toEqual(['M2', 'T3', 'W4', 'T5', 'F6', 'S7', 'S8']);
    expect(days.filter((d) => d.today).map((d) => d.date)).toEqual([4]);
    expect(days.filter((d) => d.past).map((d) => d.date)).toEqual([2, 3]);
    expect(days[4].talks).toHaveLength(1);
  });

  it('counts guests as listening and says when the room is quiet', () => {
    expect(seRoomCountsLine({ members: 4, speakers: 2, guests: 1 })).toBe('2 speaking, 3 listening');
    expect(seRoomCountsLine({ members: 0, speakers: 0, guests: 0 })).toBe('Quiet right now');
    expect(seWeaversLine({ members: 0 })).toBe('Private, badge holders only · quiet now');
  });
});
