import { NextResponse } from 'next/server';
import {
  ensureSurveyMutationCsrf,
  enforceSurveySubmitRateLimit,
  requireSurveyRespondentAccess,
} from '../_lib';
import { insertSurveyAudit } from 'lib/quora-deletion-survey/repository';
import {
  linkSurveyRespondentToUnlock,
  type SurveyUnlockLinkOutcome,
} from 'lib/quora-deletion-survey/unlock-link';
import {
  QUORA_SURVEY_AUDIT_COMMAND,
  QUORA_SURVEY_ERROR_CODE,
  QUORA_SURVEY_HANDLE_MAX_LENGTH,
  QUORA_SURVEY_MAX_LINKED_HANDLES,
} from 'lib/quora-deletion-survey/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Starting Unlock verification from the survey's confirmation screen.
//
// Deliberately a separate route from the one that stores the response, not a field on it. The
// response is written with no user id; this request is written with one and carries no response
// id, so the two writes share nothing that could join them back together. Splitting them is the
// whole reason the live profile URL never appears in the survey table.
//
// This route creates a pending submission. It never approves anyone, and it does nothing at all
// for a member who already has a submission on file.

type VerificationBody = {
  quoraProfileUrl?: unknown;
  removedHandles?: unknown;
};

function parseHandles(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().slice(0, QUORA_SURVEY_HANDLE_MAX_LENGTH))
    .filter((entry) => entry.length > 0)
    .slice(0, QUORA_SURVEY_MAX_LINKED_HANDLES);
}

type ReadResult =
  | { ok: true; value: { quoraProfileUrl: string; removedHandles: string[] } }
  | { ok: false; response: NextResponse };

function invalidPayload(message: string, reason?: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: QUORA_SURVEY_ERROR_CODE.invalidPayload, message, reason },
    { status: 400 },
  );
}

async function readVerificationBody(request: Request): Promise<ReadResult> {
  let body: VerificationBody;
  try {
    body = (await request.json()) as VerificationBody;
  } catch (error) {
    return {
      ok: false,
      response: invalidPayload('The verification request could not be read.', failureReason(error)),
    };
  }

  const quoraProfileUrl =
    typeof body.quoraProfileUrl === 'string' ? body.quoraProfileUrl.trim() : '';
  if (quoraProfileUrl.length === 0) {
    return {
      ok: false,
      response: invalidPayload('A Quora profile link is needed to start verification.'),
    };
  }

  return { ok: true, value: { quoraProfileUrl, removedHandles: parseHandles(body.removedHandles) } };
}

// The two outcomes that are the member's to see and act on. Everything else is a success.
function refusalResponse(outcome: SurveyUnlockLinkOutcome): NextResponse | null {
  if (outcome.status === 'invalid_url') {
    return invalidPayload('That does not look like a Quora profile link.');
  }
  if (outcome.status === 'failed') {
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_SURVEY_ERROR_CODE.persistenceUnavailable,
        message: 'Verification could not be started. Your survey answer is already recorded.',
        reason: outcome.reason,
      },
      { status: 503 },
    );
  }
  return null;
}

export async function POST(request: Request) {
  const gate = await requireSurveyRespondentAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfFailure = ensureSurveyMutationCsrf(request);
  if (csrfFailure) {
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.verificationLink,
      policyStatus: 'deny',
      reason: 'csrf_denied',
    });
    return csrfFailure;
  }

  const rateFailure = enforceSurveySubmitRateLimit(request);
  if (rateFailure) {
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.verificationLink,
      policyStatus: 'deny',
      reason: 'rate_limited',
    });
    return rateFailure;
  }

  const read = await readVerificationBody(request);
  if (!read.ok) {
    return read.response;
  }
  const { quoraProfileUrl, removedHandles } = read.value;

  try {
    const outcome = await linkSurveyRespondentToUnlock({
      userId: gate.auth.userId,
      quoraProfileUrl,
      removedHandles,
    });

    const refusal = refusalResponse(outcome);
    if (refusal) {
      return refusal;
    }

    const linkedHandles = outcome.status === 'submitted' ? outcome.linkedHandles : 0;
    // The audit row names the member, because this half of the flow is identified by design. It
    // records how many removed handles were written to their account so a later question about
    // where a handle on a profile came from has an answer.
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.verificationLink,
      policyStatus: 'allow',
      reason: outcome.status,
      rowCount: linkedHandles,
      metadata: { linkedRemovedHandles: linkedHandles, handlesOffered: removedHandles.length },
    });

    return NextResponse.json({ ok: true, status: outcome.status });
  } catch (error) {
    reportError(error, { area: 'quora-deletion-survey', op: 'verification-link' });
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_SURVEY_ERROR_CODE.persistenceUnavailable,
        message: 'Verification could not be started. Your survey answer is already recorded.',
        reason: failureReason(error),
      },
      { status: 503 },
    );
  }
}
