import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntReadAccess, requireSkillsHuntSubmitAccess } from '../../../_lib';
import { isReservedUsername } from 'lib/auth/username-policy';
import { logSkillsHuntAudit } from 'lib/skills-hunt/audit';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { createSubmission, listSubmissions, validateSubmissionInput } from 'lib/skills-hunt/repository';
import type { SkillsHuntSubmissionInput } from 'lib/skills-hunt/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type SubmissionBody = Partial<Omit<SkillsHuntSubmissionInput, 'roundId'>>;

// Turn the rate-limit reset timestamp into an approximate, timezone-safe hint for
// the scout ("in about 3 days"). Empty string when there is no usable reset time.
function formatRetryApprox(resetAtIso: string | null): string {
  if (!resetAtIso) return '';
  const resetMs = new Date(resetAtIso).getTime();
  if (Number.isNaN(resetMs)) return '';
  const diffMs = resetMs - Date.now();
  if (diffMs <= 0) return ' You can submit again now — refresh and retry.';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return ` You can submit again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  const hours = Math.round(diffMs / 3600000);
  if (hours < 24) return ` You can submit again in about ${hours} hour${hours === 1 ? '' : 's'}.`;
  const days = Math.round(diffMs / 86400000);
  return ` You can submit again in about ${days} day${days === 1 ? '' : 's'}.`;
}

// Each way createSubmission can refuse, and the answer the scout sees. A table rather than a chain
// of ifs so adding a refusal does not grow one function's branching; the weekly-limit case is
// separate because it carries a reset timestamp in the thrown message.
const SUBMISSION_CREATE_FAILURES: ReadonlyArray<{
  message: string;
  status: number;
  code: string;
  responseMessage: string;
}> = [
  { message: 'skills_hunt_round_not_found', status: 404, code: SKILLS_HUNT_ERROR_CODE.roundNotFound, responseMessage: 'Round not found.' },
  { message: 'skills_hunt_round_not_active', status: 409, code: SKILLS_HUNT_ERROR_CODE.roundNotActive, responseMessage: 'Round is not currently active.' },
  {
    message: 'skills_hunt_pre_approval_required',
    status: 403,
    code: SKILLS_HUNT_ERROR_CODE.preApprovalRequired,
    responseMessage: 'Your recent submissions need admin pre-approval before you can submit again.',
  },
  {
    message: 'skills_hunt_rejection_guard_violation',
    status: 429,
    code: SKILLS_HUNT_ERROR_CODE.rejectionGuardViolation,
    responseMessage: 'Submission blocked by rejection-rate guardrail.',
  },
  {
    message: 'skills_hunt_duplicate_submission',
    status: 409,
    code: SKILLS_HUNT_ERROR_CODE.duplicateSubmission,
    responseMessage: 'This person has already been nominated in this round. An admin can reject or remove the existing nomination if it should not stand.',
  },
  {
    message: 'skills_hunt_quora_url_taken_down',
    status: 409,
    code: SKILLS_HUNT_ERROR_CODE.quoraUrlTakenDown,
    responseMessage: 'This person asked to be removed from the directory, so they cannot be nominated. Contact an admin if you believe that is a mistake.',
  },
  { message: 'skills_hunt_invalid_quora_url', status: 400, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, responseMessage: 'Invalid Quora profile URL.' },
  {
    message: 'skills_hunt_url_dead',
    status: 400,
    code: SKILLS_HUNT_ERROR_CODE.urlValidationFailed,
    responseMessage: 'This Quora profile URL appears to be removed or unreachable. Please verify and try again.',
  },
];

// Map a thrown createSubmission error message to the HTTP response shape.
// Unknown messages fall through to a 503 persistence-unavailable response.
function mapSubmissionCreateError(message: string): { status: number; code: string; responseMessage: string } {
  if (message.startsWith('skills_hunt_submission_limit_exceeded')) {
    const sep = message.indexOf(':');
    const resetAtIso = sep >= 0 ? message.slice(sep + 1) : null;
    return {
      status: 429,
      code: SKILLS_HUNT_ERROR_CODE.submissionLimitExceeded,
      responseMessage: `You've reached the weekly nomination limit.${formatRetryApprox(resetAtIso)}`,
    };
  }

  const matched = SUBMISSION_CREATE_FAILURES.find((entry) => entry.message === message);
  if (matched) {
    return { status: matched.status, code: matched.code, responseMessage: matched.responseMessage };
  }

  return {
    status: 503,
    code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable,
    responseMessage: 'Unable to create submission.',
  };
}

function toSubmissionInput(roundId: string, body: SubmissionBody): SkillsHuntSubmissionInput {
  return {
    roundId,
    fullName: typeof body.fullName === 'string' ? body.fullName : '',
    bio: typeof body.bio === 'string' ? body.bio : '',
    quoraProfileUrl: typeof body.quoraProfileUrl === 'string' ? body.quoraProfileUrl : '',
    skills: Array.isArray(body.skills) ? body.skills.filter((item): item is string => typeof item === 'string') : [],
    proposedSkills: Array.isArray(body.proposedSkills)
      ? body.proposedSkills.filter((item): item is string => typeof item === 'string')
      : [],
    country: typeof body.country === 'string' ? body.country : '',
    state: typeof body.state === 'string' ? body.state : null,
    city: typeof body.city === 'string' ? body.city : null,
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
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'rounds_roundid_submissions' });
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
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.reservedUsername, message: 'Your username starts with a reserved SkillsHunt prefix. Pick another to continue.' },
      { status: 403 },
    );
  }

  const { roundId } = await params;

  let body: SubmissionBody;
  try {
    body = (await request.json()) as SubmissionBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
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
    // Admins bypass the scout rate limits (weekly cap + reputation pre-approval);
    // the round-active window and duplicate-URL guard still apply.
    const submission = await createSubmission(gate.auth.userId, gate.auth.username, input, { isAdmin: gate.auth.isAdmin });

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
    reportError(error, { area: 'skills-hunt', op: 'rounds_roundid_submissions' });
    const message = error instanceof Error ? error.message : 'unknown';
    const { status, code, responseMessage } = mapSubmissionCreateError(message);

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
