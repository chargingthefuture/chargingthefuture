import { NextRequest, NextResponse } from 'next/server';
import { requireWeeklyPerformanceReadAccess } from 'lib/weekly-performance/_lib';
import { getWeekWindow, insertWeeklyPerformanceAudit } from 'lib/weekly-performance/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Implements the weekly-performance.week.get command for an arbitrary week start date.
// /current-week only ever returns the current calendar week; this route backs callers that need
// metadata for a specific historical week (the contract output: {weekStart, weekEnd, isCurrentWeek}).
const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest, context: { params: Promise<{ weekStart: string }> }) {
  const gate = await requireWeeklyPerformanceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { weekStart } = await context.params;
  if (!weekStart || !WEEK_START_PATTERN.test(weekStart)) {
    return NextResponse.json(
      { ok: false, code: 'weekly_performance_week_invalid', message: 'weekStart must be an ISO date (YYYY-MM-DD).' },
      { status: 400 },
    );
  }

  try {
    const week = await getWeekWindow(weekStart);
    if (!week) {
      return NextResponse.json(
        { ok: false, code: 'weekly_performance_week_not_found', message: 'No weekly window for the requested date.' },
        { status: 404 },
      );
    }

    // Record the read on every allow decision per the audit contract for week.get.
    await insertWeeklyPerformanceAudit({
      actorId: gate.auth.userId,
      command: 'weekly-performance.week.get',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'week',
      targetId: week.weekStart,
      metadata: { weekStart: week.weekStart, isCurrentWeek: week.isCurrentWeek },
    });

    return NextResponse.json({ ok: true, week }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'weekly-performance', op: 'week_get' });
    return NextResponse.json(
      { ok: false, code: 'weekly_performance_unavailable', message: `Unable to read the week starting ${weekStart}: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
