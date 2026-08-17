import { NextResponse } from 'next/server';
import { requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { listAdminAuditEvents, parsePaginationParams } from 'lib/workforce/repository';
import { logWorkforceAudit, WORKFORCE_AUDIT_WORKSPACE } from 'lib/workforce/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function GET(request: Request) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = request.headers.get('x-request-id');
  const traceId = request.headers.get('x-trace-id');

  try {
    const pagination = parsePaginationParams(request.url);
    const result = await listAdminAuditEvents(pagination);

    // Reading the audit trail is itself an audited admin action (access policy:
    // requiresAdditionalAudit). Mirrors the dashboard / config-update audit shape.
    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.admin.auditEvents.fetch',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'audit-trail',
      targetId: 'workforce',
      result: 'success',
      errorCategory: null,
      requestId,
      traceId,
      targetContext: { workspaceId: WORKFORCE_AUDIT_WORKSPACE },
      metadata: { roleCheck: 'pass', auditProjectionOnlyCheck: 'pass' },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_audit_events' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: `Unable to fetch audit events: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
