import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntModeratorAccess } from '../../../../_lib';
import { logSkillsHuntAudit } from 'lib/skills-hunt/audit';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import {
  insertSkillsHuntAudit,
  reviewSubmission,
  validateReviewInput,
} from 'lib/skills-hunt/repository';
import type { SkillsHuntReviewAction, SkillsHuntSubmissionReviewInput } from 'lib/skills-hunt/types';
import { reportError } from 'lib/observability/report';
import { failureReason, withReason } from 'lib/errors/failure';

type ReviewBody = Partial<SkillsHuntSubmissionReviewInput>;

function toReviewInput(body: ReviewBody): SkillsHuntSubmissionReviewInput {
  return {
    // Passed through as sent: validateReviewInput refuses anything outside
    // SKILLS_HUNT_REVIEW_ACTIONS with a 400. Defaulting a missing or misspelled action to 'flag'
    // used to flag the submission and zero its points on a bad request.
    action: (typeof body.action === 'string' ? body.action : '') as SkillsHuntReviewAction,
    notes: typeof body.notes === 'string' ? body.notes : null,
  };
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
    const reviewed = await reviewSubmission(gate.auth.userId, gate.auth.username, submissionId, input);
    const submission = reviewed.submission;
    // Say what changed, not only which button was pressed: the status it came from, the status it
    // went to, and whether the action also brought a removed row back. An accept on a pending row
    // and an accept on a removed, flagged row are the same action and very different events.
    const auditDetail = {
      action: input.action,
      fromStatus: reviewed.previousStatus,
      toStatus: submission.status,
      restoredFromRemoved: reviewed.restoredFromRemoved,
    };

    logSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.review',
      commandVersion: '2.0.0',
      status: 'allow',
      reason: 'moderator_or_admin_route_guard',
      targetType: 'submission',
      targetId: submission.id,
      result: 'success',
      errorCategory: null,
      metadata: auditDetail,
    });

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.review',
      policyStatus: 'allow',
      reason: 'moderator_or_admin_route_guard',
      targetType: 'submission',
      targetId: submission.id,
      metadata: auditDetail,
    });

    // An accept sends no ServiceCredits: a round is points only, and credits are shared out when
    // the round ends (owner decision, 2026-10-01; see lib/skills-hunt/round-awards.ts).
    return NextResponse.json({ ok: true, submission }, { status: 200 });
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
      commandVersion: '2.0.0',
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
