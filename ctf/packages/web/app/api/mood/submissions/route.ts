import { NextResponse } from 'next/server';
import { createMoodSubmission } from 'lib/mood/repository';
import { ensureMutationCsrf, moodErrorResponse, requireMoodAccess } from 'lib/mood/_lib';
import { reportError } from 'lib/observability/report';

type SubmissionBody = {
  clientId?: string;
  moodValue?: number;
  note?: string | null;
};

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
    return NextResponse.json({ ok: false, code: 'mood_invalid_payload', message: 'clientId and moodValue are required.' }, { status: 400 });
  }

  try {
    const submission = await createMoodSubmission({
      userId: gate.auth.userId,
      clientId: body.clientId,
      moodValue: body.moodValue,
      note: typeof body.note === 'string' ? body.note : null,
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'mood', op: 'submissions' });
    return moodErrorResponse(error, 'Mood submission unavailable.');
  }
}
