import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { leaveRoom } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { reportError } from 'lib/observability/report';
import { requireChymeAccess } from '../_lib';

// Explicit leave: drop the member's presence row so they stop counting as in the call right
// away, instead of waiting for the presence window to lapse. The audio room calls this on Leave.
export async function POST() {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    await leaveRoom(gate.identity);

    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.call.leave',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {},
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'call_leave', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: 'Unable to leave Chyme call.' },
      { status: 500 },
    );
  }
}
