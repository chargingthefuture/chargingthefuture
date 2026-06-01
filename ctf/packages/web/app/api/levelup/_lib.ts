import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getAppUrl } from 'lib/auth/runtime-env';
import { ensureLevelupAdmin } from 'lib/levelup/policy';
import { reportError } from 'lib/observability/report';

export async function requireLevelupReadAccess() {
  const decision = await evaluatePluginAccess({ requireApprovedUserOrAdmin: true, requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

export async function requireLevelupAdminAccess() {
  const gate = await requireLevelupReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureLevelupAdmin(gate.auth);
  if (deny) {
    return { allowed: false as const, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return gate;
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, code: 'levelup_csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }

  const appUrl = getAppUrl();
  const origin = request.headers.get('origin');
  if (!appUrl || !origin) {
    return null;
  }

  try {
    if (new URL(appUrl).host !== new URL(origin).host) {
      return NextResponse.json({ ok: false, code: 'levelup_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, code: 'levelup_csrf_denied', message: 'Invalid request origin metadata.' }, { status: 403 });
  }

  return null;
}

export function levelupErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof Error && error.message === 'insufficient_balance') {
    return NextResponse.json({ ok: false, code: 'levelup_insufficient_balance', message: 'Insufficient balance.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'invalid_payload') {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_payload', message: 'Invalid LevelUp payload.' }, { status: 400 });
  }

  if (error instanceof Error && error.message === 'not_found') {
    return NextResponse.json({ ok: false, code: 'levelup_not_found', message: 'Requested resource was not found.' }, { status: 404 });
  }

  if (error instanceof Error && error.message === 'invalid_state') {
    return NextResponse.json({ ok: false, code: 'levelup_invalid_state', message: 'Resource is not in a valid state for this command.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'rate_limit_exceeded') {
    return NextResponse.json({ ok: false, code: 'levelup_rate_limit_exceeded', message: 'Command rate limit exceeded.' }, { status: 429 });
  }

  if (error instanceof Error && error.message === 'external_ledger_not_configured') {
    reportError(error, { area: 'levelup', op: 'unknown' });
    return NextResponse.json({ ok: false, code: 'levelup_external_ledger_not_configured', message: 'External ledger is not configured.' }, { status: 503 });
  }

  if (error instanceof Error && error.message === 'external_ledger_unavailable') {
    reportError(error, { area: 'levelup', op: 'unknown' });
    return NextResponse.json({ ok: false, code: 'levelup_external_ledger_unavailable', message: 'External ledger rejected or failed the command.' }, { status: 503 });
  }

  reportError(error, { area: 'levelup', op: 'unknown' });
  return NextResponse.json({ ok: false, code: 'levelup_unavailable', message: fallbackMessage }, { status: 503 });
}
