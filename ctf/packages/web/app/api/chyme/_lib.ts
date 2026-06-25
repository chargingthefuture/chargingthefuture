import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';

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

// Same-origin CSRF guard for chyme mutations: a state-changing request must carry the
// `x-ctf-csrf: '1'` confirmation header and originate from our own host. Mirrors the helper the
// other plugins expose (e.g. socketrelay/foundation), so a money-moving route like
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
