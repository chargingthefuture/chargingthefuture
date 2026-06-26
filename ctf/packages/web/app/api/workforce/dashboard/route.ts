import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { getDashboard } from 'lib/workforce/repository';
import { logWorkforceAudit } from 'lib/workforce/audit';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const dashboard = await getDashboard();
    // The audit contract requires a workforce.dashboard.fetch event on every read (the dashboard returns
    // only projected counts). Mirrors the admin config route's audit shape.
    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.dashboard.fetch',
      status: 'allow',
      reason: 'read_route_guard',
      targetType: 'dashboard',
      targetId: 'workforce',
      result: 'success',
      errorCategory: null,
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
