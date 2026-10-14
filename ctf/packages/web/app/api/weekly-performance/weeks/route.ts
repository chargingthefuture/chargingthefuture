import { NextResponse } from 'next/server';
import { requireWeeklyPerformanceReadAccess } from 'lib/weekly-performance/_lib';
import { insertWeeklyPerformanceAudit, listWeeks } from 'lib/weekly-performance/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function GET() {
  const gate = await requireWeeklyPerformanceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const weeks = await listWeeks();

    // Record the read on every allow decision per the audit contract for week.list.
    await insertWeeklyPerformanceAudit({
      actorId: gate.auth.userId,
      command: 'weekly-performance.week.list',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'week_list',
      targetId: 'all',
      metadata: { count: weeks.length },
    });

    return NextResponse.json({ ok: true, weeks }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'weekly-performance', op: 'week_list' });
    return NextResponse.json(
      { ok: false, code: 'weekly_performance_unavailable', message: `Unable to list the weeks: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
