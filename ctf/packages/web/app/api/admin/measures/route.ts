import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { readDaysWon, readRetention, readTimeToUnlock } from 'lib/measures/action-minutes';
import { readRetentionCohorts } from 'lib/measures/retention-cohorts';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The 3.1 measures for the adoption tab: Days won, retention (Retained, Came back, Every day) and
// time to unlock, and the cohorts behind the layer cake and retention curves. Admin-only and
// read-only; counts only, never a named member.
export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }
  if (!decision.isAdmin) {
    return NextResponse.json({ ok: false, code: 'forbidden', message: 'This reading is admin-only.' }, { status: 403 });
  }
  try {
    const now = new Date();
    const [daysWon, retention, timeToUnlock, cohorts] = await Promise.all([
      readDaysWon(now),
      readRetention(now),
      readTimeToUnlock(now),
      readRetentionCohorts(now),
    ]);
    return NextResponse.json({ ok: true, daysWon, retention, timeToUnlock, cohorts }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'measures', op: 'admin_measures' });
    return NextResponse.json(
      { ok: false, code: 'persistence_unavailable', message: `Unable to read the measures: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
