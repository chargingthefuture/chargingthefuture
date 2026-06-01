import { NextRequest, NextResponse } from 'next/server';
import { requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { listLighthouseAuditEvents } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: NextRequest) {
  const gate = await requireLighthouseAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '100', 10);

  try {
    const items = await listLighthouseAuditEvents(limit);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_audit_event_list', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin audit event listing unavailable.' },
      { status: 503 },
    );
  }
}
