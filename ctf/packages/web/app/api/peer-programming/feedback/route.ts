import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingReadAccess } from 'lib/peer-programming/_lib';
import { insertPeerProgrammingAudit, submitFeedback } from 'lib/peer-programming/repository';
import { PEER_PROGRAMMING_MAX_FEEDBACK_LENGTH } from 'lib/peer-programming/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type FeedbackBody = {
  cohortId?: string | null;
  issueType?: string;
  suggestionCategory?: string;
  releaseSurface?: string;
  note?: string;
};

// The contract's releaseSurface enum. The TypeScript type on the body does not constrain a
// raw request, so the values are checked explicitly before anything is persisted.
const RELEASE_SURFACES = ['web', 'android'] as const;
type ReleaseSurface = (typeof RELEASE_SURFACES)[number];

function isReleaseSurface(value: string): value is ReleaseSurface {
  return (RELEASE_SURFACES as readonly string[]).includes(value);
}

// Parse and validate the feedback body. Returns the narrowed, required fields on success so the
// caller keeps TypeScript's non-optional types; on failure returns the exact 400 response to send.
type ParsedFeedbackBody =
  | {
      ok: true;
      cohortId: string | null | undefined;
      issueType: string;
      suggestionCategory: string;
      releaseSurface: ReleaseSurface | undefined;
      note: string;
    }
  | { ok: false; response: NextResponse };

async function parseFeedbackBody(request: Request): Promise<ParsedFeedbackBody> {
  let body: FeedbackBody;
  try {
    body = (await request.json()) as FeedbackBody;
  } catch (error) {
    return { ok: false, response: NextResponse.json({ ok: false, code: 'peer_programming_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 }) };
  }

  if (!body.issueType || !body.suggestionCategory || !body.note) {
    return { ok: false, response: NextResponse.json({ ok: false, code: 'peer_programming_invalid_payload', message: 'issueType, suggestionCategory and note are required.' }, { status: 400 }) };
  }

  // releaseSurface stays optional (older clients omit it and mean the web app), but a supplied
  // value must be one of the contract's enum members — anything else is refused, not persisted.
  if (body.releaseSurface !== undefined && !isReleaseSurface(body.releaseSurface)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: 'peer_programming_invalid_payload', message: 'releaseSurface must be "web" or "android".' },
        { status: 400 },
      ),
    };
  }

  if (body.note.length > PEER_PROGRAMMING_MAX_FEEDBACK_LENGTH) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: 'peer_programming_invalid_payload', message: `Feedback note must be ${PEER_PROGRAMMING_MAX_FEEDBACK_LENGTH} characters or fewer.` },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    cohortId: body.cohortId,
    issueType: body.issueType,
    suggestionCategory: body.suggestionCategory,
    releaseSurface: body.releaseSurface,
    note: body.note,
  };
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const parsed = await parseFeedbackBody(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  const body = parsed;

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
    reportError(error, { area: 'peer-programming', op: 'feedback' });
    return peerProgrammingErrorResponse(error, 'Feedback submission unavailable.');
  }
}
