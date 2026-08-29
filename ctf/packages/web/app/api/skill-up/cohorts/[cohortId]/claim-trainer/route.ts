import { NextResponse } from 'next/server';
import { claimAutoCohortTrainer } from 'lib/skill-up/auto-cohort';
import { ensureMutationCsrf, skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ cohortId: string }>;
};

// A trainer (or admin) claims an auto-created cohort that still has no human trainer (issue #904).
// Recruiting trainers for auto cohorts is the "kick off recruiting" half of the loop: the cohort opens
// with the scheduler as a placeholder owner, and a trainer claims it to become its trainer of record.
export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSkillUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  if (!gate.auth.isAdmin && gate.auth.role !== 'trainer') {
    return NextResponse.json(
      { ok: false, code: 'skill_up_forbidden', message: 'Trainer or admin role required to claim a cohort.' },
      { status: 403 },
    );
  }

  const { cohortId } = await params;

  try {
    const outcome = await claimAutoCohortTrainer({ cohortId, trainerUserId: gate.auth.userId });
    if (outcome === 'not_found') {
      return NextResponse.json({ ok: false, code: 'skill_up_not_found', message: 'No auto-created cohort with that id.' }, { status: 404 });
    }
    if (outcome === 'already_claimed') {
      return NextResponse.json({ ok: false, code: 'skill_up_invalid_state', message: 'This cohort already has a trainer.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, cohortId }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'claim_trainer' });
    return skillUpErrorResponse(error, 'Claim cohort unavailable.');
  }
}
