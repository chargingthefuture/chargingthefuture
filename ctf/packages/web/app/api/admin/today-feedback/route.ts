import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { FEEDBACK_WINDOW_DAYS, readTodayFeedbackTotals } from 'lib/today/feedback/repository';
import { feedbackLines } from 'lib/today/feedback/report';

// GET /api/admin/today-feedback: the last 30 days of Done and Not for me totals per Today card
// source and kind, most marks first, for the Adoption screen's "What members finish and pass on".
// Admin-only and read-only; counts only, nobody named.

export const dynamic = 'force-dynamic';

function denied(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });
  if (!decision.isAdmin) return denied('forbidden', 'This reading is admin-only.', 403);
  try {
    const lines = feedbackLines(await readTodayFeedbackTotals());
    return NextResponse.json({ ok: true, days: FEEDBACK_WINDOW_DAYS, lines }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'today', op: 'feedback_read' });
    return denied('persistence_unavailable', `Unable to read the card marks: ${failureReason(error)}`, 503);
  }
}
