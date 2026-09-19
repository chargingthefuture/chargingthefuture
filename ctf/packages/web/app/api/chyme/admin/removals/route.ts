import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { listActiveRoomRemovals } from 'lib/chyme/moderation';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { requireChymeAdminAccess } from '../../_lib';

// GET /api/chyme/admin/removals — every member currently removed from a Chyme room, newest first,
// for the "Removed members" section of the Chyme admin screen. Read-only, admin-only.
export async function GET() {
  const gate = await requireChymeAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  try {
    const removals = await listActiveRoomRemovals();
    return NextResponse.json({ ok: true, removals }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'admin_removals' });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Unable to list removed members: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
