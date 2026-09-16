import { NextResponse } from 'next/server';
import { requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listDirectoryInviteQueue } from 'lib/directory/invite-queue';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The invite queue, read by the Invite queue screen under the Directory admin area.
//
// Read-only and admin-only. It returns every listed person with their Quora address and their
// skills, minus the owner's own listing and anybody who already has a dedicated invite post on the
// blog. The blog's INVITE_QUEUE.md tracks what has shipped; this is where the next one comes from.
export async function GET() {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const rows = await listDirectoryInviteQueue();
    return NextResponse.json({ rows }, { status: 200 });
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
