import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from '../auth/server-authz';
import { checkMutationOrigin } from '../auth/csrf';
import { ensureLevelUpAdmin } from './policy';
import { reportError } from '../observability/report';

export async function requireLevelUpReadAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

export async function requireLevelUpAdminAccess() {
  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureLevelUpAdmin(gate.auth);
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
    return NextResponse.json({ ok: false, code: 'level_up_csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json({ ok: false, code: 'level_up_csrf_denied', message: 'Invalid request origin metadata.' }, { status: 403 });
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json({ ok: false, code: 'level_up_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' }, { status: 403 });
  }

  return null;
}

// Maps a known LevelUp error message to its response shape. `report` marks the
// cases that also send the error to observability before responding.
const LEVEL_UP_ERROR_MAP: Record<string, { code: string; message: string; status: number; report?: boolean }> = {
  insufficient_balance: { code: 'level_up_insufficient_balance', message: 'Insufficient balance.', status: 409 },
  invalid_payload: { code: 'level_up_invalid_payload', message: 'Invalid LevelUp payload.', status: 400 },
  forbidden: { code: 'level_up_forbidden', message: 'You do not have access to this resource.', status: 403 },
  not_found: { code: 'level_up_not_found', message: 'Requested resource was not found.', status: 404 },
  invalid_state: { code: 'level_up_invalid_state', message: 'Resource is not in a valid state for this command.', status: 409 },
  rate_limit_exceeded: { code: 'level_up_rate_limit_exceeded', message: 'Command rate limit exceeded.', status: 429 },
  external_ledger_not_configured: { code: 'level_up_external_ledger_not_configured', message: 'External ledger is not configured.', status: 503, report: true },
  external_ledger_unavailable: { code: 'level_up_external_ledger_unavailable', message: 'External ledger rejected or failed the command.', status: 503, report: true },
};

export function levelUpErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  const mapped = error instanceof Error ? LEVEL_UP_ERROR_MAP[error.message] : undefined;
  if (mapped) {
    if (mapped.report) {
      reportError(error, { area: 'level-up', op: 'unknown' });
    }
    return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: mapped.status });
  }

  reportError(error, { area: 'level-up', op: 'unknown' });
  return NextResponse.json({ ok: false, code: 'level_up_unavailable', message: fallbackMessage }, { status: 503 });
}
