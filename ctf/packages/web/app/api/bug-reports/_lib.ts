import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { BUG_REPORT_ERROR_CODE } from 'lib/bug-reports/constants';

export type BugReportApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Any signed-in user may file a report — including a not-yet-verified member, who is
// often exactly the person hitting a problem during onboarding. Mirrors the unlock /
// account routes' `any_authenticated` tier.
export async function requireReporterAccess(): Promise<BugReportApiGate> {
  const decision = await evaluatePluginAccess({ minUnlockTier: 'any_authenticated' });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return { allowed: true, auth: decision };
}

// The admin review surface (/admin/bug-reports and its API) is restricted to admins. Every
// admin route gates on this regardless of what the nav shows (see rule 131).
export async function requireBugReportAdminAccess(): Promise<BugReportApiGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return { allowed: true, auth: decision };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}
