import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { getAppUrl } from 'lib/auth/runtime-env';

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

  const appUrl = getAppUrl();
  const origin = request.headers.get('origin');
  if (!appUrl || !origin) {
    return null;
  }

  try {
    if (new URL(appUrl).host !== new URL(origin).host) {
      return NextResponse.json({ ok: false, code: 'gentlepulse_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, code: 'gentlepulse_csrf_denied', message: 'Invalid request origin metadata.' }, { status: 403 });
  }

  return null;
}
