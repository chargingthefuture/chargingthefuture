import { NextResponse } from 'next/server';
import { requireFoundationAdminAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { getFoundationDashboard } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The Foundation Admin snapshot counts, from the same `getFoundationDashboard` query the web admin
// page reads on its server, for the Android app's admin screen. Admin only and read only.
export async function GET() {
  const gate = await requireFoundationAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const dashboard = await getFoundationDashboard();
    return NextResponse.json({ ok: true, dashboard }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'admin_dashboard' });
    console.error('[Foundation] Admin dashboard read failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: `Admin snapshot unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
