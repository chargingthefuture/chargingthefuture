import { NextResponse } from 'next/server';
import { requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { listAdminAuditEvents, parsePaginationParams } from 'lib/workforce/repository';

export async function GET(request: Request) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const pagination = parsePaginationParams(request.url);
    const result = await listAdminAuditEvents(pagination);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_audit_events_list', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch audit events.' },
      { status: 503 },
    );
  }
}
