import { NextResponse } from 'next/server';
import { requireWeeklyPerformanceReadAccess } from 'lib/weekly-performance/_lib';
import { getCurrentWeek, insertWeeklyPerformanceAudit } from 'lib/weekly-performance/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function GET() {
  const gate = await requireWeeklyPerformanceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const currentWeek = await getCurrentWeek();

    // Record the read on every allow decision per the audit contract for week.get.
    await insertWeeklyPerformanceAudit({
      actorId: gate.auth.userId,
      command: 'weekly-performance.week.get',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'week',
      targetId: currentWeek?.weekStartDate ?? 'current',
      metadata: { weekStartDate: currentWeek?.weekStartDate ?? null },
    });

    return NextResponse.json({ ok: true, currentWeek }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'weekly-performance', op: 'current_week_get' });
    return NextResponse.json(
      { ok: false, code: 'weekly_performance_unavailable', message: `Unable to read the current week: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
