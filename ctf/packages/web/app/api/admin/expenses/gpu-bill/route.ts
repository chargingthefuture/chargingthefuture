import { NextResponse } from 'next/server';
import { ensureExpensesMutationCsrf, expensesError, requireExpensesAdminAccess } from '../_lib';
import { readGpuBillNow } from 'lib/admin-expenses/gpu-bill';
import { recordExpensesAdminAudit } from 'lib/admin-expenses/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// "Read the bill now" on /admin/expenses: the same read the daily schedule makes
// (../../../internal/admin-expenses/read-gpu-bill), on demand. Today's row and any day RunPod may still
// add to are rewritten; a settled day is left as it was.
export async function POST(request: Request) {
  const csrf = ensureExpensesMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireExpensesAdminAccess();
  if (!gate.allowed) return gate.response;

  try {
    const result = await readGpuBillNow();
    await recordExpensesAdminAudit({
      actorId: gate.auth.userId,
      command: 'admin.expenses.gpu_bill.read',
      targetType: 'gpu_bill',
      targetId: result.endpointIds.join(','),
      metadata: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'read_gpu_bill_now' });
    return expensesError(`The RunPod bill could not be read: ${failureReason(error)}`, 'admin_expenses_gpu_bill_unavailable', 503);
  }
}
