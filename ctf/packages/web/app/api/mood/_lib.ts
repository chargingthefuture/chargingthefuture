import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { MOOD_ERROR_CODE } from 'lib/mood/constants';
import { reportError } from 'lib/observability/report';

export async function requireMoodAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: MOOD_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: MOOD_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: MOOD_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}

export function moodErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  const code = error instanceof Error ? error.message : '';

  if (code === 'invalid_payload') {
    return NextResponse.json({ ok: false, code: MOOD_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 });
  }

  if (code === 'cooldown_active') {
    return NextResponse.json({ ok: false, code: MOOD_ERROR_CODE.cooldownActive, message: 'Mood submission cooldown is active.' }, { status: 409 });
  }

  reportError(error, { area: 'mood', op: 'unknown' });
  return NextResponse.json({ ok: false, code: MOOD_ERROR_CODE.persistenceUnavailable, message: fallbackMessage }, { status: 503 });
}
