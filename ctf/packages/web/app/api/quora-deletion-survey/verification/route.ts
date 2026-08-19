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
} from 'lib/quora-deletion-survey/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Starting Unlock verification from the survey's confirmation screen, using the live account the
// member named.
//
// A separate route from the one that stores the response, so a failure here cannot lose an answer
// that is already saved. It creates a pending submission, approves nobody, and does nothing at all
// for a member who already has a submission on file.
//
// The accounts they reported as closed are not handled here — those go onto the account history on
// submission, for every respondent, whether or not they ever reach this route.

type VerificationBody = {
  quoraProfileUrl?: unknown;
};

type ReadResult =
  | { ok: true; value: { quoraProfileUrl: string } }
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

  return { ok: true, value: { quoraProfileUrl } };
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

  try {
    const outcome = await linkSurveyRespondentToUnlock({
      userId: gate.auth.userId,
      quoraProfileUrl: read.value.quoraProfileUrl,
    });

    const refusal = refusalResponse(outcome);
    if (refusal) {
      return refusal;
    }

    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.verificationLink,
      policyStatus: 'allow',
      reason: outcome.status,
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
