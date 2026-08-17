import { NextResponse } from 'next/server';
import { createMoodSubmission, getOrCreateMoodPseudonym } from 'lib/mood/repository';
import { ensureMutationCsrf, moodErrorResponse, requireMoodAccess } from 'lib/mood/_lib';
import { logMoodAudit } from 'lib/mood/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type SubmissionBody = {
  clientId?: string;
  moodValue?: number;
  note?: string | null;
};

const SUBMIT_DATA_CLASSES = ['mood_value_metadata', 'mood_check_timing_metadata'];

// Log the invalid-payload deny audit row and return the matching 400. Both boundary checks (missing
// fields and out-of-range mood value) share the same deny shape, differing only in the message.
function denyInvalidPayload(actorId: string, clientId: string | undefined, message: string): NextResponse {
  logMoodAudit({
    actorId,
    command: 'mood.check.submit',
    status: 'deny',
    reason: 'invalid_mood_value',
    evidence: { roleCheck: 'pass', moodBoundsCheck: 'fail', cooldownCheck: 'fail' },
    dataClassesAccessed: SUBMIT_DATA_CLASSES,
    target: { clientId },
    result: 'failure',
    errorCategory: 'invalid_payload',
  });
  return NextResponse.json({ ok: false, code: 'mood_invalid_payload', message }, { status: 400 });
}

// Log the deny audit row for a failed submission (cooldown or persistence) and return the error
// response. A cooldown denial is expected member behavior, so it is not reported as an error.
function handleSubmissionError(actorId: string, clientId: string | undefined, error: unknown): NextResponse {
  const cooldownDenied = error instanceof Error && error.message === 'cooldown_active';
  logMoodAudit({
    actorId,
    command: 'mood.check.submit',
    status: 'deny',
    reason: cooldownDenied ? 'cooldown_not_elapsed' : 'persistence_error',
    evidence: {
      roleCheck: 'pass',
      moodBoundsCheck: 'pass',
      cooldownCheck: cooldownDenied ? 'fail' : 'pass',
    },
    dataClassesAccessed: SUBMIT_DATA_CLASSES,
    target: { clientId },
    result: 'failure',
    errorCategory: cooldownDenied ? 'cooldown_active' : 'persistence_error',
  });
  if (!cooldownDenied) {
    reportError(error, { area: 'mood', op: 'submissions' });
  }
  return moodErrorResponse(error, 'Mood submission unavailable.');
}

// Validate the submission body. The 1..5 integer bound is enforced at the API boundary so an
// out-of-range value returns 400 (the invalid_mood_value denyCondition) rather than falling through
// to the repository throw path. Returns a discriminated result so the caller keeps narrowing.
function validateSubmissionBody(body: SubmissionBody): { error: string } | { data: { clientId: string; moodValue: number } } {
  if (!body.clientId || typeof body.moodValue !== 'number') {
    return { error: 'clientId and moodValue are required.' };
  }
  if (!Number.isInteger(body.moodValue) || body.moodValue < 1 || body.moodValue > 5) {
    return { error: 'moodValue must be an integer from 1 to 5.' };
  }
  return { data: { clientId: body.clientId, moodValue: body.moodValue } };
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireMoodAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: SubmissionBody;
  try {
    body = (await request.json()) as SubmissionBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'mood_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const validated = validateSubmissionBody(body);
  if ('error' in validated) {
    return denyInvalidPayload(gate.auth.userId, body.clientId, validated.error);
  }
  const { clientId, moodValue } = validated.data;

  try {
    // Resolve the server-controlled pseudonym for this user; the check-in is
    // stored under it, decoupled from the account.
    const pseudonym = await getOrCreateMoodPseudonym(gate.auth.userId);
    const submission = await createMoodSubmission({
      pseudonym,
      clientId,
      moodValue,
      note: typeof body.note === 'string' ? body.note : null,
    });

    logMoodAudit({
      actorId: gate.auth.userId,
      command: 'mood.check.submit',
      status: 'allow',
      reason: 'mood_check_recorded',
      evidence: { roleCheck: 'pass', moodBoundsCheck: 'pass', cooldownCheck: 'pass' },
      dataClassesAccessed: SUBMIT_DATA_CLASSES,
      target: { clientId, checkId: submission.checkId },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (error) {
    return handleSubmissionError(gate.auth.userId, clientId, error);
  }
}
