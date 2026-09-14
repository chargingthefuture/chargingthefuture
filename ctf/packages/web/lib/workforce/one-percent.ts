// What's Your 1% — the reverse of the Workforce overview's average.
//
// The overview works forwards: split a thriving economy's output evenly across everybody in it and
// each participant contributes WORKFORCE_BENCHMARK_GDP_PER_PERSON_USD. That figure is an average,
// and an average flattens the thing this screen exists to show. Most people do not work full time,
// for every reason a person has. So the even split understates what somebody working at full
// stretch can reach, and it says nothing at all to a member asking what THEY could do.
//
// This runs the arithmetic the other way. Start from a share of the population served — one
// percent, 50,000 people out of the five million estimate — and work back to what that would mean
// for the person serving them. The finding is that 1% at an ordinary rate per person lands at
// top-tier income in a large economy. Reaching a lot of people at a modest rate, rather than a few
// people at an extraordinary one.
//
// Nothing here is a projection of what anybody will earn. It is arithmetic on a stated share, shown
// so a member can see the shape of it. Talent, work and luck decide the rest, and the screen says so.

import {
  WORKFORCE_BENCHMARK_GDP_PER_PERSON_USD,
  WORKFORCE_DEFAULT_POPULATION,
  WORKFORCE_EARNINGS_SHARE_OF_GDP,
} from './constants';

/** The share of the population this screen models. One percent, and the name of the feature. */
export const ONE_PERCENT_SHARE = 0.01;

/**
 * Rates per person per year, for reading the reverse math off. Deliberately small numbers: the
 * point is that 1% of the population at an unremarkable rate is already a large annual figure, so
 * the ladder starts below what any trade charges for an hour.
 */
export const ONE_PERCENT_RATE_LADDER_USD = [5, 20, 50, 100, 250] as const;

export type OnePercentReach = {
  /** The population estimate the whole model rests on. */
  population: number;
  /** One percent of it — the people served. */
  peopleReached: number;
  /** What those people contribute to the economy between them, at the benchmark. Never earnings. */
  activityTheyGenerateUsd: number;
  /** The even-split average the Workforce overview states, carried here for comparison. */
  averageContributionUsd: number;
  averageEarningsUsd: number;
};

/**
 * The population side of the question, with no assumption about what anybody charges.
 *
 * `activityTheyGenerateUsd` is what those 50,000 people contribute between them — their output, not
 * the member's. It is here to size the room a member is operating in, and every caller must label
 * it that way. Presenting it as one person's income would be a thousandfold overstatement and the
 * exact inflation this project refuses.
 */
export function computeOnePercentReach(population = WORKFORCE_DEFAULT_POPULATION): OnePercentReach {
  const peopleReached = Math.round(population * ONE_PERCENT_SHARE);
  return {
    population,
    peopleReached,
    activityTheyGenerateUsd: peopleReached * WORKFORCE_BENCHMARK_GDP_PER_PERSON_USD,
    averageContributionUsd: WORKFORCE_BENCHMARK_GDP_PER_PERSON_USD,
    averageEarningsUsd: Math.round(WORKFORCE_BENCHMARK_GDP_PER_PERSON_USD * WORKFORCE_EARNINGS_SHARE_OF_GDP),
  };
}

export type OnePercentRateRow = {
  /** What one person pays you, once, in a year. */
  ratePerPersonUsd: number;
  /** That rate across everybody reached. */
  annualUsd: number;
  /** How many times the even-split average this is. */
  multipleOfAverageEarnings: number;
};

/**
 * The ladder: what a given rate per person comes to across 1% of the population, and how that
 * compares to the average earnings the overview states.
 *
 * This is the reverse math. Nobody has to believe a forecast — they can read across the row that
 * matches what they already charge and see the arithmetic themselves.
 */
export function computeOnePercentRateLadder(
  reach: OnePercentReach,
  rates: readonly number[] = ONE_PERCENT_RATE_LADDER_USD,
): OnePercentRateRow[] {
  return rates.map((ratePerPersonUsd) => {
    const annualUsd = ratePerPersonUsd * reach.peopleReached;
    return {
      ratePerPersonUsd,
      annualUsd,
      multipleOfAverageEarnings:
        reach.averageEarningsUsd > 0
          ? Math.round((annualUsd / reach.averageEarningsUsd) * 10) / 10
          : 0,
    };
  });
}

/**
 * A route to reaching people, named as the part of the app that carries it.
 *
 * Every trade has a ceiling if the only way to practice it is in person, one job at a time. That
 * ceiling is what makes 1% sound impossible, and it is real — but it is a ceiling on ONE route, not
 * on the skill. A plumber can travel, consult by call, take apprentices, and answer questions in
 * writing, and each of those reaches a different number of people.
 */
export type OnePercentRoute = {
  key: string;
  /** The part of the app, named the way the member sees it. */
  surface: string;
  href: string;
  /** What the member does there, in their own trade's terms. */
  what: string;
  /** Why this route reaches more people than the one before it. */
  reach: string;
};

/**
 * The routes, widest-reaching last. Fixed rather than generated per skill: these are the capability
 * surfaces the app actually has, and inventing a per-trade list would produce plausible-sounding
 * routes that do not exist.
 */
export const ONE_PERCENT_ROUTES: readonly OnePercentRoute[] = [
  {
    key: 'in-person',
    surface: 'Foundation',
    href: '/apps/foundation',
    what: 'Do the work itself, for somebody near you or by traveling to them.',
    reach: 'One person at a time, and limited by where you can physically be.',
  },
  {
    key: 'consult',
    surface: 'Foundation',
    href: '/apps/foundation',
    what: 'Take the same question by call instead of in person — diagnose, advise, talk somebody through it.',
    reach: 'Anyone, anywhere, without either of you traveling.',
  },
  {
    key: 'session',
    surface: 'PeerProgramming',
    href: '/apps/peer-programming',
    what: 'Work through a problem live with a group watching, on video.',
    reach: 'Everybody in the session at once, not one person per hour.',
  },
  {
    key: 'teach',
    surface: 'SkillUp',
    href: '/apps/skill-up',
    what: 'Run a cohort: take apprentices, or teach the trade to people starting from nothing.',
    reach: 'Everybody you train, and then everybody they go on to serve.',
  },
  {
    key: 'write',
    surface: 'Knowledge Library',
    href: '/knowledge',
    what: 'Write down what you know, once.',
    reach: 'Everybody who asks that question afterwards, including people you never meet.',
  },
] as const;

export type OnePercentCard = {
  /** Initials only — the avatar on the card is the member's own, and no photo is involved. */
  initials: string;
  firstName: string;
  lastName: string | null;
  /** The occupation on the claimed Directory profile, when there is one. */
  jobTitleName: string | null;
  /** Skills as the Directory lists them, in its own order. */
  skills: string[];
  /** True when the member has no claimed profile yet, so the screen asks rather than guesses. */
  isUnclaimed: boolean;
};

/** Initials from a name, for the card's avatar. Falls back to one letter, never to an empty box. */
export function initialsFor(firstName: string, lastName: string | null): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = (lastName ?? '').trim().charAt(0).toUpperCase();
  return `${first}${last}` || '?';
}
