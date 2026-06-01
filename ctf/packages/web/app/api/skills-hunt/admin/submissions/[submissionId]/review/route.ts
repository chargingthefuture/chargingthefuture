import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntModeratorAccess } from '../../../../_lib';
import { logSkillsHuntAudit } from 'lib/skills-hunt/audit';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { insertSkillsHuntAudit, reviewSubmission, validateReviewInput } from 'lib/skills-hunt/repository';
import type { SkillsHuntSubmissionReviewInput } from 'lib/skills-hunt/types';

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

    return NextResponse.json({ ok: true, submission }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    const isNotFound = message === 'skills_hunt_submission_not_found';

    if (!isNotFound) {
      reportError(error, { area: 'skills-hunt', op: 'review_submission', extra: { userId: gate.auth.userId, submissionId } });
    }

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
