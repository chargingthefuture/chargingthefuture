import { NextResponse } from 'next/server';
import { requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listDirectoryInviteQueue } from 'lib/directory/invite-queue';
import { getDirectorySkillCoverage } from 'lib/directory/skill-coverage';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The invite queue, read by the Invite queue screen under the Directory admin area.
//
// Read-only and admin-only. It returns every listed person with their Quora address and their
// skills, minus anybody who already has a dedicated invite post on the blog. The blog's
// INVITE_QUEUE.md tracks what has shipped; this is where the next one comes from. The owner is in
// the queue like everybody else — see the note on DIRECTORY_INVITE_ALREADY_WRITTEN.
//
// It also returns how much of the skills catalog the Directory covers, sector by sector. The invite
// posts argue from those figures and they were being copied forward from an older reading, because
// refreshing them meant a query at a command line. Returning them here means one read of this
// screen refreshes both.
export async function GET() {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [rows, coverage] = await Promise.all([listDirectoryInviteQueue(), getDirectorySkillCoverage()]);
    return NextResponse.json({ rows, coverage }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_invite_queue' });
    return NextResponse.json(
      {
        ok: false,
        code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
        message: `Unable to build the invite queue: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
