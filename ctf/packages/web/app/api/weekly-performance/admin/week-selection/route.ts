import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWeeklyPerformanceAdminAccess } from 'lib/weekly-performance/_lib';
import { insertWeeklyPerformanceAudit, selectWeek } from 'lib/weekly-performance/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'weekly_performance_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
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
    reportError(error, { area: 'weekly-performance', op: 'admin_week_selection' });
    if (error instanceof Error && error.message === 'not_found') {
      return NextResponse.json({ ok: false, code: 'weekly_performance_week_not_found', message: `Week not found: ${failureReason(error)}` }, { status: 404 });
    }

    return NextResponse.json({ ok: false, code: 'weekly_performance_unavailable', message: 'Week selection unavailable.' }, { status: 503 });
  }
}
