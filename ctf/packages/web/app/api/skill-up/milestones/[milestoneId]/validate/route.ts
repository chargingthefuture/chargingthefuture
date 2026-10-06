import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertSkillUpAudit, isTrainerForCohort, loadMilestoneSignOffScope, milestoneSignOffDenial, validateMilestone } from 'lib/skill-up/repository';
import { ensureMutationCsrf, skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteProps = {
  params: Promise<{ milestoneId: string }>;
};

const validateSchema = z.object({
  enrollmentId: z.string().uuid(),
  validationNote: z.string().optional(),
  idempotencyKey: z.string().min(3),
});

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSkillUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const resolvedParams = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_payload', message: 'Invalid validate milestone payload.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    // The cohort comes from the enrollment, not the body, so a trainer can only sign off enrollments
    // in their own cohort; see milestoneSignOffDenial for the full rule.
    const scope = await loadMilestoneSignOffScope(parsed.data.enrollmentId, resolvedParams.milestoneId);
    const trainerForCohort = scope ? await isTrainerForCohort(gate.auth.userId, scope.cohortId) : false;
    const denial = milestoneSignOffDenial({
      actorId: gate.auth.userId,
      isAdmin: gate.auth.isAdmin,
      trainerForCohort,
      scope,
      action: 'validation',
    });
    if (denial) {
      return NextResponse.json({ ok: false, code: denial.code, message: denial.message }, { status: denial.status });
    }

    const validation = await validateMilestone({
      actorId: gate.auth.userId,
      enrollmentId: parsed.data.enrollmentId,
      milestoneId: resolvedParams.milestoneId,
      validationNote: parsed.data.validationNote,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    await insertSkillUpAudit({
      actorId: gate.auth.userId,
      command: 'skill-up.milestone.validate',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'milestone_validation',
      targetId: validation.validationId,
      metadata: {
        enrollmentId: parsed.data.enrollmentId,
        milestoneId: resolvedParams.milestoneId,
      },
    });

    return NextResponse.json({ ok: true, validation }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'milestones_milestoneid_validate' });
    return skillUpErrorResponse(error, 'Milestone validation unavailable.');
  }
}
