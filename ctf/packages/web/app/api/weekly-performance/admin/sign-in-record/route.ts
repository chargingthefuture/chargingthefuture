import { NextResponse } from 'next/server';
import { requireWeeklyPerformanceAdminAccess } from 'lib/weekly-performance/_lib';
import { insertWeeklyPerformanceAudit } from 'lib/weekly-performance/repository';
import { recordLoginEventNow } from 'lib/engagement/login-activity';
import { readSignInRecordHealth } from 'lib/engagement/sign-in-record';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The sign-in record's health, for the admin Sign-in record screen.
//
// Two steps, in order. First the route runs the sign-in write for the admin making the request —
// the same statement the identity gate fires on every signed-in request — and keeps the outcome,
// including the database's own error text when it fails. Then it reads the record: totals, today,
// the current week exactly as the dashboard computes it, the last fourteen days, and whether the
// v2 foreign key that once refused every newer member is present. So a zero on the dashboard is
// answered here with one of: the write is refused and this is why; the write lands and the record
// is simply quiet; or the record is fine and the dashboard is reading it wrong.
//
// Admin or operations only, read-only apart from the caller's own member-day (which the identity
// gate would write on this very request anyway). Audited like every other read on this surface.
export async function GET() {
  const gate = await requireWeeklyPerformanceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const selfWrite = await recordLoginEventNow(gate.auth.userId);
    const health = await readSignInRecordHealth(gate.auth.userId);

    await insertWeeklyPerformanceAudit({
      actorId: gate.auth.userId,
      command: 'weekly-performance.admin.sign_in_record.get',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'week',
      targetId: health.currentWeek.weekStart,
      metadata: { selfWriteRecorded: selfWrite.recorded, usersForeignKeyPresent: health.usersForeignKeyPresent },
    });

    return NextResponse.json({ ok: true, selfWrite, health }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'weekly-performance', op: 'admin_sign_in_record' });
    return NextResponse.json(
      {
        ok: false,
        code: 'weekly_performance_unavailable',
        message: `Unable to read the sign-in record: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
