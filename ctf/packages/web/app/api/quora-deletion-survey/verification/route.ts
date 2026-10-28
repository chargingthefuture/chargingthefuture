import { NextResponse } from 'next/server';
import {
  ensureSurveyMutationCsrf,
  enforceSurveySubmitRateLimit,
  requireSurveyRespondentAccess,
} from '../_lib';
import { insertSurveyAudit } from 'lib/quora-deletion-survey/repository';
import {
  linkRemovedAccountToUnlock,
  linkSurveyRespondentToUnlock,
  listReportedRemovedAccounts,
  surveyRespondentNeedsUnlock,
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
// The accounts they reported as closed go onto the account history on submission, for every
// respondent, whether or not they ever reach this route. One of them can also finish Unlock (3.1.0
// plan, Access): the body names it as removedHandle instead of a live address, and GET lists them
// for the Unlock screen.

type VerificationBody = {
  quoraProfileUrl?: unknown;
  removedHandle?: unknown;
};

type ReadResult =
  | { ok: true; value: { quoraProfileUrl: string } | { removedHandle: string } }
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

  const removedHandle = typeof body.removedHandle === 'string' ? body.removedHandle.trim() : '';
  if (removedHandle.length > 0) {
    return { ok: true, value: { removedHandle } };
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
  if (outcome.status === 'not_reported') {
    return invalidPayload('That account is not one you reported as removed in the survey.');
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
    const outcome =
      'removedHandle' in read.value
        ? await linkRemovedAccountToUnlock({ userId: gate.auth.userId, handle: read.value.removedHandle })
        : await linkSurveyRespondentToUnlock({ userId: gate.auth.userId, quoraProfileUrl: read.value.quoraProfileUrl });

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

// The removed accounts this member reported, for the Unlock screen's second route, and whether they
// still need Unlock at all. Their own answers only; the handle is shown back to the member who typed it.
export async function GET() {
  const gate = await requireSurveyRespondentAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [needsUnlock, accounts] = await Promise.all([
      surveyRespondentNeedsUnlock(gate.auth.userId),
      listReportedRemovedAccounts(gate.auth.userId),
    ]);
    return NextResponse.json(
      { ok: true, needsUnlock, removedAccounts: accounts.map((account) => ({ handle: account.handle })) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    reportError(error, { area: 'quora-deletion-survey', op: 'verification-removed-accounts' });
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_SURVEY_ERROR_CODE.persistenceUnavailable,
        message: 'Your reported accounts could not be read.',
        reason: failureReason(error),
      },
      { status: 503 },
    );
  }
}
