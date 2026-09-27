import { NextResponse } from 'next/server';
import { ensureExpensesMutationCsrf, expensesError, readJson, requireExpensesAdminAccess } from './_lib';
import { countApprovedMembers, createExpense, listExpenses } from 'lib/admin-expenses/repository';
import { parseExpenseInput } from 'lib/admin-expenses/parse';
import { recordExpensesAdminAudit } from 'lib/admin-expenses/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { getCurrentCycleMoneyRaised } from 'lib/contributions/repository';
import type { DriveProgress } from 'lib/admin-expenses/fundraising';

// The open Contributions drive, for the suggested money goal. Kept apart from the costs: if it
// cannot be read the screen still shows every cost, and says why the suggestion is missing.
async function readDrive(): Promise<{ drive: DriveProgress | null; driveError: string | null }> {
  try {
    const { cycle, fiatConfirmedUsd } = await getCurrentCycleMoneyRaised();
    const drive = cycle
      ? { startsAt: cycle.startsAt, endsAt: cycle.endsAt, moneyGoalUsd: cycle.fiatGoalUsd, moneyConfirmedUsd: fiatConfirmedUsd }
      : null;
    return { drive, driveError: null };
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'read_drive' });
    return { drive: null, driveError: `The Contributions drive could not be read: ${failureReason(error)}` };
  }
}

// Every cost line, stopped and one-off included, the approved-member count the screen divides the
// monthly total by, and the open Contributions drive the suggested money goal is worked out for.
// The totals are worked out on the screen from these rows (lib/admin-expenses/summary.ts and
// fundraising.ts), so the figures shown and the figures copied come from one place.
export async function GET() {
  const gate = await requireExpensesAdminAccess();
  if (!gate.allowed) return gate.response;

  try {
    const [expenses, approvedMembers, drive] = await Promise.all([listExpenses(), countApprovedMembers(), readDrive()]);
    return NextResponse.json({ ok: true, expenses, approvedMembers, ...drive });
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
