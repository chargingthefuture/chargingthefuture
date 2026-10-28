import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { recordWhatWorksAdminAudit } from 'lib/what-works/audit';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';

export type WhatWorksApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Reading, suggesting, and endorsing share this gate. Open to every signed-in member in 3.1
// (SOCIAL_REDESIGN_3_1_PLAN, Access: "Signed in ... What Works"); the account restriction check
// still applies.
export async function requireWhatWorksAccess(): Promise<WhatWorksApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// What an admin mutation acts on, so its outcome can be written to what_works_admin_audit_trail.
export type WhatWorksAdminAuditTarget = {
  command: string;
  targetType: string;
  targetId: string;
};

// Curating problems and moderating suggestions require an admin. A mutation passes its audit target, so
// a signed-in member who is not an admin leaves a refused row in the trail (reads pass nothing).
export async function requireWhatWorksAdminAccess(auditTarget?: WhatWorksAdminAuditTarget): Promise<WhatWorksApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  if (!decision.isAdmin) {
    if (auditTarget) {
      await recordWhatWorksAdminAudit({
        actorId: decision.userId,
        ...auditTarget,
        status: 'deny',
        reason: 'what_works_admin_only',
        result: 'failure',
        errorCategory: 'policy',
      });
    }
    return {
      allowed: false,
      response: NextResponse.json(
        { ok: false, code: 'what_works_admin_only', message: 'Admin access is required for this action.' },
        { status: 403 },
      ),
    };
  }
  return { allowed: true, auth: decision };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return whatWorksError('Missing CSRF confirmation header.', 'what_works_csrf_denied', 403);
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return whatWorksError('Invalid request origin metadata.', 'what_works_csrf_denied', 403);
  }
  if (originCheck === 'cross_origin') {
    return whatWorksError('Cross-origin mutation denied by CSRF policy.', 'what_works_csrf_denied', 403);
  }

  return null;
}

export function whatWorksError(message: string, code: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (body && typeof body === 'object') {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// The error category the Audit log panel turns into a plain reason, from a refusal's status.
function refusalCategory(status: number): string {
  if (status === 404) return 'not_found';
  if (status === 403) return 'policy';
  return 'validation';
}

async function refusalCode(response: NextResponse): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as { code?: unknown };
    return typeof body.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

// Run an admin mutation that has passed the admin gate, and record the outcomes the handler does not:
// a refusal (not found, a bad body) as a deny row, and a write that throws as a failure row, answered
// with a 503 that says what failed. A success is recorded by the handler itself, with its own metadata.
// `target` is read after the run, so a handler that only learns its command from the body can set it.
export async function runAuditedWhatWorksAdminMutation(
  actorId: string,
  target: WhatWorksAdminAuditTarget,
  run: () => Promise<NextResponse>,
): Promise<NextResponse> {
  let response: NextResponse;
  try {
    response = await run();
  } catch (error) {
    reportError(error, { area: 'what-works', op: 'admin_mutation', extra: { command: target.command } });
    await recordWhatWorksAdminAudit({
      actorId,
      ...target,
      status: 'allow',
      reason: 'persistence_error',
      result: 'failure',
      errorCategory: 'persistence_error',
      metadata: { failure: failureReason(error) },
    });
    return whatWorksError(`The change could not be saved: ${failureReason(error)}`, 'what_works_persistence_error', 503);
  }
  if (response.status >= 400) {
    await recordWhatWorksAdminAudit({
      actorId,
      ...target,
      status: 'deny',
      reason: (await refusalCode(response)) ?? refusalCategory(response.status),
      result: 'failure',
      errorCategory: refusalCategory(response.status),
    });
  }
  return response;
}
