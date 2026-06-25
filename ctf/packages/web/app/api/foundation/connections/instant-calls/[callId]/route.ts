import { NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import {
  getInstantCallJoinCredentials,
  getInstantCallState,
  getThreadChannelForCall,
} from 'lib/foundation/instant-call';
import type { FoundationInstantCallJoin } from 'lib/foundation/types';
import { reportError } from 'lib/observability/report';

// Poll the state of an instant 1:1 call the caller participates in (Foundation "Connect now", issue #808
// task 3). Both the caller's "ringing…" surface and the callee's incoming-ring surface poll this to follow
// the ring -> answered | declined | timed_out -> ended state machine. When the call is answered, this also
// returns the participant-only Stream audio-join credentials (same token path as the Direct Line), so the
// client can join the audio room.
export async function GET(_request: Request, context: { params: Promise<{ callId: string }> }) {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { callId } = await context.params;
  if (!callId) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'callId is required.' },
      { status: 400 },
    );
  }

  try {
    const call = await getInstantCallState({ callId, userId: gate.auth.userId });
    const role: FoundationInstantCallJoin['role'] = call.callerUserId === gate.auth.userId ? 'caller' : 'callee';

    // Only hand out audio-join credentials while the call is live (answered). A ringing/terminal call has
    // nothing to join, so the Stream fields stay null until it is answered.
    let streamApiKey: string | null = null;
    let streamUserId: string | null = null;
    let streamToken: string | null = null;
    let streamChannelId = '';
    if (call.ringStatus === 'answered') {
      const channel = await getThreadChannelForCall({ callId, userId: gate.auth.userId });
      streamChannelId = channel.streamChannelId;
      const credentials = await getInstantCallJoinCredentials({
        userId: gate.auth.userId,
        displayName: gate.auth.username ?? gate.auth.userId,
      });
      streamApiKey = credentials?.streamApiKey ?? null;
      streamUserId = credentials?.streamUserId ?? null;
      streamToken = credentials?.streamToken ?? null;
    }

    const payload: FoundationInstantCallJoin = {
      call,
      role,
      streamApiKey,
      streamUserId,
      streamToken,
      streamChannelId,
    };
    return NextResponse.json({ ok: true, ...payload }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'call_not_found') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.callNotFound, message: 'Call not found or access denied.' },
        { status: 404 },
      );
    }
    reportError(error, { area: 'foundation', op: 'connections_instant_call_state' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Could not load the call.' },
      { status: 503 },
    );
  }
}
