import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { getAppUrl } from 'lib/auth/runtime-env';

export type WhatWorksApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Reading is open to any authenticated survivor; suggesting and endorsing share this gate.
export async function requireWhatWorksAccess(): Promise<WhatWorksApiGate> {
  const decision = await evaluatePluginAccess({ requireApprovedUserOrAdmin: false, requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// Curating problems and moderating suggestions require an admin.
export async function requireWhatWorksAdminAccess(): Promise<WhatWorksApiGate> {
  const decision = await evaluatePluginAccess({ requireApprovedUserOrAdmin: false, requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  if (!decision.isAdmin) {
    return {
      allowed: false,
      response: NextResponse.json(
        { ok: false, code: 'whatworks_admin_only', message: 'Admin access is required for this action.' },
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
    return whatworksError('Missing CSRF confirmation header.', 'whatworks_csrf_denied', 403);
  }

  const appUrl = getAppUrl();
  const origin = request.headers.get('origin');
  if (!appUrl || !origin) {
    return null;
  }

  try {
    if (new URL(appUrl).host !== new URL(origin).host) {
      return whatworksError('Cross-origin mutation denied by CSRF policy.', 'whatworks_csrf_denied', 403);
    }
  } catch {
    return whatworksError('Invalid request origin metadata.', 'whatworks_csrf_denied', 403);
  }

  return null;
}

export function whatworksError(message: string, code: string, status: number): NextResponse {
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
