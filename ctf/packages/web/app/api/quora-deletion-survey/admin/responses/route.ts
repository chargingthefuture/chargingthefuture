import { NextResponse } from 'next/server';
import { requireSurveyAdminAccess } from '../../_lib';
import { getSurveyTotals, listSurveyResponses } from 'lib/quora-deletion-survey/repository';
import { QUORA_SURVEY_ERROR_CODE } from 'lib/quora-deletion-survey/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// How many responses the admin list loads at once. High enough that the whole set is on screen
// for a long time to come; the CSV export is the path for anything larger.
const ADMIN_LIST_LIMIT = 500;

// Admin-only read of the raw survey. There is no member-facing or public equivalent — consent
// decides what leaves this table, and that decision is made by a person reading it, not by a
// route.
export async function GET() {
  const gate = await requireSurveyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [responses, totals] = await Promise.all([
      listSurveyResponses(ADMIN_LIST_LIMIT),
      getSurveyTotals(),
    ]);
    return NextResponse.json({ ok: true, responses, totals, limit: ADMIN_LIST_LIMIT });
  } catch (error) {
    reportError(error, { area: 'quora-deletion-survey', op: 'admin-list' });
    return NextResponse.json(
      {
        ok: false,
        code: QUORA_SURVEY_ERROR_CODE.persistenceUnavailable,
        message: 'The survey responses could not be loaded.',
        reason: failureReason(error),
      },
      { status: 503 },
    );
  }
}
