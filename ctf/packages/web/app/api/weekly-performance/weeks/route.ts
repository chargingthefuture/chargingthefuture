import { NextResponse } from 'next/server';
import { requireWeeklyPerformanceReadAccess } from 'lib/weekly-performance/_lib';
import { insertWeeklyPerformanceAudit, listWeeks } from 'lib/weekly-performance/repository';

export async function GET() {
  const gate = await requireWeeklyPerformanceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

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
}
