import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWeeklyPerformanceAdminAccess } from 'lib/weekly-performance/_lib';
import { reportError } from 'lib/observability/report';
import { insertWeeklyPerformanceAudit, selectWeek } from 'lib/weekly-performance/repository';

type SelectionBody = {
  weekStartDate?: string;
};

export async function PUT(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireWeeklyPerformanceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: SelectionBody;
  try {
    body = (await request.json()) as SelectionBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'weekly_performance_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.weekStartDate) {
    return NextResponse.json({ ok: false, code: 'weekly_performance_invalid_payload', message: 'weekStartDate is required.' }, { status: 400 });
  }

  try {
    const selectedWeek = await selectWeek({ actorId: gate.auth.userId, weekStartDate: body.weekStartDate });

    await insertWeeklyPerformanceAudit({
      actorId: gate.auth.userId,
      command: 'weekly-performance.admin.week.select',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'week',
      targetId: selectedWeek.weekStartDate,
    });

    return NextResponse.json({ ok: true, selectedWeek }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return NextResponse.json({ ok: false, code: 'weekly_performance_week_not_found', message: 'Week not found.' }, { status: 404 });
    }

    reportError(error, { area: 'weekly-performance', op: 'put_admin_week_select', extra: { userId: gate.auth.userId } });
    return NextResponse.json({ ok: false, code: 'weekly_performance_unavailable', message: 'Week selection unavailable.' }, { status: 503 });
  }
}
