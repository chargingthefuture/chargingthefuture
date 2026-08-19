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
// The session is a spam gate and nothing else (owner decision, 2026-08-19): it is checked here and
// then dropped, so the stored row carries no user id and no other trace of who sent it. That
// separation is the point — a member can report accounts they lost without the report ever being
// attributable to them, and an admin reading the results cannot work out who said what.
//
// Every path through here writes an audit row, refusals included, and none of them records who the
// member is — not the user id the gate just checked, and not the address the rate limiter just
// read. What is kept is what happened: which check refused, or on success the response id, how
// many account rows came with it, and which consent flags were set. An address beside a timestamp
// would re-identify the response, which is the one thing this table promises not to allow.
export async function POST(request: Request) {
  const gate = await requireSurveyRespondentAccess();
  if (!gate.allowed) {
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
      actorUserId: null,
      command: QUORA_SURVEY_AUDIT_COMMAND.submit,
      policyStatus: 'deny',
      reason: 'csrf_denied',
    });
    return csrfDeny;
  }

  const limited = enforceSurveySubmitRateLimit(request);
  if (limited) {
    await insertSurveyAudit({
      actorUserId: null,
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
      actorUserId: null,
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
      actorUserId: null,
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
    const created = await createSurveyResponse(parsed.value);
    await insertSurveyAudit({
      actorUserId: null,
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
      actorUserId: null,
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
