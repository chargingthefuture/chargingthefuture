import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { getAppUrl } from 'lib/auth/runtime-env';
import { ensureLighthouseAdmin } from 'lib/lighthouse/policy';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';

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

  const appUrl = getAppUrl();
  const origin = request.headers.get('origin');
  if (!appUrl || !origin) {
    return null;
  }

  let appHost = '';
  let originHost = '';
  try {
    appHost = new URL(appUrl).host;
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }

  if (appHost !== originHost) {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}
