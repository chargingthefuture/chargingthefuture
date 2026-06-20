import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntModeratorAccess } from '../../../../_lib';
import { logSkillsHuntAudit } from 'lib/skills-hunt/audit';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import {
  getRound,
  insertSkillsHuntAudit,
  markSkillsHuntCreditGranted,
  reviewSubmission,
  sumGrantedCreditsForUserInRound,
  validateReviewInput,
} from 'lib/skills-hunt/repository';
import { insertServiceCreditsAudit, mintGrant } from 'lib/service-credits/repository';
import type { SkillsHuntSubmissionReviewInput } from 'lib/skills-hunt/types';
import { reportError } from 'lib/observability/report';

// System actor recorded on the ServiceCredits mint for an accepted nomination —
// mirrors Unlock's 'unlock-incentive-system'. The human reviewer is captured
// separately in the admin audit trail.
const SKILLS_HUNT_INCENTIVE_ACTOR_ID = 'skills-hunt-incentive-system';

type ReviewBody = Partial<SkillsHuntSubmissionReviewInput>;

function toReviewInput(body: ReviewBody): SkillsHuntSubmissionReviewInput {
  return {
    action: body.action === 'accept' || body.action === 'reject' || body.action === 'edit' || body.action === 'flag'
      ? body.action
      : 'flag',
    notes: typeof body.notes === 'string' ? body.notes : null,
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const gate = await requireSkillsHuntModeratorAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { submissionId } = await params;

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = toReviewInput(body);
  if (!validateReviewInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidReviewAction, message: 'Invalid review payload.' },
      { status: 400 },
    );
  }

  try {
    const submission = await reviewSubmission(gate.auth.userId, gate.auth.username, submissionId, input);

    logSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.review',
      status: 'allow',
      reason: 'moderator_or_admin_route_guard',
      targetType: 'submission',
      targetId: submission.id,
      result: 'success',
      errorCategory: null,
      metadata: { action: input.action },
    });

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.review',
      policyStatus: 'allow',
      reason: 'moderator_or_admin_route_guard',
      targetType: 'submission',
      targetId: submission.id,
      metadata: { action: input.action },
    });

    // ServiceCredits reward on accept — mirrors the Unlock approval reward.
    // The review decision is already committed and audited above; the mint is a
    // best-effort follow-up so a ledger outage never fails the accept. It is
    // idempotent (credit_granted guard + ledger idempotency key), pays only when
    // the round has a per-accept reward configured, and respects the per-scout
    // round cap. Both admins and moderators can accept, so either can trigger the
    // configured reward; the owner controls payout via the per-round amount.
    if (submission.status === 'accepted' && !submission.creditGranted) {
      try {
        const round = await getRound(submission.roundId);
        const perAccept = round?.rewardCreditsPerAccept ?? 0;
        if (round && perAccept > 0) {
          const cap = round.rewardPerUserRoundCap;
          const alreadyPaid =
            cap === null ? 0 : await sumGrantedCreditsForUserInRound(round.id, submission.submitterUserId);
          const withinCap = cap === null || alreadyPaid + perAccept <= cap;
          if (withinCap) {
            const idempotencyKey = `skills-hunt-accept-submission-${submission.id}`;
            const grant = await mintGrant({
              actorId: SKILLS_HUNT_INCENTIVE_ACTOR_ID,
              targetUserId: submission.submitterUserId,
              amount: perAccept,
              grantReason: 'skills_hunt_accept_reward',
              governanceTicketId: `skills-hunt:submission:${submission.id}`,
              idempotencyKey,
            });

            const recorded = await markSkillsHuntCreditGranted(submission.id, perAccept);
            if (recorded) {
              submission.creditGranted = true;
              submission.creditAmount = perAccept;
              submission.creditGrantedAtIso = new Date().toISOString();

              await insertServiceCreditsAudit({
                actorId: gate.auth.userId,
                command: 'service-credits.governance.mint.grant.skills-hunt',
                policyStatus: 'allow',
                reason: 'skills_hunt_accept_reward',
                targetType: 'governance_event',
                targetId: grant.governanceEventId,
                metadata: {
                  skillsHuntSubmissionId: submission.id,
                  roundId: round.id,
                  targetUserId: submission.submitterUserId,
                  amount: perAccept,
                  idempotencyKey,
                },
              });
            }
          }
        }
      } catch (rewardError) {
        reportError(rewardError, {
          area: 'skills-hunt',
          op: 'admin_submissions_submissionid_review_reward',
          extra: { submissionId },
        });
      }
    }

    return NextResponse.json({ ok: true, submission }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_submissions_submissionid_review' });
    const message = error instanceof Error ? error.message : 'unknown';
    const isNotFound = message === 'skills_hunt_submission_not_found';

    logSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.review',
      status: 'allow',
      reason: 'moderator_or_admin_route_guard',
      targetType: 'submission',
      targetId: submissionId,
      result: 'failure',
      errorCategory: isNotFound ? 'submission_not_found' : 'persistence_error',
      metadata: { action: input.action },
    });

    return NextResponse.json(
      {
        ok: false,
        code: isNotFound ? SKILLS_HUNT_ERROR_CODE.submissionNotFound : SKILLS_HUNT_ERROR_CODE.persistenceUnavailable,
        message: isNotFound ? 'Submission not found.' : 'Unable to review submission.',
      },
      { status: isNotFound ? 404 : 503 },
    );
  }
}
