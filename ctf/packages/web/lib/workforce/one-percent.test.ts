import { describe, expect, it } from 'vitest';
import {
  computeOnePercentRateLadder,
  computeOnePercentReach,
  initialsFor,
  ONE_PERCENT_ROUTES,
} from './one-percent';

describe('computeOnePercentReach', () => {
  it('takes one percent of the five million estimate', () => {
    const reach = computeOnePercentReach();
    expect(reach.population).toBe(5_000_000);
    expect(reach.peopleReached).toBe(50_000);
  });

  // The number this screen must never misattribute. It is what those 50,000 people contribute
  // between them, not what the member serving them earns — a thousandfold difference, and the whole
  // reason the field is named activityTheyGenerateUsd rather than anything with "your" in it.
  it('sizes the room those people occupy, at the benchmark the overview already states', () => {
    const reach = computeOnePercentReach();
    expect(reach.activityTheyGenerateUsd).toBe(50_000 * 142_500);
    expect(reach.averageContributionUsd).toBe(142_500);
    expect(reach.averageEarningsUsd).toBe(71_250);
  });

  it('honors a population other than the default', () => {
    expect(computeOnePercentReach(2_000_000).peopleReached).toBe(20_000);
  });
});

describe('computeOnePercentRateLadder', () => {
  const reach = computeOnePercentReach();

  // The finding the feature exists to show: a rate nobody would call ambitious, across one percent
  // of the population, already clears the average by a wide margin.
  it('turns a small rate per person into a large annual figure', () => {
    const [lowest] = computeOnePercentRateLadder(reach, [5]);
    expect(lowest.annualUsd).toBe(250_000);
    expect(lowest.multipleOfAverageEarnings).toBe(3.5);
  });

  it('scales with the rate', () => {
    const rows = computeOnePercentRateLadder(reach, [20, 100]);
    expect(rows[0].annualUsd).toBe(1_000_000);
    expect(rows[1].annualUsd).toBe(5_000_000);
  });

  it('never divides by zero when the benchmark is absent', () => {
    const rows = computeOnePercentRateLadder({ ...reach, averageEarningsUsd: 0 }, [50]);
    expect(rows[0].multipleOfAverageEarnings).toBe(0);
  });
});

describe('ONE_PERCENT_ROUTES', () => {
  // Routes are fixed to surfaces the app actually has. Generating them per trade would invent
  // plausible-sounding routes that do not exist, which is the failure mode this list avoids.
  it('names only real parts of the app', () => {
    const hrefs = ONE_PERCENT_ROUTES.map((route) => route.href);
    expect(hrefs).toEqual([
      '/apps/foundation',
      '/apps/foundation',
      '/apps/peer-programming',
      '/apps/skill-up',
      '/knowledge',
    ]);
  });

  it('starts with the route that reaches fewest people and ends with the widest', () => {
    expect(ONE_PERCENT_ROUTES[0].key).toBe('in-person');
    expect(ONE_PERCENT_ROUTES[ONE_PERCENT_ROUTES.length - 1].key).toBe('write');
  });
});

describe('initialsFor', () => {
  it('takes one letter from each name', () => {
    expect(initialsFor('Ada', 'Lovelace')).toBe('AL');
  });

  it('copes with a missing last name rather than rendering an empty avatar', () => {
    expect(initialsFor('Ada', null)).toBe('A');
    expect(initialsFor('  ', null)).toBe('?');
  });
});
