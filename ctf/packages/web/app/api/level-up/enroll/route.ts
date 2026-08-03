import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enrollInCohort, insertLevelUpAudit } from 'lib/level-up/repository';
import { ensureMutationCsrf, levelUpErrorResponse, requireLevelUpReadAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

const enrollSchema = z.object({
  cohortId: z.string().uuid(),
  idempotencyKey: z.string().min(3),
  depositCredits: z.number().min(0).optional(),
  allowWithoutDeposit: z.boolean().optional(),
  assignedTrainerId: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  // enrollment.create is restricted to members and admins (per the access policy contract).
  // Trainer-only accounts are not permitted to self-enroll.
  if (!gate.auth.isAdmin && gate.auth.role === 'trainer') {
    return NextResponse.json({ ok: false, code: 'level_up_forbidden', message: 'Trainers cannot enroll in cohorts.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_payload', message: 'Invalid enrollment payload.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const enrollment = await enrollInCohort({
      actorId: gate.auth.userId,
      ...parsed.data,
    });

    await insertLevelUpAudit({
      actorId: gate.auth.userId,
      command: 'level-up.enrollment.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'enrollment',
      targetId: enrollment.enrollmentId,
      metadata: {
        cohortId: parsed.data.cohortId,
        creditsDeposited: enrollment.creditsDeposited,
      },
    });

    return NextResponse.json({ ok: true, enrollment }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'enroll' });
    return levelUpErrorResponse(error, 'Enrollment unavailable.');
  }
}
