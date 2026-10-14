import { describe, expect, it } from 'vitest';
import { isDisputeAdjustmentBetweenParties, milestoneSignOffDenial } from './repository';

const scope = { cohortId: 'cohort_a', learnerUserId: 'user_learner', milestoneInCohort: true };

// Who may validate or release a milestone. The cohort is the enrollment's own, so being the trainer
// of some other cohort counts for nothing.
describe('milestoneSignOffDenial', () => {
  it('allows the trainer of the enrollment cohort', () => {
    expect(milestoneSignOffDenial({ actorId: 'user_trainer', isAdmin: false, trainerForCohort: true, scope, action: 'validation' })).toBeNull();
  });

  it('allows an admin who is not the learner', () => {
    expect(milestoneSignOffDenial({ actorId: 'user_admin', isAdmin: true, trainerForCohort: false, scope, action: 'release' })).toBeNull();
  });

  it('refuses a caller who does not train the enrollment cohort', () => {
    expect(milestoneSignOffDenial({ actorId: 'user_other', isAdmin: false, trainerForCohort: false, scope, action: 'validation' })?.status).toBe(403);
  });

  it('refuses the learner signing off their own enrollment, even as the cohort trainer', () => {
    expect(milestoneSignOffDenial({ actorId: 'user_learner', isAdmin: false, trainerForCohort: true, scope, action: 'release' })?.status).toBe(403);
  });

  it('refuses an admin signing off their own enrollment', () => {
    expect(milestoneSignOffDenial({ actorId: 'user_learner', isAdmin: true, trainerForCohort: false, scope, action: 'release' })?.status).toBe(403);
  });

  it('refuses a milestone from another cohort', () => {
    const denial = milestoneSignOffDenial({
      actorId: 'user_trainer',
      isAdmin: false,
      trainerForCohort: true,
      scope: { ...scope, milestoneInCohort: false },
      action: 'validation',
    });
    expect(denial?.status).toBe(404);
  });

  it('answers not found when the enrollment does not exist', () => {
    expect(milestoneSignOffDenial({ actorId: 'user_trainer', isAdmin: true, trainerForCohort: false, scope: null, action: 'validation' })?.status).toBe(404);
  });
});

// A dispute adjustment moves credits only between the learner and the assigned trainer.
describe('isDisputeAdjustmentBetweenParties', () => {
  const parties = { learnerUserId: 'user_learner', trainerUserId: 'user_trainer' };

  it('allows learner to trainer and trainer to learner', () => {
    expect(isDisputeAdjustmentBetweenParties(parties, { sourceUserId: 'user_learner', destinationUserId: 'user_trainer' })).toBe(true);
    expect(isDisputeAdjustmentBetweenParties(parties, { sourceUserId: 'user_trainer', destinationUserId: 'user_learner' })).toBe(true);
  });

  it('refuses an outside member as source or destination', () => {
    expect(isDisputeAdjustmentBetweenParties(parties, { sourceUserId: 'user_outsider', destinationUserId: 'user_trainer' })).toBe(false);
    expect(isDisputeAdjustmentBetweenParties(parties, { sourceUserId: 'user_learner', destinationUserId: 'user_outsider' })).toBe(false);
  });

  it('refuses a move from a member to themselves', () => {
    expect(isDisputeAdjustmentBetweenParties(parties, { sourceUserId: 'user_learner', destinationUserId: 'user_learner' })).toBe(false);
  });

  it('refuses any adjustment when the enrollment has no trainer and only the learner is a party', () => {
    expect(isDisputeAdjustmentBetweenParties({ learnerUserId: 'user_learner', trainerUserId: null }, { sourceUserId: 'user_learner', destinationUserId: 'user_trainer' })).toBe(false);
  });
});
