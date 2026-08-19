import { NextResponse } from 'next/server';
import {
  ensureSurveyMutationCsrf,
  enforceSurveySubmitRateLimit,
  requireSurveyRespondentAccess,
} from '../_lib';
import { parseSurveySubmission } from 'lib/quora-deletion-survey/parse';
import { createSurveyResponse, insertSurveyAudit } from 'lib/quora-deletion-survey/repository';
import { QUORA_SURVEY_AUDIT_COMMAND, QUORA_SURVEY_ERROR_CODE } from 'lib/quora-deletion-survey/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Submission of one survey response by a signed-in member.
//
// The response carries the member id of the account that sent it (owner decision, 2026-08-19).
// This survey documents handles and content being scattered and removed, the handles are public,
// and a person types them here deliberately — someone who does not want their handle history on
// record does not fill in the form. An earlier build stored no identity; that protected the
// respondent from the reader, which is not what this survey needs, and it made a duplicate answer
// invisible.
//
// Publication is a separate question and is still governed only by the three consent flags.
// Knowing who answered is not permission to print it.
//
// Every path through here writes an audit row, refusals included, naming the member wherever
// there was a session to name. The one thing never recorded is the address the rate limiter just
// read — it is used for the in-memory counter and nothing else.
export async function POST(request: Request) {
  const gate = await requireSurveyRespondentAccess();
  if (!gate.allowed) {
    // The only path with no actor to name: there was no session.
    await insertSurveyAudit({
      actorUserId: null,
      command: QUORA_SURVEY_AUDIT_COMMAND.submit,
      policyStatus: 'deny',
      reason: 'not_signed_in',
    });
    return gate.response;
  }

  const csrfDeny = ensureSurveyMutationCsrf(request);
  if (csrfDeny) {
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.submit,
      policyStatus: 'deny',
      reason: 'csrf_denied',
    });
    return csrfDeny;
  }

  const limited = enforceSurveySubmitRateLimit(request);
  if (limited) {
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.submit,
      policyStatus: 'deny',
      reason: 'rate_limited',
    });
    return limited;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.submit,
      policyStatus: 'deny',
      reason: 'unreadable_payload',
    });
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_SURVEY_ERROR_CODE.invalidPayload,
        message: 'The form could not be read as JSON.',
        reason: failureReason(error),
      },
      { status: 400 },
    );
  }

  const parsed = parseSurveySubmission(body);
  if (!parsed.ok) {
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.submit,
      policyStatus: 'deny',
      reason: 'invalid_payload',
    });
    return NextResponse.json(
      { ok: false, code: QUORA_SURVEY_ERROR_CODE.invalidPayload, message: parsed.message },
      { status: 400 },
    );
  }

  try {
    const created = await createSurveyResponse({ ...parsed.value, userId: gate.auth.userId });
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.submit,
      policyStatus: 'allow',
      reason: 'stored',
      responseId: created.id,
      rowCount: created.accountCount,
      metadata: {
        consentPublishHandles: parsed.value.consentPublishHandles,
        consentQuote: parsed.value.consentQuote,
        consentAttributeQuote: parsed.value.consentAttributeQuote,
        anyAccountRemoved: parsed.value.anyAccountRemoved,
      },
    });
    return NextResponse.json(
      { ok: true, responseId: created.id, accountCount: created.accountCount },
      { status: 201 },
    );
  } catch (error) {
    reportError(error, { area: 'quora-deletion-survey', op: 'submit' });
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.submit,
      policyStatus: 'deny',
      reason: 'persistence_unavailable',
    });
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_SURVEY_ERROR_CODE.persistenceUnavailable,
        message: 'Your response could not be saved. Nothing was recorded — please try again.',
        reason: failureReason(error),
      },
      { status: 503 },
    );
  }
}
