import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getAppUrl } from 'lib/auth/runtime-env';
import { ensureWeeklyPerformanceAdmin } from 'lib/weekly-performance/policy';

export async function requireWeeklyPerformanceReadAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

export async function requireWeeklyPerformanceAdminAccess() {
  const gate = await requireWeeklyPerformanceReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureWeeklyPerformanceAdmin(gate.auth);
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
    return NextResponse.json({ ok: false, code: 'weekly_performance_csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }

  const appUrl = getAppUrl();
  const origin = request.headers.get('origin');
  if (!appUrl || !origin) {
    return null;
  }

  try {
    if (new URL(appUrl).host !== new URL(origin).host) {
      return NextResponse.json({ ok: false, code: 'weekly_performance_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, code: 'weekly_performance_csrf_denied', message: 'Invalid request origin metadata.' }, { status: 403 });
  }

  return null;
}
