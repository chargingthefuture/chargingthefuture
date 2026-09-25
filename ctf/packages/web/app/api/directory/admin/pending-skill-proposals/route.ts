import { NextResponse } from 'next/server';
import { requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listDirectoryPendingSkillProposals } from 'lib/directory/pending-skill-proposals';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Every member profile that carries a free-text skill still waiting on a taxonomy decision, read by
// the Pending skill proposals screen under the Directory admin area.
//
// Read-only and admin-only. A proposal that is not promoted leaves a "pending review" chip on the
// profile for good, and the only way to clear one was a statement against the database. This list
// is where the owner sees them all, with what each person already holds, so the cleanup after a
// non-promotion can happen from a phone.
export async function GET() {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const rows = await listDirectoryPendingSkillProposals();
    return NextResponse.json({ rows }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_pending_skill_proposals' });
    return NextResponse.json(
      {
        ok: false,
        code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
        message: `Unable to list the pending skill proposals: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
