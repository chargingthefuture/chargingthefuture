import { NextResponse } from 'next/server';
import { requireWhatWorksAdminAccess, whatWorksError } from '../../_lib';
import { listWhatWorksAdminAuditEvents } from 'lib/what-works/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The What Works audit trail, read by the Audit log panel on the admin screen. A trail nobody can
// read is not a check on anything, which is why this route ships alongside the table rather than
// after it.
export async function GET(request: Request) {
  const gate = await requireWhatWorksAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const limitRaw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

  try {
    const events = await listWhatWorksAdminAuditEvents(limit);
    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'what-works', op: 'admin_audit_events' });
    return whatWorksError(`Unable to fetch audit events: ${failureReason(error)}`, 'WHAT_WORKS_PERSISTENCE_UNAVAILABLE', 503);
  }
}
