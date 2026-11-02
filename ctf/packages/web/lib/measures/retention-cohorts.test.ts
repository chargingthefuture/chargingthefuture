import { describe, expect, it } from 'vitest';
import { EARLIER, LAYER_WEEKS, recentMonths, shapeRetention } from './retention-cohorts';

const NOW = new Date('2026-10-28T12:00:00Z');

describe('retention cohorts', () => {
  it('names the last five months and groups older sign-ups as Earlier', () => {
    expect(recentMonths(NOW)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    const shaped = shapeRetention(NOW, {
      layers: [],
      curves: [],
      sizes: [
        { cohort: '2026-01', members: 4 },
        { cohort: '2026-03', members: 6 },
        { cohort: '2026-09', members: 10 },
      ],
    });
    expect(shaped.cohorts[0]).toBe(EARLIER);
    expect(shaped.sizes[EARLIER]).toBe(10);
    expect(shaped.layers).toHaveLength(LAYER_WEEKS);
    expect(shaped.layers[LAYER_WEEKS - 1].week).toBe('2026-10-26');
  });

  it('stacks the weekly sign-ins by cohort, adds the weekly active total, and turns curve counts into shares', () => {
    const shaped = shapeRetention(NOW, {
      layers: [
        { cohort: '2026-09', week: '2026-10-26', signedIn: 3 },
        { cohort: '2025-12', week: '2026-10-26', signedIn: 2 },
      ],
      active: [{ week: '2026-10-26', active: 1 }],
      curves: [
        { cohort: '2026-09', week: 0, signedIn: 0, active: 0, eligible: 10 },
        { cohort: '2026-09', week: 1, signedIn: 5, active: 2, eligible: 10 },
        { cohort: '2026-09', week: 4, signedIn: 1, active: 0, eligible: 4 },
      ],
      sizes: [
        { cohort: '2025-12', members: 2 },
        { cohort: '2026-09', members: 10 },
      ],
    });
    const last = shaped.layers[LAYER_WEEKS - 1].signedIn;
    expect(last['2026-09']).toBe(3);
    expect(last[EARLIER]).toBe(2);
    expect(shaped.layers[LAYER_WEEKS - 1].active).toBe(1);
    expect(shaped.layers[0].active).toBe(0);
    const september = shaped.curves.find((c) => c.cohort === '2026-09');
    expect(september?.points[1]).toEqual({ week: 1, signedInShare: 0.5, activeShare: 0.2 });
    expect(september?.points[0].signedInShare).toBe(0);
    // Week 4 divides by the 4 members who have lived through it, not all 10.
    expect(september?.points[2]).toEqual({ week: 4, signedInShare: 0.25, activeShare: 0 });
    // A month with no week anybody has lived through, or no sign-ups, draws nothing.
    expect(shaped.curves.find((c) => c.cohort === '2026-10')?.points).toEqual([]);
    expect(shaped.curves.find((c) => c.cohort === '2026-06')?.points).toEqual([]);
  });
});
