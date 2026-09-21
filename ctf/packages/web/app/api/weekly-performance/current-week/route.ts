import { NextResponse } from 'next/server';
import { requireWeeklyPerformanceReadAccess } from 'lib/weekly-performance/_lib';
import { getCurrentWeek, insertWeeklyPerformanceAudit } from 'lib/weekly-performance/repository';

export async function GET() {
  const gate = await requireWeeklyPerformanceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

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
}
