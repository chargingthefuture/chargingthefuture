import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { getDashboard } from 'lib/workforce/repository';

export async function GET() {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const dashboard = await getDashboard();
    return NextResponse.json({ dashboard }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'dashboard_get', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to load dashboard.' },
      { status: 503 },
    );
  }
}
