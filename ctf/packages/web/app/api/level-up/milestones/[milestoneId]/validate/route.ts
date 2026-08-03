import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertLevelUpAudit, isTrainerForCohort, validateMilestone } from 'lib/level-up/repository';
import { ensureMutationCsrf, levelUpErrorResponse, requireLevelUpReadAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteProps = {
  params: Promise<{ milestoneId: string }>;
};

const validateSchema = z.object({
  enrollmentId: z.string().uuid(),
  cohortId: z.string().uuid(),
  validationNote: z.string().optional(),
  idempotencyKey: z.string().min(3),
});

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const resolvedParams = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_payload', message: 'Invalid validate milestone payload.', issues: parsed.error.issues }, { status: 400 });
  }

  const trainerForScope = await isTrainerForCohort(gate.auth.userId, parsed.data.cohortId);
  if (!gate.auth.isAdmin && !trainerForScope) {
    return NextResponse.json({ ok: false, code: 'level_up_forbidden', message: 'Trainer or admin role required for milestone validation.' }, { status: 403 });
  }

  try {
    const validation = await validateMilestone({
      actorId: gate.auth.userId,
      enrollmentId: parsed.data.enrollmentId,
      milestoneId: resolvedParams.milestoneId,
      validationNote: parsed.data.validationNote,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    await insertLevelUpAudit({
      actorId: gate.auth.userId,
      command: 'level-up.milestone.validate',
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
    reportError(error, { area: 'level-up', op: 'milestones_milestoneid_validate' });
    return levelUpErrorResponse(error, 'Milestone validation unavailable.');
  }
}
