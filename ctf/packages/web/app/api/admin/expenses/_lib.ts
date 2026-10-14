import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';

export type ExpensesApiGate = { allowed: true; auth: AllowDecision } | { allowed: false; response: NextResponse };

// The running costs are the owner's own bills, so every expenses route, reads included, is admin-only.
export async function requireExpensesAdminAccess(): Promise<ExpensesApiGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

export function expensesError(message: string, code: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function ensureExpensesMutationCsrf(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return expensesError('Missing CSRF confirmation header.', 'admin_expenses_csrf_denied', 403);
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return expensesError('Invalid request origin metadata.', 'admin_expenses_csrf_denied', 403);
  }
  if (originCheck === 'cross_origin') {
    return expensesError('Cross-origin mutation denied by CSRF policy.', 'admin_expenses_csrf_denied', 403);
  }
  return null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isExpenseId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; reason: string }> {
  try {
    return { ok: true, body: await request.json() };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
