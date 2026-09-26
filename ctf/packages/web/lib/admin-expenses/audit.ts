import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';

// The durable record of every add, edit and removal on /admin/expenses (rule 131). The metadata
// carries the row before and after, so "Railway went from $18 to $25" can be read back later.

export type ExpensesAuditEvent = {
  actorId: string;
  command: 'admin.expenses.create' | 'admin.expenses.update' | 'admin.expenses.delete';
  targetId: string;
  metadata: Record<string, unknown>;
};

// Never throws. The change it records has already been saved, and turning a saved edit into an
// error would have the owner enter it twice. A failed write is reported instead.
export async function recordExpensesAdminAudit(event: ExpensesAuditEvent): Promise<void> {
  try {
    await queryDb(
      `
        INSERT INTO admin_expenses_audit_trail
          (actor_id, command, policy_status, reason, target_type, target_id, result, error_category, metadata)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [event.actorId, event.command, 'allow', 'admin_route_guard', 'expense', event.targetId, 'success', null, JSON.stringify(event.metadata)],
    );
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'admin_audit_write' });
  }
}

export type ExpensesAuditRow = {
  id: string;
  actor_id: string;
  command: string;
  target_id: string;
  result: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listExpensesAdminAuditEvents(limit = 100): Promise<ExpensesAuditRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const result = await queryDb<ExpensesAuditRow>(
    `
      SELECT id, actor_id, command, target_id, result, metadata, created_at
      FROM admin_expenses_audit_trail
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );
  return result.rows;
}
