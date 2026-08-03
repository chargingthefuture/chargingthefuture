import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertLevelUpAudit, isTrainerForCohort, releaseMilestoneCredits } from 'lib/level-up/repository';
import { ensureMutationCsrf, levelUpErrorResponse, requireLevelUpReadAccess } from 'lib/level-up/_lib';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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

  const parsed = releaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_payload', message: 'Invalid release payload.', issues: parsed.error.issues }, { status: 400 });
  }

  const trainerForScope = await isTrainerForCohort(gate.auth.userId, parsed.data.cohortId);
  if (!gate.auth.isAdmin && !trainerForScope) {
    return NextResponse.json({ ok: false, code: 'level_up_forbidden', message: 'Trainer or admin role required for milestone release.' }, { status: 403 });
  }

  try {
    const release = await releaseMilestoneCredits({
      actorId: gate.auth.userId,
      enrollmentId: parsed.data.enrollmentId,
      milestoneId: resolvedParams.milestoneId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    await insertLevelUpAudit({
      actorId: gate.auth.userId,
      command: 'level-up.milestone.release',
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

    // Notify the learner their milestone was approved and credits released — best-effort, deduped on
    // the transfer id, never when the learner is the one releasing (trainer/admin self-release).
    if (release.recipientUserId && release.recipientUserId !== gate.auth.userId) {
      await notifySafe({
        userId: release.recipientUserId,
        sourcePlugin: 'level-up',
        notificationType: 'level-up.milestone.released',
        category: 'activity',
        summary: 'A LevelUp milestone was approved and your credits were released.',
        linkPath: '/apps/level-up',
        targetRef: release.userTransferId,
      });
    }

    return NextResponse.json({ ok: true, release }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'milestones_milestoneid_release' });
    return levelUpErrorResponse(error, 'Milestone release unavailable.');
  }
}
