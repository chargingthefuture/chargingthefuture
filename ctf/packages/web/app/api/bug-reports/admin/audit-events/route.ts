import { NextResponse } from 'next/server';
import { requireBugReportAdminAccess } from '../../_lib';
import { BUG_REPORT_ERROR_CODE } from 'lib/bug-reports/constants';
import { listBugReportAdminAuditEvents } from 'lib/bug-reports/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The bug-report audit trail, read by the Audit log panel on the admin screen. A trail nobody can
// read is not a check on anything, which is why this route ships alongside the table rather than
// after it. It returns which report was decided and by whom, never what the report said.
export async function GET(request: Request) {
  const gate = await requireBugReportAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const limitRaw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

  try {
    const events = await listBugReportAdminAuditEvents(limit);
    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'bug-reports', op: 'admin_audit_events' });
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.persistenceUnavailable, message: `Unable to fetch audit events: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
