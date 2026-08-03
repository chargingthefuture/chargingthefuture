import { NextRequest, NextResponse } from 'next/server';
import { requireFoundationAdminAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { listFoundationAuditEvents } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function GET(request: NextRequest) {
  const gate = await requireFoundationAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '100', 10);
    const events = await listFoundationAuditEvents(limit);
    return NextResponse.json({ ok: true, items: events }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'admin_audit_events' });
    console.error('[Foundation] Audit events list failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: `Audit event listing unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
