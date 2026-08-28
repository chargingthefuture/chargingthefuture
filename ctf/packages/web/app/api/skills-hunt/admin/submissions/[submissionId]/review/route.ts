import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntModeratorAccess } from '../../../../_lib';
import { logSkillsHuntAudit } from 'lib/skills-hunt/audit';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import {
  claimSkillsHuntRewardUnderCap,
  getRound,
  getSubmissionById,
  insertSkillsHuntAudit,
  revertSkillsHuntCreditClaim,
  reviewSubmission,
  validateReviewInput,
} from 'lib/skills-hunt/repository';
import { insertServiceCreditsAudit, mintGrant } from 'lib/service-credits/repository';
import type { SkillsHuntReviewAction, SkillsHuntSubmission, SkillsHuntSubmissionReviewInput } from 'lib/skills-hunt/types';
import { reportError } from 'lib/observability/report';
import { failureReason, withReason } from 'lib/errors/failure';

// System actor recorded on the ServiceCredits mint for an accepted nomination —
// mirrors Unlock's 'unlock-incentive-system'. The human reviewer is captured
// separately in the admin audit trail.
const SKILLS_HUNT_INCENTIVE_ACTOR_ID = 'skills-hunt-incentive-system';

const REVIEW_ACTIONS: readonly SkillsHuntReviewAction[] = ['accept', 'reject', 'edit', 'flag', 'unflag'];

type ReviewBody = Partial<SkillsHuntSubmissionReviewInput>;

function toReviewInput(body: ReviewBody): SkillsHuntSubmissionReviewInput {
  return {
    action: REVIEW_ACTIONS.includes(body.action as SkillsHuntReviewAction)
      ? (body.action as SkillsHuntReviewAction)
      : 'flag',
    notes: typeof body.notes === 'string' ? body.notes : null,
  };
}

// Best-effort ServiceCredits reward for an accepted nomination — mirrors the
// Unlock approval reward. Idempotent (the credit_granted guard plus the ledger
// idempotency key), pays only when the round configures a per-accept reward, and
// respects the per-scout round cap. A ledger outage is reported but never thrown,
// so it can never fail the review decision. Mutates `submission` once paid.
async function grantAcceptRewardBestEffort(submission: SkillsHuntSubmission, reviewerUserId: string): Promise<void> {
  if (submission.status !== 'accepted' || submission.creditGranted) {
    return;
  }
  try {
    const round = await getRound(submission.roundId);
    if (!round || round.rewardCreditsPerAccept <= 0) {
      return;
    }
    const perAccept = round.rewardCreditsPerAccept;

    // Claim the reward atomically under the per-scout round cap (advisory-locked
    // per round+scout) so two concurrent accepts can't overpay. The claim marks
    // the submission credited; we mint next and revert the claim if it fails.
    const claimed = await claimSkillsHuntRewardUnderCap({
      submissionId: submission.id,
      roundId: round.id,
      submitterUserId: submission.submitterUserId,
      amount: perAccept,
      cap: round.rewardPerUserRoundCap,
    });
    if (!claimed) {
      return;
    }

    const idempotencyKey = `skills-hunt-accept-submission-${submission.id}`;
    let grant: Awaited<ReturnType<typeof mintGrant>>;
    try {
      grant = await mintGrant({
        actorId: SKILLS_HUNT_INCENTIVE_ACTOR_ID,
        targetUserId: submission.submitterUserId,
        amount: perAccept,
        grantReason: 'skills_hunt_accept_reward',
        governanceTicketId: `skills-hunt:submission:${submission.id}`,
        idempotencyKey,
      });
    } catch (mintError) {
      // Mint rejected (e.g. mint budget) — release the claim so the cap and the
      // paid flag stay accurate, then surface via the outer best-effort handler.
      await revertSkillsHuntCreditClaim(submission.id);
      throw mintError;
    }

    submission.creditGranted = true;
    submission.creditAmount = perAccept;
    submission.creditGrantedAtIso = new Date().toISOString();

    await insertServiceCreditsAudit({
      actorId: reviewerUserId,
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
  } catch (rewardError) {
    reportError(rewardError, {
      area: 'skills-hunt',
      op: 'admin_submissions_submissionid_review_reward',
      extra: { submissionId: submission.id },
    });
  }
}

// The three ways a review can fail for the caller: the submission is gone, the nominee has been
// taken down from the directory since it was filed (accepting would pay for a listing that can
// never appear), or the write itself failed.
type ReviewFailureKind = { isNotFound: boolean; isTakenDown: boolean; isLiveCollision: boolean };

function resolveReviewErrorCategory(isNotFound: boolean, isTakenDown: boolean, isLiveCollision: boolean): string {
  if (isNotFound) return 'submission_not_found';
  if (isTakenDown) return 'quora_url_taken_down';
  if (isLiveCollision) return 'duplicate_live_nomination';
  return 'persistence_error';
}

function resolveReviewFailure(
  kind: ReviewFailureKind,
  // Built by the caller with withReason so the reason reaches the answer (rule 137).
  fallbackMessage: string,
): { code: string; message: string; status: number } {
  const { isNotFound, isTakenDown, isLiveCollision } = kind;
  if (isNotFound) {
    return { code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Submission not found.', status: 404 };
  }
  if (isLiveCollision) {
    return {
      code: SKILLS_HUNT_ERROR_CODE.duplicateSubmission,
      message: 'This person was nominated again while this submission was removed, and reviewing it would bring it back alongside the newer one. Reject or remove the newer nomination first.',
      status: 409,
    };
  }
  if (isTakenDown) {
    return {
      code: SKILLS_HUNT_ERROR_CODE.quoraUrlTakenDown,
      message: 'This person asked to be removed from the directory, so this nomination cannot be accepted. Reject or remove it instead.',
      status: 409,
    };
  }
  return { code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: fallbackMessage, status: 503 };
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
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
      commandVersion: '1.1.0',
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

    // The review decision is already committed and audited above; paying the
    // accept reward is a best-effort follow-up (see grantAcceptRewardBestEffort).
    await grantAcceptRewardBestEffort(submission, gate.auth.userId);

    // Re-read from the database so the response reflects the committed reward
    // state (credit_granted / credit_amount) rather than the in-memory mutation,
    // which could diverge if the claim-then-mint sequence partially failed.
    const fresh = await getSubmissionById(submission.id);

    return NextResponse.json({ ok: true, submission: fresh ?? submission }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_submissions_submissionid_review' });
    const message = error instanceof Error ? error.message : 'unknown';
    const isNotFound = message === 'skills_hunt_submission_not_found';
    // The nominee asked Directory to take their profile down after this nomination was filed. The
    // accept is refused rather than paid: it would award points and mint the round's reward while
    // generating no directory profile at all.
    const isTakenDown = message === 'skills_hunt_quora_url_taken_down';
    // Reviewing a removed submission makes it live again, which can collide with a nomination made
    // for the same person while it was removed. Say so rather than leaking a constraint error.
    const isLiveCollision = message.includes('uq_skills_hunt_submissions_round_signature_live');

    logSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.review',
      commandVersion: '1.1.0',
      status: 'allow',
      reason: 'moderator_or_admin_route_guard',
      targetType: 'submission',
      targetId: submissionId,
      result: 'failure',
      errorCategory: resolveReviewErrorCategory(isNotFound, isTakenDown, isLiveCollision),
      metadata: { action: input.action },
    });

    const failure = resolveReviewFailure({ isNotFound, isTakenDown, isLiveCollision }, withReason('Unable to review submission', error));
    return NextResponse.json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
  }
}
