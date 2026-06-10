import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { getAppUrl } from 'lib/auth/runtime-env';
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

  const appUrl = getAppUrl();
  const origin = request.headers.get('origin');
  if (!appUrl || !origin) {
    return null;
  }

  let appHost = '';
  let originHost = '';
  try {
    appHost = new URL(appUrl).host;
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }

  if (appHost !== originHost) {
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}
