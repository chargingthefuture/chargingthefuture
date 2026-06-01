import { NextResponse } from 'next/server';
import { requireTrustTransportAdminAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { listAuditEvents } from 'lib/trusttransport/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireTrustTransportAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listAuditEvents();
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'admin_audit_events_list', extra: { userId: gate.auth.userId } });
    return trustTransportErrorResponse(error, 'Audit events unavailable.');
  }
}
