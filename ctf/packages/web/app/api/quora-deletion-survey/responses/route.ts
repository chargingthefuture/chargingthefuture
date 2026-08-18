import { NextResponse } from 'next/server';
import { ensureSurveyMutationCsrf, enforceSurveySubmitRateLimit } from '../_lib';
import { parseSurveySubmission } from 'lib/quora-deletion-survey/parse';
import { createSurveyResponse } from 'lib/quora-deletion-survey/repository';
import { QUORA_SURVEY_ERROR_CODE } from 'lib/quora-deletion-survey/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Public, sign-in-free submission of one survey response.
//
// This is the only write in the app that takes no session. That is deliberate: the people whose
// Quora accounts were removed are, by definition, mostly not members here, and putting a sign-up
// in front of the form would sample the members we already have instead of the population the
// research is about. Identity is replaced by same-origin CSRF plus a per-IP brake, and nothing
// identifying about the sender is stored.
export async function POST(request: Request) {
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
