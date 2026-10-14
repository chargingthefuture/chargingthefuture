import { NextResponse } from 'next/server';
import { expensesError, requireExpensesAdminAccess } from '../_lib';
import { listExpensesAdminAuditEvents } from 'lib/admin-expenses/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The Audit log tab on /admin/expenses: every add, edit and removal, newest first.
export async function GET(request: Request) {
  const gate = await requireExpensesAdminAccess();
  if (!gate.allowed) return gate.response;

  const limitRaw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

  try {
    const events = await listExpensesAdminAuditEvents(limit);
    return NextResponse.json({ ok: true, events });
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'audit_events' });
    return expensesError(`The audit log could not be loaded: ${failureReason(error)}`, 'admin_expenses_unavailable', 503);
  }
}
