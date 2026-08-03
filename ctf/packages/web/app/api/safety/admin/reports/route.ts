import { NextResponse } from 'next/server';
import { requireSafetyAdminAccess } from '../_lib';
import { SAFETY_ERROR_CODE } from 'lib/safety/constants';
import { listSafetyReportsForAdmin } from 'lib/safety/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Admin list of member safety reports for the /admin/safety review queue (issue #809, task 3).
// Open reports first, then newest first. Each row carries the resolved reporter and reported display
// names and a count of OPEN reports about the same reported member, so a repeat offender stands out.
// Admin-gated; ordinary blocks never appear here.
export async function GET() {
  const gate = await requireSafetyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const reports = await listSafetyReportsForAdmin();
    return NextResponse.json({ ok: true, reports }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'safety', op: 'admin_reports_list' });
    return NextResponse.json(
      { ok: false, code: SAFETY_ERROR_CODE.persistenceUnavailable, message: `Unable to load safety reports: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
