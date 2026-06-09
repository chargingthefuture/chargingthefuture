import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from '../auth/server-authz';
import { getAppUrl } from '../auth/runtime-env';
import { MOOD_ERROR_CODE } from './constants';

export async function requireMoodAccess() {
  const decision = await evaluatePluginAccess({ requireApprovedUserOrAdmin: true, requireUsername: false });
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

  const appUrl = getAppUrl();
  const origin = request.headers.get('origin');
  if (!appUrl || !origin) {
    return null;
  }

  try {
    if (new URL(appUrl).host !== new URL(origin).host) {
      return NextResponse.json(
        { ok: false, code: MOOD_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, code: MOOD_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  return null;
}

export function moodErrorResponse(error: unknown, fallbackMessage: string) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'eligibility_not_found') {
    return NextResponse.json(
      { ok: false, code: MOOD_ERROR_CODE.eligibilityNotFound, message: 'Eligibility not found.' },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { ok: false, code: MOOD_ERROR_CODE.unknown, message: fallbackMessage },
    { status: 500 },
  );
}
