import { NextRequest, NextResponse } from 'next/server';
import { requireWeeklyPerformanceReadAccess } from 'lib/weekly-performance/_lib';
import { getWeekComparison, getWeekMetrics, insertWeeklyPerformanceAudit } from 'lib/weekly-performance/repository';

export async function GET(request: NextRequest) {
  const gate = await requireWeeklyPerformanceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const weekStartDate = request.nextUrl.searchParams.get('weekStartDate');
  if (!weekStartDate) {
    return NextResponse.json({ ok: false, code: 'weekly_performance_week_required', message: 'weekStartDate is required.' }, { status: 400 });
  }

  const compareWeekStartDate = request.nextUrl.searchParams.get('compareWeekStartDate');
  if (compareWeekStartDate) {
    const comparison = await getWeekComparison({ weekStartDate, compareWeekStartDate });

    // comparison.get is a high-risk audited command (requiresAdditionalAudit);
    // record the read on every allow decision per the audit contract.
    await insertWeeklyPerformanceAudit({
      actorId: gate.auth.userId,
      command: 'weekly-performance.comparison.get',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'week',
      targetId: weekStartDate,
      metadata: { weekStartDate, compareWeekStartDate },
    });

    return NextResponse.json({ ok: true, comparison }, { status: 200 });
  }

  const metrics = await getWeekMetrics(weekStartDate);

  // metrics.get is a high-risk audited command (requiresAdditionalAudit); record
  // the read on every allow decision per the audit contract.
  await insertWeeklyPerformanceAudit({
    actorId: gate.auth.userId,
    command: 'weekly-performance.metrics.get',
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'week',
    targetId: weekStartDate,
    metadata: { weekStartDate },
  });

  return NextResponse.json({ ok: true, metrics }, { status: 200 });
}
