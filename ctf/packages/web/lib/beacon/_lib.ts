import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { pluginAuthDeny, type PluginDenyResponse } from 'lib/auth/deny-taxonomy';
import { BEACON_ERROR_CODE } from './constants';

export type BeaconApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Any signed-in member. Used by the chat-token route — posting requires an account (no anonymous
// chat), so an anonymous caller is denied here with 401.
export async function requireBeaconMemberAccess(): Promise<BeaconApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// Admin-gated. Every Beacon control (create/ingest/go-live/end/list/moderate) requires admin.
export async function requireBeaconAdminAccess(): Promise<BeaconApiGate> {
  const gate = await requireBeaconMemberAccess();
  if (!gate.allowed) {
    return gate;
  }
  if (!gate.auth.isAdmin) {
    const deny: PluginDenyResponse = pluginAuthDeny.forbiddenRole(['admin']);
    return { allowed: false, response: NextResponse.json(deny, { status: deny.status }) };
  }
  return gate;
}

export function ensureBeaconMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }
  return null;
}

export function beaconErrorResponse(message: string) {
  return NextResponse.json(
    { ok: false, code: BEACON_ERROR_CODE.persistenceUnavailable, message },
    { status: 503 },
  );
}
