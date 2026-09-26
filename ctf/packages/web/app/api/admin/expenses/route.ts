import { NextResponse } from 'next/server';
import { ensureExpensesMutationCsrf, expensesError, readJson, requireExpensesAdminAccess } from './_lib';
import { countApprovedMembers, createExpense, listExpenses } from 'lib/admin-expenses/repository';
import { parseExpenseInput } from 'lib/admin-expenses/parse';
import { recordExpensesAdminAudit } from 'lib/admin-expenses/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Every cost line, stopped and one-off included, plus the approved-member count the screen divides
// the monthly total by. The totals are worked out on the screen from these rows (lib/admin-expenses/
// summary.ts), so the figures shown and the figures copied come from one place.
export async function GET() {
  const gate = await requireExpensesAdminAccess();
  if (!gate.allowed) return gate.response;

  try {
    const [expenses, approvedMembers] = await Promise.all([listExpenses(), countApprovedMembers()]);
    return NextResponse.json({ ok: true, expenses, approvedMembers });
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'list' });
    return expensesError(`The costs could not be loaded: ${failureReason(error)}`, 'admin_expenses_unavailable', 503);
  }
}

// Add a cost line by hand. Most providers do not report billing through an API, so this is how the
// list is kept.
export async function POST(request: Request) {
  const csrf = ensureExpensesMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireExpensesAdminAccess();
  if (!gate.allowed) return gate.response;

  const read = await readJson(request);
  if (!read.ok) return expensesError(`The cost could not be read as JSON: ${read.reason}`, 'admin_expenses_invalid_payload', 400);
  const parsed = parseExpenseInput(read.body);
  if (!parsed.ok) return expensesError(parsed.message, 'admin_expenses_invalid_payload', 400);

  try {
    const expense = await createExpense(parsed.value);
    await recordExpensesAdminAudit({
      actorId: gate.auth.userId,
      command: 'admin.expenses.create',
      targetId: expense.id,
      metadata: { before: null, after: parsed.value },
    });
    return NextResponse.json({ ok: true, expense }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'create' });
    return expensesError(`The cost could not be saved: ${failureReason(error)}`, 'admin_expenses_unavailable', 503);
  }
}
