import { NextResponse } from 'next/server';
import { requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listDirectoryUnmetNeeds } from 'lib/directory/unmet-needs';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The needs landing page visitors picked that matched nobody in the Directory, read by the Unmet
// needs screen under the Directory admin area.
//
// Read-only and admin-only. One row per need: how many visits asked for it, and when it was first
// and last asked. It replaces pasting landing_unmet_needs_report.sql into the Neon dashboard.
export async function GET() {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const rows = await listDirectoryUnmetNeeds();
    return NextResponse.json({ rows }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_unmet_needs' });
    return NextResponse.json(
      {
        ok: false,
        code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
        message: `Unable to list the unmet needs: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
