import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertLevelupAudit, isTrainerForCohort, releaseMilestoneCredits } from 'lib/levelup/repository';
import { ensureMutationCsrf, levelupErrorResponse, requireLevelupReadAccess } from 'lib/levelup/_lib';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ milestoneId: string }>;
};

const releaseSchema = z.object({
  enrollmentId: z.string().uuid(),
  cohortId: z.string().uuid(),
  idempotencyKey: z.string().min(3),
});

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLevelupReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const resolvedParams = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = releaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_payload', message: 'Invalid release payload.', issues: parsed.error.issues }, { status: 400 });
  }

  const trainerForScope = await isTrainerForCohort(gate.auth.userId, parsed.data.cohortId);
  if (!gate.auth.isAdmin && !trainerForScope) {
    return NextResponse.json({ ok: false, code: 'levelup_forbidden', message: 'Trainer or admin role required for milestone release.' }, { status: 403 });
  }

  try {
    const release = await releaseMilestoneCredits({
      actorId: gate.auth.userId,
      enrollmentId: parsed.data.enrollmentId,
      milestoneId: resolvedParams.milestoneId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    await insertLevelupAudit({
      actorId: gate.auth.userId,
      command: 'levelup.milestone.release',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'milestone_release',
      targetId: release.userTransferId,
      metadata: {
        enrollmentId: parsed.data.enrollmentId,
        milestoneId: resolvedParams.milestoneId,
        releasedAmount: release.releasedAmount,
        trainerPayoutAmount: release.trainerPayoutAmount,
        completionBonusAmount: release.completionBonusAmount,
      },
    });

    return NextResponse.json({ ok: true, release }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'levelup', op: 'milestones_milestoneid_release' });
    return levelupErrorResponse(error, 'Milestone release unavailable.');
  }
}
