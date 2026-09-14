import { describe, expect, it } from 'vitest';
import {
  computeOnePercentRateLadder,
  computeOnePercentReach,
  computeOwnEstimate,
  computeTradeLoad,
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

describe('computeTradeLoad', () => {
  const reach = computeOnePercentReach();

  // The weight that makes this screen per-person. Two trades the model needs different numbers of
  // land on different figures, which is the whole reason it is derived from the demand model rather
  // than shown as one ladder to everybody.
  it('inverts the demand model into people served by one practitioner', () => {
    const load = computeTradeLoad({ occupationName: 'Plumber', practitionersNeeded: 4_000, reach });
    expect(load?.peoplePerPractitioner).toBe(1_250);
    expect(load?.multipleOfNaturalLoad).toBe(40);
  });

  it('separates a trade the model needs more of from one it needs fewer of', () => {
    const many = computeTradeLoad({ occupationName: 'Nurse', practitionersNeeded: 20_000, reach });
    const few = computeTradeLoad({ occupationName: 'Surveyor', practitionersNeeded: 500, reach });
    expect(many?.peoplePerPractitioner).toBe(250);
    expect(few?.peoplePerPractitioner).toBe(10_000);
    expect(many!.multipleOfNaturalLoad).toBeGreaterThan(few!.multipleOfNaturalLoad);
  });

  // No claimed occupation, or an occupation carrying no demand, has no honest figure behind it.
  // Returning null makes the screen say so instead of printing Infinity or inventing a number.
  it('returns nothing rather than a guess when there is no occupation or no demand', () => {
    expect(computeTradeLoad({ occupationName: null, practitionersNeeded: 4_000, reach })).toBeNull();
    expect(computeTradeLoad({ occupationName: 'Plumber', practitionersNeeded: 0, reach })).toBeNull();
  });
});

describe('computeOwnEstimate', () => {
  const reach = computeOnePercentReach();

  it('multiplies what you charge by how often one person needs you', () => {
    const row = computeOwnEstimate(reach, 200, 0.5);
    expect(row?.ratePerPersonUsd).toBe(100);
    expect(row?.annualUsd).toBe(5_000_000);
  });

  // A trade called once every few years must stay expressible. Rounding it to zero jobs a year
  // would silently erase exactly the trades this input exists for.
  it('keeps a trade engaged less than once a year expressible', () => {
    const row = computeOwnEstimate(reach, 1_000, 0.1);
    expect(row?.ratePerPersonUsd).toBe(100);
    expect(row?.annualUsd).toBe(5_000_000);
  });

  it('returns nothing for absent or nonsensical input rather than a zero row', () => {
    expect(computeOwnEstimate(reach, 0, 2)).toBeNull();
    expect(computeOwnEstimate(reach, 200, 0)).toBeNull();
    expect(computeOwnEstimate(reach, Number.NaN, 2)).toBeNull();
  });
});
