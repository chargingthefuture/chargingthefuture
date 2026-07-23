import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { touchRoomPresence } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { requireChymeRoomAccess, ensureMutationCsrf } from '../_lib';

// Presence heartbeat: the audio room pings this on an interval while a member is in the call so
// their last_seen_at stays fresh and they keep counting as present. No audit log — it is a
// high-frequency keepalive, not a state-changing command.
export async function POST(request: Request) {
  const gate = await requireChymeRoomAccess(request);
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    await touchRoomPresence(gate.identity, gate.roomKey);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'call_heartbeat', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: 'Unable to refresh Chyme presence.' },
      { status: 500 },
    );
  }
}
