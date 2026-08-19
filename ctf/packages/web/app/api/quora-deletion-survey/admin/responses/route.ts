import { NextResponse } from 'next/server';
import { requireSurveyAdminAccess } from '../../_lib';
import {
  getSurveyTotals,
  insertSurveyAudit,
  listSurveyResponses,
} from 'lib/quora-deletion-survey/repository';
import {
  QUORA_SURVEY_AUDIT_COMMAND,
  QUORA_SURVEY_ERROR_CODE,
} from 'lib/quora-deletion-survey/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// How many responses the admin list loads at once. High enough that the whole set is on screen
// for a long time to come; the CSV export is the path for anything larger.
const ADMIN_LIST_LIMIT = 500;

// Admin-only read of the raw survey. There is no member-facing or public equivalent — consent
// decides what leaves this table, and that decision is made by a person reading it, not by a
// route.
export async function GET() {
  const gate = await requireSurveyAdminAccess(QUORA_SURVEY_AUDIT_COMMAND.adminRead);
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [responses, totals] = await Promise.all([
      listSurveyResponses(ADMIN_LIST_LIMIT),
      getSurveyTotals(),
    ]);
    // The mirror image of the submit audit: a submit records the event and never the member, an
    // admin read records the admin and never a response's contents. What is worth knowing later
    // is who looked and how much they saw, so the row carries the reader's user id and the count
    // — not the responses themselves, which would copy the table into its own audit log.
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.adminRead,
      policyStatus: 'allow',
      reason: 'listed',
      rowCount: responses.length,
      metadata: { limit: ADMIN_LIST_LIMIT, truncated: responses.length >= ADMIN_LIST_LIMIT },
    });
    return NextResponse.json({ ok: true, responses, totals, limit: ADMIN_LIST_LIMIT });
  } catch (error) {
    reportError(error, { area: 'quora-deletion-survey', op: 'admin-list' });
    await insertSurveyAudit({
      actorUserId: gate.auth.userId,
      command: QUORA_SURVEY_AUDIT_COMMAND.adminRead,
      policyStatus: 'deny',
      reason: 'persistence_unavailable',
      metadata: { failure: failureReason(error) },
    });
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
