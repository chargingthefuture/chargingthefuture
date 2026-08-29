import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dismissCohortProposal } from 'lib/skill-up/auto-cohort';
import { ensureMutationCsrf, skillUpErrorResponse, requireSkillUpAdminAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ proposalId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSkillUpAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { proposalId } = await params;
  if (!z.string().uuid().safeParse(proposalId).success) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_payload', message: 'Invalid proposal id.' }, { status: 400 });
  }

  try {
    const result = await dismissCohortProposal({ actorId: gate.auth.userId, proposalId });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'admin_cohort_proposal_dismiss' });
    return skillUpErrorResponse(error, 'Dismiss proposal unavailable.');
  }
}
