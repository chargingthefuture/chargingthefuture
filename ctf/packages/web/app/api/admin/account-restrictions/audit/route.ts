import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { listAccountRestrictionAudit } from 'lib/auth/account-restrictions';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Admin-only: the recent restrict/unrestrict audit trail.
export async function GET() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  try {
    const entries = await listAccountRestrictionAudit(100);
    return NextResponse.json({ ok: true, entries }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'account-restrictions', op: 'audit' });
    return NextResponse.json({ ok: false, code: 'account_restrictions_error', message: `Could not load the audit trail: ${failureReason(error)}` }, { status: 500 });
  }
}
