import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from '../auth/server-authz';
import { checkMutationOrigin } from '../auth/csrf';

export type GentlePulseApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

export async function requireGentlePulseReadAccess(): Promise<GentlePulseApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true, auth: decision };
}

export async function requireGentlePulseWriteAccess(): Promise<GentlePulseApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true, auth: decision };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, code: 'gentlepulse_csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json({ ok: false, code: 'gentlepulse_csrf_denied', message: 'Invalid request origin metadata.' }, { status: 403 });
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json({ ok: false, code: 'gentlepulse_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' }, { status: 403 });
  }

  return null;
}
