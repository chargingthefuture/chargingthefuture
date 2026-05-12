import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntReadAccess, requireSkillsHuntSubmitAccess } from '../../../_lib';
import { isReservedUsername } from 'lib/auth/username-policy';
import { logSkillsHuntAudit } from 'lib/skills-hunt/audit';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { createSubmission, listSubmissions, validateSubmissionInput } from 'lib/skills-hunt/repository';
import type { SkillsHuntSubmissionInput } from 'lib/skills-hunt/types';

type SubmissionBody = Partial<Omit<SkillsHuntSubmissionInput, 'roundId'>>;

function toSubmissionInput(roundId: string, body: SubmissionBody): SkillsHuntSubmissionInput {
  return {
    roundId,
    displayName: typeof body.displayName === 'string' ? body.displayName : '',
    bio: typeof body.bio === 'string' ? body.bio : '',
    quoraProfileUrl: typeof body.quoraProfileUrl === 'string' ? body.quoraProfileUrl : '',
    skills: Array.isArray(body.skills) ? body.skills.filter((item): item is string => typeof item === 'string') : [],
    claimedProfessions: Array.isArray(body.claimedProfessions)
      ? body.claimedProfessions.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { roundId } = await params;

  try {
    const result = await listSubmissions(
      roundId,
      null,
      { page: 1, pageSize: 50 },
      { userId: gate.auth.userId, isModeratorOrAdmin: false },
    );
    return NextResponse.json({ items: result.items, total: result.total }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load submissions.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntSubmitAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  if (isReservedUsername(gate.auth.username)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.reservedUsername, message: 'Your username starts with a reserved Skills Hunt prefix. Pick another to continue.' },
      { status: 403 },
    );
  }

  const { roundId } = await params;

  let body: SubmissionBody;
  try {
    body = (await request.json()) as SubmissionBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = toSubmissionInput(roundId, body);
  if (!validateSubmissionInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid submission payload.' },
      { status: 400 },
    );
  }

  try {
    const submission = await createSubmission(gate.auth.userId, gate.auth.username, input);

    logSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.create',
      status: 'allow',
      reason: 'active_round_required',
      targetType: 'submission',
      targetId: submission.id,
      result: 'success',
      errorCategory: null,
      metadata: { roundId },
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';

    let status = 503;
    let code: string = SKILLS_HUNT_ERROR_CODE.persistenceUnavailable;
    let responseMessage = 'Unable to create submission.';

    if (message === 'skills_hunt_round_not_found') {
      status = 404;
      code = SKILLS_HUNT_ERROR_CODE.roundNotFound;
      responseMessage = 'Round not found.';
    } else if (message === 'skills_hunt_round_not_active') {
      status = 409;
      code = SKILLS_HUNT_ERROR_CODE.roundNotActive;
      responseMessage = 'Round is not currently active.';
    } else if (message === 'skills_hunt_submission_limit_exceeded') {
      status = 429;
      code = SKILLS_HUNT_ERROR_CODE.submissionLimitExceeded;
      responseMessage = 'Submission rate limit exceeded.';
    } else if (message === 'skills_hunt_rejection_guard_violation') {
      status = 429;
      code = SKILLS_HUNT_ERROR_CODE.rejectionGuardViolation;
      responseMessage = 'Submission blocked by rejection-rate guardrail.';
    } else if (message === 'skills_hunt_duplicate_submission') {
      status = 409;
      code = SKILLS_HUNT_ERROR_CODE.duplicateSubmission;
      responseMessage = 'Duplicate submission signature for this round.';
    } else if (message === 'skills_hunt_invalid_quora_url') {
      status = 400;
      code = SKILLS_HUNT_ERROR_CODE.invalidPayload;
      responseMessage = 'Invalid Quora profile URL.';
    } else if (message === 'skills_hunt_url_dead') {
      status = 400;
      code = SKILLS_HUNT_ERROR_CODE.urlValidationFailed;
      responseMessage = 'This Quora profile URL appears to be removed or unreachable. Please verify and try again.';
    }

    logSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.submission.create',
      status: 'allow',
      reason: 'active_round_required',
      targetType: 'submission',
      targetId: 'pending',
      result: 'failure',
      errorCategory: code,
      metadata: { roundId },
    });

    return NextResponse.json({ ok: false, code, message: responseMessage }, { status });
  }
}
