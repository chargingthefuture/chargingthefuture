import { describe, expect, it } from 'vitest';
import { cohortEconomics, type Cohort } from '@/components/skill-up/su-shared';

// A cohort as the browse list returns one: a flat deposit, a trainer rate per milestone, and the
// three-milestone skeleton every auto-created cohort is stamped with.
const BROWSE_COHORT = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Cleaners / Janitorial',
  requiredCredits: 50,
  completionBonusCredits: 0,
  trainerCreditsPerMilestone: 10,
  milestoneCount: 3,
  seats: 12,
  seatsAvailable: 11,
} as unknown as Cohort;

describe('cohortEconomics', () => {
  // The regression this file exists for. The browse card multiplies the per-milestone rate by the
  // milestone count, and nothing on the server used to send a count — so every cohort advertised
  // "Trainer earns 0 SC per learner" however its rate was set.
  it('reports what one learner finishing is worth to the trainer', () => {
    expect(cohortEconomics(BROWSE_COHORT).trainerPerLearnerCredits).toBe(30);
  });

  it('multiplies by the people actually enrolled', () => {
    const economics = cohortEconomics(BROWSE_COHORT);
    expect(economics.enrolledCount).toBe(1);
    expect(economics.trainerSoFarCredits).toBe(30);
  });

  it('reports zero only when the rate really is zero', () => {
    const free = { ...BROWSE_COHORT, trainerCreditsPerMilestone: 0 } as unknown as Cohort;
    expect(cohortEconomics(free).trainerPerLearnerCredits).toBe(0);
  });

  // A cohort with no milestones earns a trainer nothing, because the grant fires on a milestone
  // release. That is a real zero, not the missing-field zero above.
  it('reports zero for a cohort that has no milestones', () => {
    const noMilestones = { ...BROWSE_COHORT, milestoneCount: 0 } as unknown as Cohort;
    expect(cohortEconomics(noMilestones).trainerPerLearnerCredits).toBe(0);
  });

  it('still reads the learner side from the deposit', () => {
    expect(cohortEconomics(BROWSE_COHORT).depositCredits).toBe(50);
  });
});
