import { NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import {
  getInstantCallJoinCredentials,
  getInstantCallState,
  getThreadChannelForCall,
} from 'lib/foundation/instant-call';
import type { FoundationInstantCallJoin } from 'lib/foundation/types';
import type { AllowDecision } from 'lib/auth/server-authz';
import { reportError } from 'lib/observability/report';

type JoinCredentials = {
  streamApiKey: string | null;
  streamUserId: string | null;
  streamToken: string | null;
  streamChannelId: string;
};

// Resolve the participant-only Stream audio-join credentials for an answered call (same token path as
// the Direct Line), plus the chat channel the audio room is anchored to.
async function resolveJoinCredentials(auth: AllowDecision, callId: string): Promise<JoinCredentials> {
  const channel = await getThreadChannelForCall({ callId, userId: auth.userId });
  const credentials = await getInstantCallJoinCredentials({
    userId: auth.userId,
    displayName: auth.username ?? auth.userId,
  });
  return {
    streamApiKey: credentials?.streamApiKey ?? null,
    streamUserId: credentials?.streamUserId ?? null,
    streamToken: credentials?.streamToken ?? null,
    streamChannelId: channel.streamChannelId,
  };
}

// Map an instant-call-state error to the matching HTTP response. Unknown errors are reported and
// surfaced as a 503.
function mapInstantCallStateError(error: unknown): NextResponse {
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
    const credentials: JoinCredentials =
      call.ringStatus === 'answered'
        ? await resolveJoinCredentials(gate.auth, callId)
        : { streamApiKey: null, streamUserId: null, streamToken: null, streamChannelId: '' };

    const payload: FoundationInstantCallJoin = {
      call,
      role,
      streamApiKey: credentials.streamApiKey,
      streamUserId: credentials.streamUserId,
      streamToken: credentials.streamToken,
      // The Stream Video call id the audio room joins (distinct from streamChannelId, the chat channel).
      // Surfaced flat so the client does not have to reach into `call` to find it (issue #987).
      streamCallId: call.streamCallId,
      streamChannelId: credentials.streamChannelId,
    };
    return NextResponse.json({ ok: true, ...payload }, { status: 200 });
  } catch (error) {
    return mapInstantCallStateError(error);
  }
}
