import { NextRequest, NextResponse } from 'next/server';
import { requireWeeklyPerformanceReadAccess } from 'lib/weekly-performance/_lib';
import { getWeekComparison, getWeekMetrics, insertWeeklyPerformanceAudit } from 'lib/weekly-performance/repository';
import { weekStartProblem } from 'lib/weekly-performance/week-start';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function GET(request: NextRequest) {
  const gate = await requireWeeklyPerformanceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const weekStartDate = request.nextUrl.searchParams.get('weekStartDate');
  if (!weekStartDate) {
    return NextResponse.json({ ok: false, code: 'weekly_performance_week_required', message: 'weekStartDate is required.' }, { status: 400 });
  }
  // An unreadable or non-Monday date used to answer 200 with every card at 0 (each $1::date cast
  // threw and the metric fell back to 0). Refuse it instead, naming the parameter.
  const weekProblem = weekStartProblem('weekStartDate', weekStartDate);
  if (weekProblem) {
    return NextResponse.json({ ok: false, code: 'weekly_performance_week_invalid', message: weekProblem }, { status: 400 });
  }

  const compareWeekStartDate = request.nextUrl.searchParams.get('compareWeekStartDate');
  const compareProblem = compareWeekStartDate ? weekStartProblem('compareWeekStartDate', compareWeekStartDate) : null;
  if (compareProblem) {
    // The access policy's invalid_comparison_window deny for comparison.get.
    return NextResponse.json({ ok: false, code: 'invalid_comparison_window', message: compareProblem }, { status: 400 });
  }

  try {
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
  } catch (error) {
    reportError(error, { area: 'weekly-performance', op: compareWeekStartDate ? 'comparison_get' : 'metrics_get' });
    return NextResponse.json(
      {
        ok: false,
        code: 'weekly_performance_unavailable',
        message: `Unable to read the numbers for the week starting ${weekStartDate}: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
