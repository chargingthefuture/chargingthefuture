import { NextResponse } from 'next/server';
import {
  ensureSurveyMutationCsrf,
  enforceSurveySubmitRateLimit,
  requireSurveyRespondentAccess,
} from '../_lib';
import { parseSurveySubmission } from 'lib/quora-deletion-survey/parse';
import { createSurveyResponse } from 'lib/quora-deletion-survey/repository';
import { QUORA_SURVEY_ERROR_CODE } from 'lib/quora-deletion-survey/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Submission of one survey response by a signed-in member.
//
// The session is a spam gate and nothing else (owner decision, 2026-08-19): it is checked here and
// then dropped, so the stored row carries no user id and no other trace of who sent it. That
// separation is the point — a member can report accounts they lost without the report ever being
// attributable to them, and an admin reading the results cannot work out who said what.
export async function POST(request: Request) {
  const gate = await requireSurveyRespondentAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureSurveyMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const limited = enforceSurveySubmitRateLimit(request);
  if (limited) {
    return limited;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
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
    return NextResponse.json(
      { ok: false, code: QUORA_SURVEY_ERROR_CODE.invalidPayload, message: parsed.message },
      { status: 400 },
    );
  }

  try {
    const created = await createSurveyResponse(parsed.value);
    return NextResponse.json(
      { ok: true, responseId: created.id, accountCount: created.accountCount },
      { status: 201 },
    );
  } catch (error) {
    reportError(error, { area: 'quora-deletion-survey', op: 'submit' });
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
