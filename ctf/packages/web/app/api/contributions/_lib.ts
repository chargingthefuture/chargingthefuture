import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { ensureContributionsAdmin } from 'lib/contributions/policy';
import { insertContributionsAudit } from 'lib/contributions/repository';
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

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: 'contributions_csrf_denied', message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: 'contributions_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Write an audit row without ever turning an audit-only failure into a request failure. The
 * primary mutation has already succeeded (and any credit grant went through the idempotent
 * transactional mintGrant), so audit logging here is observability — a failed insert is reported
 * and swallowed, never propagated. Retrying the request must not be required to "fix" the audit
 * gap, because a retry could create a duplicate submission.
 */
export async function auditBestEffort(
  op: string,
  input: Parameters<typeof insertContributionsAudit>[0],
): Promise<void> {
  try {
    await insertContributionsAudit(input);
  } catch (err) {
    reportError(err, { area: 'contributions', op });
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A fresh response per call — a NextResponse body is a single-use stream, so this must not be
// a shared singleton.
function invalidPayloadResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, code: 'contributions_invalid_payload', message: 'Invalid JSON payload.' },
    { status: 400 },
  );
}

/**
 * Parse a mutation request body and guarantee it is a plain JSON object. Returns a 400
 * `contributions_invalid_payload` response when the body is missing, not valid JSON, or parses
 * to null, an array, or a primitive — so callers never read properties off a non-object.
 */
export async function parseJsonObject(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return { ok: false, response: invalidPayloadResponse() };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, response: invalidPayloadResponse() };
  }

  return { ok: true, body: parsed };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(candidate: string): boolean {
  return UUID_PATTERN.test(candidate);
}

const BAD_REQUEST_CODES: Record<string, string> = {
  invalid_payload: 'Invalid request payload.',
  invalid_kind: 'kind must be gift_card, quora_comment, or github_star.',
  invalid_method: 'method must be amazon, apple, or dennys.',
  invalid_amount: 'Amount must be a whole number of US dollars, from 1 to 500 — no cents.',
  invalid_url: 'URL must be a valid http(s) link.',
  invalid_cycle_window: 'ends_at must be after starts_at.',
  signal_contact_required: 'A Signal contact is required for gift-card contributions.',
  confirmed_amount_required: 'confirmedAmountUsd is required, as a whole number of US dollars from 1 to 500.',
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

  if (code === 'github_star_already_credited') {
    return NextResponse.json(
      {
        ok: false,
        code: 'contributions_github_star_already_credited',
        message: "You've already received credits for starring the repository — thank you.",
      },
      { status: 409 },
    );
  }

  reportError(error, { area: 'contributions', op });
  return NextResponse.json({ ok: false, code: 'contributions_unavailable', message: fallbackMessage }, { status: 503 });
}
