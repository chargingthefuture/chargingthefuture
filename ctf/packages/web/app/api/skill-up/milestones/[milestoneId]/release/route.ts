import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertSkillUpAudit, isTrainerForCohort, loadMilestoneSignOffScope, milestoneSignOffDenial, releaseMilestoneCredits } from 'lib/skill-up/repository';
import { ensureMutationCsrf, skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteProps = {
  params: Promise<{ milestoneId: string }>;
};

const releaseSchema = z.object({
  enrollmentId: z.string().uuid(),
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

  const parsed = releaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_payload', message: 'Invalid release payload.', issues: parsed.error.issues }, { status: 400 });
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
      action: 'release',
    });
    if (denial) {
      return NextResponse.json({ ok: false, code: denial.code, message: denial.message }, { status: denial.status });
    }

    const release = await releaseMilestoneCredits({
      actorId: gate.auth.userId,
      enrollmentId: parsed.data.enrollmentId,
      milestoneId: resolvedParams.milestoneId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    await insertSkillUpAudit({
      actorId: gate.auth.userId,
      command: 'skill-up.milestone.release',
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
        sourcePlugin: 'skill-up',
        notificationType: 'skill-up.milestone.released',
        category: 'activity',
        summary: 'A SkillUp milestone was approved and your credits were released.',
        linkPath: '/apps/skill-up',
        targetRef: release.userTransferId,
      });
    }

    return NextResponse.json({ ok: true, release }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'milestones_milestoneid_release' });
    return skillUpErrorResponse(error, 'Milestone release unavailable.');
  }
}
