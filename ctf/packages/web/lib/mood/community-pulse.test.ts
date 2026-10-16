import { describe, expect, it, vi } from 'vitest';

// The community pulse never shows one member's mood (issue #2773). A day under the per-day floor
// shows no average and no count, and the week's figures leave those days out too, so a hidden day
// cannot be worked out by subtracting the shown days from the week.
const rows: { day: string; avg_mood: string; count: string }[] = [];
vi.mock('lib/db/postgres', () => ({ queryDb: async () => ({ rows }) }));

import { getMoodCommunityPulse } from './repository';

function isoDaysAgo(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

describe('getMoodCommunityPulse', () => {
  it('hides a day with fewer than 3 check-ins and leaves it out of the week', async () => {
    rows.length = 0;
    rows.push(
      { day: isoDaysAgo(2), avg_mood: '4.0000', count: '3' },
      { day: isoDaysAgo(1), avg_mood: '2.0000', count: '3' },
      { day: isoDaysAgo(0), avg_mood: '1.0000', count: '1' },
    );
    const pulse = await getMoodCommunityPulse();
    const today = pulse.days.find((d) => d.dateIso === isoDaysAgo(0));
    expect(today).toEqual({ dateIso: isoDaysAgo(0), averageMood: null, count: 0 });
    expect(pulse.days.find((d) => d.dateIso === isoDaysAgo(2))?.averageMood).toBe(4);
    expect(pulse.totalCount).toBe(6);
    expect(pulse.averageMood).toBe(3);
  });

  it('shows nothing until the shown days hold 5 check-ins', async () => {
    rows.length = 0;
    rows.push(
      { day: isoDaysAgo(1), avg_mood: '3.0000', count: '3' },
      { day: isoDaysAgo(0), avg_mood: '5.0000', count: '2' },
    );
    const pulse = await getMoodCommunityPulse();
    expect(pulse.hasEnoughData).toBe(false);
    expect(pulse.averageMood).toBeNull();
    expect(pulse.totalCount).toBe(0);
    expect(pulse.days.every((d) => d.averageMood === null && d.count === 0)).toBe(true);
  });
});
