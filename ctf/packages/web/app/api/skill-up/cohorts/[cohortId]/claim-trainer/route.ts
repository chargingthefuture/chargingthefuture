import { NextResponse } from 'next/server';
import { claimCohortAsTrainer, type ClaimIneligibleReason } from 'lib/skill-up/trainer-claim';
import { ensureMutationCsrf, skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ cohortId: string }>;
};

// Why a person is turned away, in words they can act on. The gate is a skills match, so every
// refusal points at the thing they would have to change.
const INELIGIBLE_MESSAGE: Record<ClaimIneligibleReason, string> = {
  cohort_has_no_occupation:
    'This cohort has no occupation set, so there is nothing to match your skills against. An admin needs to set one before it can be claimed.',
  no_claimed_profile:
    'Claim your Directory profile first — the skills on it are what qualify you to train a cohort.',
  no_matching_skill:
    'Your Directory profile carries no skill for this occupation. Add one you actually have, and you can claim this cohort.',
};

// A trainer claims a cohort that has no trainer yet (owner decision 2026-08-29). There is no
// pre-assigned trainer role any more: eligibility is whether the person's claimed Directory profile
// holds a skill belonging to the occupation this cohort trains. Read access plus that match is the
// whole gate, which is what takes the owner out of the approval loop.
export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSkillUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { cohortId } = await params;

  try {
    const outcome = await claimCohortAsTrainer({ cohortId, trainerUserId: gate.auth.userId });

    if (outcome.status === 'not_found') {
      return NextResponse.json({ ok: false, code: 'skill_up_not_found', message: 'No cohort with that id.' }, { status: 404 });
    }
    if (outcome.status === 'already_claimed') {
      return NextResponse.json({ ok: false, code: 'skill_up_invalid_state', message: 'This cohort already has a trainer.' }, { status: 409 });
    }
    if (outcome.status === 'not_eligible') {
      return NextResponse.json(
        { ok: false, code: 'skill_up_forbidden', reason: outcome.reason, message: INELIGIBLE_MESSAGE[outcome.reason] },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, cohortId }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'claim_trainer' });
    return skillUpErrorResponse(error, 'Claim cohort unavailable.');
  }
}
