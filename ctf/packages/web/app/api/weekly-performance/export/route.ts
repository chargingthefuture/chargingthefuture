import { NextRequest, NextResponse } from 'next/server';
import { requireWeeklyPerformanceAdminAccess } from 'lib/weekly-performance/_lib';
import { getWeekMetrics, insertWeeklyPerformanceAudit } from 'lib/weekly-performance/repository';

function isExportEnabled(): boolean {
  const candidate = process.env.WEEKLY_PERFORMANCE_EXPORT_ENABLED?.trim().toLowerCase();
  return candidate === '1' || candidate === 'true' || candidate === 'yes';
}

export async function GET(request: NextRequest) {
  const gate = await requireWeeklyPerformanceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  if (!isExportEnabled()) {
    return NextResponse.json({ ok: false, code: 'weekly_performance_export_disabled', message: 'Export gate is disabled.' }, { status: 403 });
  }

  const weekStartDate = request.nextUrl.searchParams.get('weekStartDate');
  if (!weekStartDate) {
    return NextResponse.json({ ok: false, code: 'weekly_performance_week_required', message: 'weekStartDate is required.' }, { status: 400 });
  }

  const metrics = await getWeekMetrics(weekStartDate);

  // Export is a high-risk audited command (requiresAdditionalAudit in the access
  // policy); record the access on every allow decision per the audit contract.
  await insertWeeklyPerformanceAudit({
    actorId: gate.auth.userId,
    command: 'weekly-performance.report.export',
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'week',
    targetId: weekStartDate,
    metadata: { weekStartDate },
  });

  return NextResponse.json({ ok: true, weekStartDate, metrics }, { status: 200 });
}
