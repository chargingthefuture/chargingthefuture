import { NextResponse } from 'next/server';
import { requireMutualTimeAdmin } from '../../_lib';
import { MUTUAL_TIME_ERROR_CODE } from 'lib/mutual-time/constants';
import { listMutualTimeAdminAuditEvents } from 'lib/mutual-time/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The Mutual Time audit trail, read by the Audit log panel on the admin screen. A trail nobody can
// read is not a check on anything, which is why this route ships alongside the table rather than
// after it.
export async function GET(request: Request) {
  const gate = await requireMutualTimeAdmin();
  if (!gate.allowed) {
    return gate.response;
  }

  const limitRaw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

  try {
    const events = await listMutualTimeAdminAuditEvents(limit);
    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'mutual-time', op: 'admin_audit_events' });
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.persistenceUnavailable, message: `Unable to fetch audit events: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
