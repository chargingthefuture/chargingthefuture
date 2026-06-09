import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from '../auth/server-authz';
import { ensureLighthouseAdmin } from './policy';
import { LIGHTHOUSE_ERROR_CODE } from './constants';

export type LighthouseApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

export async function requireLighthouseReadAccess(): Promise<LighthouseApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return {
    allowed: true,
    auth: decision,
  };
}

export async function requireLighthouseAdminAccess(): Promise<LighthouseApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  const deny = ensureLighthouseAdmin(decision);
  if (deny) {
    return {
      allowed: false,
      response: NextResponse.json(deny, { status: deny.status }),
    };
  }

  return {
    allowed: true,
    auth: decision,
  };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  return null;
}
