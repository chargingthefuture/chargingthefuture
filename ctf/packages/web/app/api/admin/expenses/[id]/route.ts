import { NextResponse } from 'next/server';
import { ensureExpensesMutationCsrf, expensesError, isExpenseId, readJson, requireExpensesAdminAccess } from '../_lib';
import { deleteExpense, getExpense, updateExpense } from 'lib/admin-expenses/repository';
import { parseExpenseInput } from 'lib/admin-expenses/parse';
import { recordExpensesAdminAudit } from 'lib/admin-expenses/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteContext = { params: Promise<{ id: string }> };

// The row as the audit trail stores it: the fields a person edits, without the timestamps.
function editable(expense: NonNullable<Awaited<ReturnType<typeof getExpense>>>) {
  return {
    provider: expense.provider,
    purpose: expense.purpose,
    kind: expense.kind,
    billing: expense.billing,
    amountCents: expense.amountCents,
    amountMaxCents: expense.amountMaxCents,
    paidOn: expense.paidOn,
    lastCheckedOn: expense.lastCheckedOn,
    stoppedOn: expense.stoppedOn,
    notes: expense.notes,
  };
}

// Edit a cost line: a new amount, a check date, a stop date. The entire row is sent back.
export async function PATCH(request: Request, context: RouteContext) {
  const csrf = ensureExpensesMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireExpensesAdminAccess();
  if (!gate.allowed) return gate.response;

  const { id } = await context.params;
  if (!isExpenseId(id)) return expensesError('That cost line could not be found.', 'admin_expenses_not_found', 404);

  const read = await readJson(request);
  if (!read.ok) return expensesError(`The cost could not be read as JSON: ${read.reason}`, 'admin_expenses_invalid_payload', 400);
  const parsed = parseExpenseInput(read.body);
  if (!parsed.ok) return expensesError(parsed.message, 'admin_expenses_invalid_payload', 400);

  try {
    const before = await getExpense(id);
    if (!before) return expensesError('That cost line could not be found.', 'admin_expenses_not_found', 404);
    const expense = await updateExpense(id, parsed.value);
    if (!expense) return expensesError('That cost line was removed while it was being edited.', 'admin_expenses_not_found', 404);
    await recordExpensesAdminAudit({
      actorId: gate.auth.userId,
      command: 'admin.expenses.update',
      targetId: id,
      metadata: { before: editable(before), after: editable(expense) },
    });
    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'update' });
    return expensesError(`The change could not be saved: ${failureReason(error)}`, 'admin_expenses_unavailable', 503);
  }
}

// Remove a line entered by mistake. A cost that was canceled is marked stopped instead, so the cut
// stays on the record.
export async function DELETE(request: Request, context: RouteContext) {
  const csrf = ensureExpensesMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireExpensesAdminAccess();
  if (!gate.allowed) return gate.response;

  const { id } = await context.params;
  if (!isExpenseId(id)) return expensesError('That cost line could not be found.', 'admin_expenses_not_found', 404);

  try {
    const before = await getExpense(id);
    if (!before) return expensesError('That cost line could not be found.', 'admin_expenses_not_found', 404);
    await deleteExpense(id);
    await recordExpensesAdminAudit({
      actorId: gate.auth.userId,
      command: 'admin.expenses.delete',
      targetId: id,
      metadata: { before: editable(before), after: null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'delete' });
    return expensesError(`The cost line could not be removed: ${failureReason(error)}`, 'admin_expenses_unavailable', 503);
  }
}
