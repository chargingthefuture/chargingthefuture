import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enrollInCohort, insertLevelupAudit } from 'lib/levelup/repository';
import { ensureMutationCsrf, levelupErrorResponse, requireLevelupReadAccess } from 'lib/levelup/_lib';
import { reportError } from 'lib/observability/report';

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

  const gate = await requireLevelupReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_payload', message: 'Invalid enrollment payload.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const enrollment = await enrollInCohort({
      actorId: gate.auth.userId,
      ...parsed.data,
    });

    await insertLevelupAudit({
      actorId: gate.auth.userId,
      command: 'levelup.enrollment.create',
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
    reportError(error, { area: 'levelup', op: 'post_enroll_cohort', extra: { userId: gate.auth.userId, cohortId: parsed.data.cohortId } });
    return levelupErrorResponse(error, 'Enrollment unavailable.');
  }
}
