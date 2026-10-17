import { queryDb } from 'lib/db/postgres';

// Whether an operator cleared this account from the demo schema recently (issue #2893). The operator
// delete route runs a demo deletion and then deletes the Clerk user, which fires this webhook; the
// event says nothing about the schema or who started it. Without this the production deletion that
// follows was recorded as a member leaving and counted in the deleted-accounts figure. It still runs,
// so any production data the same sign-in had is cleared, but it is recorded as operator-run. The
// window covers Clerk's retries of a delivery; a demo schema that does not exist reads as no.
const OPERATOR_DEMO_DELETION_WINDOW_HOURS = 72;

export async function operatorClearedDemoAccount(userId: string): Promise<boolean> {
  // Checked first and on its own: a query naming a table that does not exist fails before it runs.
  const demo = await queryDb<{ found: boolean }>(
    "SELECT to_regclass('demo.account_deletion_events') IS NOT NULL AS found",
  );
  if (!demo.rows[0]?.found) return false;
  const result = await queryDb<{ one: number }>(
    `SELECT 1 AS one FROM demo.account_deletion_events
      WHERE user_id = $1
        AND scope = 'account'
        AND summary->>'initiatedBy' = 'operator'
        AND completed_at > NOW() - make_interval(hours => $2)
      LIMIT 1`,
    [userId, OPERATOR_DEMO_DELETION_WINDOW_HOURS],
  );
  return result.rows.length > 0;
}
