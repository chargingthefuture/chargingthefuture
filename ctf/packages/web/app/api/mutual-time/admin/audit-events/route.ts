import { NextResponse } from 'next/server';
import { requireMutualTimeAdmin } from '../../_lib';
import { MUTUAL_TIME_ERROR_CODE } from 'lib/mutual-time/constants';
import { listMutualTimeAdminAuditEvents, recordMutualTimeAdminAudit } from 'lib/mutual-time/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The Mutual Time audit trail, read by the Audit log panel on the admin screen. A trail nobody can
// read is not a check on anything, which is why this route ships alongside the table rather than
// after it.
export async function GET(request: Request) {
  const limitRaw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;
  // The audit contract names the row count requested as the target of a trail read.
  const target = { audit_trail: String(limit) };

  const gate = await requireMutualTimeAdmin('mutual-time.admin.audit.list', target);
  if (!gate.allowed) {
    return gate.response;
  }
  const auditRead = (result: 'success' | 'failure', errorCategory: string | null) =>
    recordMutualTimeAdminAudit({
      pluginId: 'mutual-time',
      command: 'mutual-time.admin.audit.list',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin',
      evidence: 'role=admin',
      target,
      result,
      errorCategory,
    });

  try {
    const events = await listMutualTimeAdminAuditEvents(limit);
    await auditRead('success', null);
    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    await auditRead('failure', 'persistence_error');
    reportError(error, { area: 'mutual-time', op: 'admin_audit_events' });
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.persistenceUnavailable, message: `Unable to fetch audit events: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
