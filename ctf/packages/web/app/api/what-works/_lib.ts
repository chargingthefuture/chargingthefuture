import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';

export type WhatWorksApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Reading, suggesting, and endorsing share this gate. It inherits the default
// minUnlockTier 'approved_full', so it is open to fully-verified survivors (and admins) —
// not to pending or support-only members.
export async function requireWhatWorksAccess(): Promise<WhatWorksApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// Curating problems and moderating suggestions require an admin.
export async function requireWhatWorksAdminAccess(): Promise<WhatWorksApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  if (!decision.isAdmin) {
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
