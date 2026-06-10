import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getAppUrl } from 'lib/auth/runtime-env';
import { ensureContributionsAdmin } from 'lib/contributions/policy';
import { reportError } from 'lib/observability/report';

// Contributing is open to any signed-in member: it does not require Unlock verification and
// never alters Unlock state (deliberate owner decision, 2026-06-10 — see the feature inventory).
export async function requireContributionsUserAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'any_authenticated' });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

export async function requireContributionsAdminAccess() {
  const gate = await requireContributionsUserAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureContributionsAdmin(gate.auth);
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
    return NextResponse.json(
      { ok: false, code: 'contributions_csrf_denied', message: 'Missing CSRF confirmation header.' },
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
        { ok: false, code: 'contributions_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, code: 'contributions_csrf_denied', message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }

  return null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(candidate: string): boolean {
  return UUID_PATTERN.test(candidate);
}

const BAD_REQUEST_CODES: Record<string, string> = {
  invalid_payload: 'Invalid request payload.',
  invalid_kind: 'kind must be gift_card, quora_comment, or github_star.',
  invalid_method: 'method must be amazon, apple, or dennys.',
  invalid_amount: 'Amount must be greater than 0 and at most 500 USD.',
  invalid_url: 'URL must be a valid http(s) link.',
  invalid_cycle_window: 'ends_at must be after starts_at.',
  signal_contact_required: 'A Signal contact is required for gift-card contributions.',
  confirmed_amount_required: 'confirmedAmountUsd is required (greater than 0, at most 500 USD).',
  gift_card_code_rejected: 'Never send a gift-card code here. Codes go to the owner over Signal only.',
};

export function contributionsErrorResponse(error: unknown, fallbackMessage: string, op: string): NextResponse {
  const code = error instanceof Error ? error.message : '';

  const badRequestMessage = BAD_REQUEST_CODES[code];
  if (badRequestMessage) {
    return NextResponse.json({ ok: false, code: `contributions_${code}`, message: badRequestMessage }, { status: 400 });
  }

  if (code === 'already_reviewed') {
    return NextResponse.json(
      { ok: false, code: 'contributions_already_reviewed', message: 'This contribution was already reviewed.' },
      { status: 409 },
    );
  }

  reportError(error, { area: 'contributions', op });
  return NextResponse.json({ ok: false, code: 'contributions_unavailable', message: fallbackMessage }, { status: 503 });
}
