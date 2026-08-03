import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from '../auth/server-authz';
import { ensureServiceCreditsAdmin } from './policy';
import { checkMutationOrigin } from '../auth/csrf';
import { pluginAuthDeny } from '../auth/deny-taxonomy';

export async function requireServiceCreditsReadAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

export async function requireServiceCreditsAdminAccess() {
  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureServiceCreditsAdmin(gate.auth);
  if (deny) {
    return { allowed: false as const, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return gate;
}

// Escrow hold/release/refund are system/service-level operations, not self-service: the access
// policy contract restricts them to the 'service', 'system', or 'dispute_moderator' roles. An admin
// always qualifies. A plain authenticated member (any other role) is denied here so they cannot
// create, release, or refund escrow holds against another member's balance.
const SERVICE_CREDITS_ESCROW_ROLES = new Set(['service', 'system', 'dispute_moderator', 'admin']);

export async function requireServiceCreditsServiceAccess() {
  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const role = gate.auth.role;
  if (!gate.auth.isAdmin && (!role || !SERVICE_CREDITS_ESCROW_ROLES.has(role))) {
    const deny = pluginAuthDeny.forbiddenRole(['service', 'system', 'dispute_moderator']);
    return { allowed: false as const, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return gate;
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, code: 'service_credits_csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json({ ok: false, code: 'service_credits_csrf_denied', message: 'Invalid request origin metadata.' }, { status: 403 });
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json({ ok: false, code: 'service_credits_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' }, { status: 403 });
  }

  return null;
}

// Map of domain error message → user-safe response. Keeps serviceCreditsErrorResponse a simple lookup.
const SERVICE_CREDITS_ERROR_RESPONSES: Record<string, { code: string; message: string; status: number }> = {
  insufficient_balance: { code: 'service_credits_insufficient_balance', message: 'Insufficient balance.', status: 409 },
  invalid_payload: { code: 'service_credits_invalid_payload', message: 'Invalid request payload.', status: 400 },
  credit_limit_exceeded: { code: 'service_credits_credit_limit_exceeded', message: 'This send would exceed your mutual-credit limit.', status: 409 },
  mutual_credit_disabled: { code: 'service_credits_mutual_credit_disabled', message: 'Mutual credit is not enabled.', status: 409 },
  mint_budget_exceeded: { code: 'service_credits_mint_budget_exceeded', message: 'This mint would exceed the issuance budget for the current period.', status: 409 },
  credit_limit_above_max: { code: 'service_credits_credit_limit_above_max', message: 'That credit limit is above the maximum allowed by policy.', status: 409 },
  wallet_frozen: { code: 'service_credits_wallet_frozen', message: 'This wallet is frozen and cannot spend.', status: 403 },
  account_restricted: { code: 'service_credits_account_restricted', message: 'This account is restricted and cannot spend.', status: 403 },
  // Account-deletion reclaim "not yet" states — distinct from a real failure so the reclaim sweep can
  // skip them quietly and retry on the next run instead of treating every pre-window run as an error.
  reclaim_window_not_elapsed: { code: 'service_credits_reclaim_window_not_elapsed', message: 'The deletion reclaim grace window (7 days) has not elapsed yet.', status: 409 },
  active_escrow_holds: { code: 'service_credits_active_escrow_holds', message: 'The account has active escrow holds; the reclaim is deferred until they clear.', status: 409 },
};

export function serviceCreditsErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  const mapped = error instanceof Error ? SERVICE_CREDITS_ERROR_RESPONSES[error.message] : undefined;
  if (mapped) {
    return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json({ ok: false, code: 'service_credits_error', message: fallbackMessage }, { status: 500 });
}
