import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
import { insertPeerProgrammingAudit, submitFeedback } from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

type FeedbackBody = {
  cohortId?: string | null;
  issueType?: string;
  suggestionCategory?: string;
  releaseSurface?: 'web' | 'android';
  note?: string;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: FeedbackBody;
  try {
    body = (await request.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.issueType || !body.suggestionCategory || !body.note) {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_payload', message: 'issueType, suggestionCategory and note are required.' }, { status: 400 });
  }

  try {
    await submitFeedback({
      userId: gate.auth.userId,
      cohortId: body.cohortId ?? null,
      issueType: body.issueType,
      suggestionCategory: body.suggestionCategory,
      releaseSurface: body.releaseSurface ?? 'web',
      note: body.note,
    });

    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.feedback.submit',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'feedback',
      targetId: gate.auth.userId,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if ((error instanceof Error ? error.message : '') !== 'assignment_not_found') {
      reportError(error, {
        area: 'peer-programming',
        op: 'submit_feedback',
        extra: { userId: gate.auth.userId },
      });
    }
    return peerProgrammingErrorResponse(error, 'Feedback submission unavailable.');
  }
}
