import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { getAppUrl } from 'lib/auth/runtime-env';
import { PEER_PROGRAMMING_ERROR_CODE } from 'lib/peer-programming/constants';
import { ensurePeerProgrammingAdmin } from 'lib/peer-programming/policy';
import { reportError } from 'lib/observability/report';

export type PeerProgrammingApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

export async function requirePeerProgrammingReadAccess(): Promise<PeerProgrammingApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true, auth: decision };
}

export async function requirePeerProgrammingAdminAccess(): Promise<PeerProgrammingApiGate> {
  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensurePeerProgrammingAdmin(gate.auth);
  if (deny) {
    return { allowed: false, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return gate;
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const appUrl = getAppUrl();
  const origin = request.headers.get('origin');
  if (!appUrl || !origin) {
    return null;
  }

  try {
    if (new URL(appUrl).host !== new URL(origin).host) {
      return NextResponse.json(
        { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }

  return null;
}

export function peerProgrammingErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  const code = error instanceof Error ? error.message : '';

  if (code === 'invalid_payload') {
    return NextResponse.json(
      { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.invalidPayload, message: 'Invalid payload.' },
      { status: 400 },
    );
  }

  if (code === 'policy_denied') {
    return NextResponse.json(
      { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.policyDenied, message: 'Operation denied by policy.' },
      { status: 403 },
    );
  }

  if (code === 'not_found') {
    return NextResponse.json(
      { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.notFound, message: 'Requested resource not found.' },
      { status: 404 },
    );
  }

  reportError(error, { area: 'peer-programming', op: 'unknown' });
  return NextResponse.json(
    { ok: false, code: PEER_PROGRAMMING_ERROR_CODE.persistenceUnavailable, message: fallbackMessage },
    { status: 503 },
  );
}
