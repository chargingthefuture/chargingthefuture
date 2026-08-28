import { NextResponse } from 'next/server';
import { requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listDirectoryAdminAuditEvents } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The Directory audit trail, read by the Audit log tab on the Directory admin screen. A trail nobody
// can read is not a check on anything, which is why this route ships alongside the table rather than
// after it.
export async function GET(request: Request) {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const limitRaw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

  try {
    const events = await listDirectoryAdminAuditEvents(limit);
    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_audit_events' });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to fetch audit events: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
