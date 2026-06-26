import { NextResponse } from 'next/server';
import { createMoodSubmission } from 'lib/mood/repository';
import { ensureMutationCsrf, moodErrorResponse, requireMoodAccess } from 'lib/mood/_lib';
import { logMoodAudit } from 'lib/mood/audit';
import { reportError } from 'lib/observability/report';

type SubmissionBody = {
  clientId?: string;
  moodValue?: number;
  note?: string | null;
};

const SUBMIT_DATA_CLASSES = ['mood_value_metadata', 'mood_check_timing_metadata'];

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
  } catch {
    return NextResponse.json({ ok: false, code: 'mood_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.clientId || typeof body.moodValue !== 'number') {
    logMoodAudit({
      actorId: gate.auth.userId,
      command: 'mood.check.submit',
      status: 'deny',
      reason: 'invalid_mood_value',
      evidence: { roleCheck: 'pass', moodBoundsCheck: 'fail', cooldownCheck: 'fail' },
      dataClassesAccessed: SUBMIT_DATA_CLASSES,
      target: { clientId: body.clientId },
      result: 'failure',
      errorCategory: 'invalid_payload',
    });
    return NextResponse.json({ ok: false, code: 'mood_invalid_payload', message: 'clientId and moodValue are required.' }, { status: 400 });
  }

  // Enforce the 1..5 integer bound at the API boundary so an out-of-range value
  // returns 400 (the invalid_mood_value denyCondition) rather than falling
  // through to the repository throw path.
  if (!Number.isInteger(body.moodValue) || body.moodValue < 1 || body.moodValue > 5) {
    logMoodAudit({
      actorId: gate.auth.userId,
      command: 'mood.check.submit',
      status: 'deny',
      reason: 'invalid_mood_value',
      evidence: { roleCheck: 'pass', moodBoundsCheck: 'fail', cooldownCheck: 'fail' },
      dataClassesAccessed: SUBMIT_DATA_CLASSES,
      target: { clientId: body.clientId },
      result: 'failure',
      errorCategory: 'invalid_payload',
    });
    return NextResponse.json({ ok: false, code: 'mood_invalid_payload', message: 'moodValue must be an integer from 1 to 5.' }, { status: 400 });
  }

  try {
    const submission = await createMoodSubmission({
      userId: gate.auth.userId,
      clientId: body.clientId,
      moodValue: body.moodValue,
      note: typeof body.note === 'string' ? body.note : null,
    });

    logMoodAudit({
      actorId: gate.auth.userId,
      command: 'mood.check.submit',
      status: 'allow',
      reason: 'mood_check_recorded',
      evidence: { roleCheck: 'pass', moodBoundsCheck: 'pass', cooldownCheck: 'pass' },
      dataClassesAccessed: SUBMIT_DATA_CLASSES,
      target: { clientId: body.clientId, checkId: submission.checkId },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (error) {
    const cooldownDenied = error instanceof Error && error.message === 'cooldown_active';
    logMoodAudit({
      actorId: gate.auth.userId,
      command: 'mood.check.submit',
      status: 'deny',
      reason: cooldownDenied ? 'cooldown_not_elapsed' : 'persistence_error',
      evidence: {
        roleCheck: 'pass',
        moodBoundsCheck: 'pass',
        cooldownCheck: cooldownDenied ? 'fail' : 'pass',
      },
      dataClassesAccessed: SUBMIT_DATA_CLASSES,
      target: { clientId: body.clientId },
      result: 'failure',
      errorCategory: cooldownDenied ? 'cooldown_active' : 'persistence_error',
    });
    if (!cooldownDenied) {
      reportError(error, { area: 'mood', op: 'submissions' });
    }
    return moodErrorResponse(error, 'Mood submission unavailable.');
  }
}
