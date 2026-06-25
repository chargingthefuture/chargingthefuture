import { NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { getIncomingRing } from 'lib/foundation/instant-call';
import { reportError } from 'lib/observability/report';

// The signed-in member's incoming instant 1:1 call inbox (Foundation "Connect now", issue #808 task 3).
// Returns the one live ring (if any) currently being placed to this member, so the in-app incoming-call
// surface can show "answer / decline". v1 delivers the ring in-app only via this poll.
//
// TASK 5 (push notifications) SEAM: a push to the member's device would carry the same ring so they learn
// about it without the app open; this poll remains the in-app fallback. Push is out of scope for v1.
export async function GET() {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const call = await getIncomingRing(gate.auth.userId);
    return NextResponse.json({ ok: true, call }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'connections_incoming_call' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Could not check for incoming calls.' },
      { status: 503 },
    );
  }
}
