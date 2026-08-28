import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { listComicAdminAuditEvents } from 'lib/comic/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// The Comic audit trail, read by the Audit log panel on the review dashboard. A trail nobody can
// read is not a check on anything, which is why this route ships alongside the table rather than
// after it.
export async function GET(request: Request) {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) return gate.response;

  const limitRaw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

  try {
    const events = await listComicAdminAuditEvents(limit);
    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'admin_audit_events' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: `Unable to fetch audit events: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
