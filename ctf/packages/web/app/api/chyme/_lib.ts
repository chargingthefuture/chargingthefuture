import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import {
  CHYME_ERROR_CODE,
  chymeRoomKeyForScope,
  type ChymeRoomScope,
} from 'lib/chyme/constants';
import { getContributorAccessConfig, isMemberEligible } from 'lib/contributor-access/repository';

export type ChymeApiIdentity = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
};

export type ChymeApiGate =
  | {
    allowed: true;
    auth: AllowDecision;
    identity: ChymeApiIdentity;
  }
  | {
    allowed: false;
    response: NextResponse;
  };

export async function requireChymeAccess(): Promise<ChymeApiGate> {
  const authDecision = await evaluatePluginAccess({
    requireUsername: false,
    // Chyme requires full access; not-yet-unlocked users are sent to the Unlock flow
    // (and to the Hub general channel for support) instead. The default approved_full
    // tier enforces that. The anonymous public Chyme shell is a separate path.
    minUnlockTier: 'approved_full',
  });

  if (!authDecision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(authDecision, { status: authDecision.status }),
    };
  }

  const identity: ChymeApiIdentity = {
    userId: authDecision.userId,
    username: authDecision.username,
    avatarUrl: null,
  };

  return {
    allowed: true,
    auth: authDecision,
    identity,
  };
}

// Private "Weavers of the Commons" room gate. Mirrors the gated Commons chat channel
// (requireGatedChannelAccess): on top of the standard Chyme access (approved_full), the caller must
// ALSO clear the contributor gate — the channel being open AND (their eligibility flag OR admin).
// A member who fails either receives a bare 404, indistinguishable from a route that does not exist
// (the contributor-access no-shaming rule): non-eligible members never learn the private room exists.
export async function requireChymeContributorAccess(): Promise<ChymeApiGate> {
  const base = await requireChymeAccess();
  if (!base.allowed) {
    return base;
  }

  const [config, eligible] = await Promise.all([
    getContributorAccessConfig(),
    isMemberEligible(base.auth.userId),
  ]);

  if (!config.channelOpen || (!eligible && !base.auth.isAdmin)) {
    return {
      allowed: false,
      response: NextResponse.json({ ok: false, message: 'Not found.' }, { status: 404 }),
    };
  }

  return base;
}

// The room a request addresses, read from the `?room=` query param on any Chyme route (works for GET
// and POST alike). Anything other than the explicit 'contributors' value resolves to the open main
// room, so an unknown/absent value is always the safe default.
export function readChymeRoomScope(request: Request): ChymeRoomScope {
  try {
    return new URL(request.url).searchParams.get('room') === 'contributors' ? 'contributors' : 'main';
  } catch {
    return 'main';
  }
}

export type ChymeRoomGate =
  | {
    allowed: true;
    auth: AllowDecision;
    identity: ChymeApiIdentity;
    scope: ChymeRoomScope;
    roomKey: string;
  }
  | {
    allowed: false;
    response: NextResponse;
  };

// Resolve the addressed room from the request and run the gate that room requires: the private room
// runs the contributor gate (404 on ineligible), the main room the standard Chyme gate. Returns the
// resolved scope + room key so the route passes the right room through to the repository.
export async function requireChymeRoomAccess(request: Request): Promise<ChymeRoomGate> {
  const scope = readChymeRoomScope(request);
  const gate = scope === 'contributors' ? await requireChymeContributorAccess() : await requireChymeAccess();
  if (!gate.allowed) {
    return gate;
  }
  return {
    allowed: true,
    auth: gate.auth,
    identity: gate.identity,
    scope,
    roomKey: chymeRoomKeyForScope(scope),
  };
}

// Same-origin CSRF guard for chyme mutations: a state-changing request must carry the
// `x-ctf-csrf: '1'` confirmation header and originate from our own host. Mirrors the helper the
// other plugins expose (e.g. socket-relay/foundation), so a money-moving route like
// `POST /api/chyme/service-credits` is protected the same way. Returns a 403 response to send back,
// or `null` when the request passes (and for GET/HEAD, which never mutate).
export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }

  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}
