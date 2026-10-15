import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { MUTUAL_TIME_ERROR_CODE } from 'lib/mutual-time/constants';
import { MutualTimeError } from 'lib/mutual-time/repository';
import { recordMutualTimeAdminAudit } from 'lib/mutual-time/audit';
import { resolveRequestIdentity } from 'lib/auth/request-identity';
import type { MutualTimeAuditEvent } from 'lib/mutual-time/types';

export type MutualTimeGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

export type MutualTimeAdminCommand = Exclude<MutualTimeAuditEvent['command'], 'mutual-time.vote.save'>;

// Tier (a): admin-only (create an event, close a survey). The platform owner is an admin.
// When a command is named, a refusal is written to the audit trail as a deny row, so the Audit log
// panel shows refused attempts as well as completed ones. The admin list read passes no command:
// it is a high-frequency dashboard read the audit contract does not cover.
export async function requireMutualTimeAdmin(
  command?: MutualTimeAdminCommand,
  target: MutualTimeAuditEvent['target'] = {},
): Promise<MutualTimeGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    if (command) {
      // The deny decision does not carry the caller's id; look it up separately so a signed-in
      // member who was refused is named in the row. A failed lookup records the attempt as anonymous.
      const identity = await resolveRequestIdentity().catch(() => null);
      await recordMutualTimeAdminAudit({
        pluginId: 'mutual-time',
        command,
        actorId: identity?.userId ?? 'anonymous',
        status: 'deny',
        reason: decision.reason,
        target: { ...target, route: command },
        result: 'failure',
        errorCategory: 'policy',
      });
    }
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// The error category written on a failed admin action, using the codes the Audit log panel explains.
export function mutualTimeErrorCategory(error: unknown): string {
  if (!(error instanceof MutualTimeError)) {
    return 'internal_error';
  }
  switch (error.code) {
    case MUTUAL_TIME_ERROR_CODE.notFound:
      return 'not_found';
    case MUTUAL_TIME_ERROR_CODE.notOpen:
      return 'not_open';
    case MUTUAL_TIME_ERROR_CODE.invalidPayload:
    case MUTUAL_TIME_ERROR_CODE.invalidSlot:
    case MUTUAL_TIME_ERROR_CODE.tooManyPicks:
      return 'validation';
    case MUTUAL_TIME_ERROR_CODE.persistenceUnavailable:
      return 'persistence_error';
    default:
      return 'internal_error';
  }
}

// Tier (b): a signed-in AND Unlock-approved member (cast a vote). Admins pass too.
export async function requireMutualTimeVote(): Promise<MutualTimeGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'approved_full' });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// Same-origin CSRF guard for mutations: the request must carry `x-ctf-csrf: '1'` and originate from our
// own host. Mirrors the Chyme helper. Returns a 403 response to send back, or null when it passes.
export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }
  return null;
}

// Map a caught MutualTimeError to an HTTP status + JSON; returns null for anything else (route → 500).
export function mutualTimeErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof MutualTimeError) {
    const status =
      error.code === MUTUAL_TIME_ERROR_CODE.invalidPayload || error.code === MUTUAL_TIME_ERROR_CODE.invalidSlot || error.code === MUTUAL_TIME_ERROR_CODE.tooManyPicks
        ? 400
        : error.code === MUTUAL_TIME_ERROR_CODE.notFound
          ? 404
          : error.code === MUTUAL_TIME_ERROR_CODE.notOpen
            ? 409
            : 500;
    return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
  }
  return null;
}
