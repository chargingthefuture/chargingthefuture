// How a sector's headcount is divided among the occupations inside it.
//
// Sectors have carried a `workforce_share` since the model was built, so demand has always been
// distributed across sectors by weight. Occupations never had one, so a sector's demand was divided
// by the number of job titles under it and every one got the same number. That said a settlement
// needs as many Surveyors as Electricians because both sit under Housing & Construction — untrue of
// any real population, and never claimed to be true. It was the only split available with no weight
// to read.
//
// The flatness spread to everything downstream: the per-occupation training-gap report that tells
// SkillUp which cohorts to stand up, the occupations browse ordering, and the per-trade figures on
// the Workforce screens.
//
// Weights are RELATIVE within a sector, not percentages. 3 against 1 means three times as many
// people. Relative weights can be stated one occupation at a time without restating its siblings,
// which is what makes the taxonomy's append-only change list a workable way to set them.
//
// The neutral default is what keeps this safe: an occupation nobody has weighted counts as 1. A
// sector where nothing is set has every occupation at 1, so the normalized split is the even split
// and no number moves. A sector part-way through being weighted still behaves, because the
// unweighted rows sit at the neutral value rather than at zero.

/** The weighting inputs for one occupation. `workforceShare` null means nobody has set a weight. */
export type DemandSplitItem = {
  id: string;
  workforceShare: number | null;
};

/**
 * The neutral weight for an occupation nobody has weighted.
 *
 * 1 rather than 0, so an unset occupation is "ordinary" rather than "expected to have nobody".
 * This is what makes adding the weight column a no-op until somebody sets one.
 */
export const UNWEIGHTED_OCCUPATION_WEIGHT = 1;

/**
 * One occupation's weight. null is the neutral 1; an explicit 0 is honored and means the model
 * expects nobody in that occupation, which is a different statement from never having set one.
 * A negative weight is meaningless, so it clamps to 0 rather than subtracting from its siblings.
 */
export function occupationWeight(share: number | null): number {
  if (share === null || !Number.isFinite(share)) return UNWEIGHTED_OCCUPATION_WEIGHT;
  return Math.max(0, share);
}

/**
 * Split one sector's demand across its occupations by relative weight.
 *
 * Two guards, both mirroring the sector-level split so the two levels behave the same way:
 * normalize, so the parts track the sector's demand whatever the raw weights are; and fall back to
 * an even split when the weights sum to zero, so a sector can never be blanked by a division by
 * zero or by somebody setting every occupation in it to 0.
 */
export function splitDemandByWeight(items: DemandSplitItem[], demand: number): Map<string, number> {
  const result = new Map<string, number>();
  if (items.length === 0) return result;

  const weights = items.map((item) => occupationWeight(item.workforceShare));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const evenShare = 1 / items.length;

  items.forEach((item, index) => {
    const share = weightSum > 0 ? weights[index] / weightSum : evenShare;
    result.set(item.id, Math.round(share * demand));
  });

  return result;
}
