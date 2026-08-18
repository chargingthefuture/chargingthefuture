import { NextResponse } from 'next/server';
import { requireSurveyAdminAccess } from '../../_lib';
import { listSurveyResponses } from 'lib/quora-deletion-survey/repository';
import { renderSurveyCsv } from 'lib/quora-deletion-survey/csv';
import { QUORA_SURVEY_ERROR_CODE } from 'lib/quora-deletion-survey/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The export is the whole table, not a page of it: it exists so the survey can be analyzed and
// cited outside the app, and a truncated file would produce a wrong count in a blog post.
const EXPORT_LIMIT = 100_000;

// Admin-only CSV of every response, one row per reported account removal.
export async function GET() {
  const gate = await requireSurveyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const responses = await listSurveyResponses(EXPORT_LIMIT);
    return new NextResponse(renderSurveyCsv(responses), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="quora-account-deletion-survey.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    reportError(error, { area: 'quora-deletion-survey', op: 'admin-export' });
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_SURVEY_ERROR_CODE.persistenceUnavailable,
        message: 'The survey export could not be built.',
        reason: failureReason(error),
      },
      { status: 503 },
    );
  }
}
