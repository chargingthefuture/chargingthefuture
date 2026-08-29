import { NextResponse } from 'next/server';
import { z } from 'zod';
import { approveCohortProposal } from 'lib/skill-up/auto-cohort';
import { ensureMutationCsrf, skillUpErrorResponse, requireSkillUpAdminAccess } from 'lib/skill-up/_lib';
import { SKILL_UP_PROPOSAL_TERM_MONTHS } from 'lib/skill-up/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteProps = {
  params: Promise<{ proposalId: string }>;
};

// Admin picks the term (1/3/5 months) at approval (owner decision 2026-07-23).
const approveSchema = z.object({
  termMonths: z.union([z.literal(1), z.literal(3), z.literal(5)]),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
  }

  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: 'skill_up_invalid_payload', message: `Term must be one of ${SKILL_UP_PROPOSAL_TERM_MONTHS.join(', ')} months.`, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await approveCohortProposal({
      actorId: gate.auth.userId,
      proposalId,
      termMonths: parsed.data.termMonths,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'admin_cohort_proposal_approve' });
    return skillUpErrorResponse(error, 'Approve proposal unavailable.');
  }
}
