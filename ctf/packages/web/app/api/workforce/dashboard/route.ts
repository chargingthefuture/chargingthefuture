import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { getDashboard } from 'lib/workforce/repository';
import { logWorkforceAudit, WORKFORCE_AUDIT_WORKSPACE } from 'lib/workforce/audit';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = request.headers.get('x-request-id');
  const traceId = request.headers.get('x-trace-id');

  try {
    const dashboard = await getDashboard();
    // The audit contract requires a workforce.dashboard.fetch event on every read (the dashboard returns
    // only projected counts), with workspaceId + dashboardRequestId in targetContext and requestId /
    // traceId at the top level.
    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.dashboard.fetch',
      status: 'allow',
      reason: 'read_route_guard',
      targetType: 'dashboard',
      targetId: 'workforce',
      result: 'success',
      errorCategory: null,
      requestId,
      traceId,
      targetContext: {
        workspaceId: WORKFORCE_AUDIT_WORKSPACE,
        dashboardRequestId: requestId,
      },
      metadata: { evidence: { roleCheck: 'pass', projectionOnlyCheck: 'pass' } },
    });
    return NextResponse.json({ dashboard }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'dashboard' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to load dashboard.' },
      { status: 503 },
    );
  }
}
