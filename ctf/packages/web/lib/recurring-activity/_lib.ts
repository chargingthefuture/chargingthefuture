import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from '../auth/server-authz';
import { checkMutationOrigin } from '../auth/csrf';
import { RECURRING_ACTIVITY_ERROR_CODE } from './constants';

export type RecurringActivityApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Any authenticated, unlocked member may use the Recurring Activity routes.
export async function requireRecurringActivityAccess(): Promise<RecurringActivityApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// Reject cross-site mutations: every state-changing request must carry the same-origin CSRF header
// the web client sets, and (when an Origin is present) match the app's host.
export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: RECURRING_ACTIVITY_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: RECURRING_ACTIVITY_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: RECURRING_ACTIVITY_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }
  return null;
}

// Map a repository mutation failure (`not_found` | `forbidden` | `conflict`) to the matching HTTP
// status + stable error code. Shared by the confirm/decline/end/visibility routes.
const MUTATION_STATUS = { not_found: 404, forbidden: 403, conflict: 409 } as const;
const MUTATION_CODE = {
  not_found: RECURRING_ACTIVITY_ERROR_CODE.notFound,
  forbidden: RECURRING_ACTIVITY_ERROR_CODE.forbidden,
  conflict: RECURRING_ACTIVITY_ERROR_CODE.conflict,
} as const;

export function recurringActivityMutationError(
  code: 'not_found' | 'forbidden' | 'conflict',
  message: string,
): NextResponse {
  return NextResponse.json(
    { ok: false, code: MUTATION_CODE[code], message },
    { status: MUTATION_STATUS[code] },
  );
}

// `recurring_activities.id` is a UUID column. A path value that is not a UUID cannot name a row, and
// passing it to Postgres would throw (invalid input syntax for type uuid) and surface as a 503. The
// confirm/decline/end/visibility routes answer it with the same 404 the repository gives for an id
// that names no row.
const ACTIVITY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecurringActivityId(value: string | undefined): value is string {
  return typeof value === 'string' && ACTIVITY_ID_PATTERN.test(value);
}

export function recurringActivityErrorResponse(fallbackMessage: string) {
  return NextResponse.json(
    { ok: false, code: RECURRING_ACTIVITY_ERROR_CODE.persistenceUnavailable, message: fallbackMessage },
    { status: 503 },
  );
}

// A per-request correlation id for audit rows. Prefer the inbound trace header; fall back to a fresh
// UUID so every audit entry is correlatable even without an upstream id.
export function resolveRequestId(request: Request): string {
  return (
    request.headers.get('x-request-id') ??
    request.headers.get('x-ctf-request-id') ??
    crypto.randomUUID()
  );
}

// A distributed-trace id for audit rows, distinct from the request id. Prefer the inbound trace
// header; fall back to a fresh UUID so every audit entry carries a trace id the contract requires.
export function resolveTraceId(request: Request): string {
  return (
    request.headers.get('x-trace-id') ??
    request.headers.get('x-ctf-trace-id') ??
    crypto.randomUUID()
  );
}
