import { NextResponse } from 'next/server';
import { requireTrustTransportAdminAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { listAuditEvents } from 'lib/trust-transport/repository';
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
    reportError(error, { area: 'trust-transport', op: 'admin_audit_events' });
    return trustTransportErrorResponse(error, 'Audit events unavailable.');
  }
}
