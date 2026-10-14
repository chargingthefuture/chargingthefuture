// Data access for bug reports. The raw report row is the private source of truth and
// never leaves the database; only a redacted restatement is ever published to the
// triage repo (see rule 129).

import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { sanitizeBugReport, type BugReportRiskFlag } from 'lib/bug-reports/sanitize';
import {
  BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES,
  type BugReportRiskLevel,
  type BugReportStatus,
} from 'lib/bug-reports/constants';

export type CreateBugReportInput = {
  userId: string;
  message: string;
  context: string | null;
  pageUrl: string | null;
  pluginSlug: string | null;
  appVersion: string | null;
  userAgent: string | null;
};

export type BugReportRow = {
  id: string;
  user_id: string;
  status: BugReportStatus;
  raw_message: string;
  raw_context: string | null;
  page_url: string | null;
  plugin_slug: string | null;
  app_version: string | null;
  user_agent: string | null;
  redacted_message: string | null;
  redacted_context: string | null;
  risk_flags: BugReportRiskFlag[];
  risk_level: BugReportRiskLevel;
  triage_repo: string | null;
  issue_number: number | null;
  issue_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateBugReportResult = {
  id: string;
  status: BugReportStatus;
  riskLevel: BugReportRiskLevel;
};

// Store one report, unless the member already filed `limit` reports inside the rolling
// rate-limit window; then nothing is stored and null comes back. The count and the insert run
// in one transaction under a per-member advisory lock, so several reports sent at the same
// moment are counted one after another instead of all reading the same count.
//
// The sanitizer runs synchronously so the redacted copy and the risk classification land with
// the row. A flagged report is born `held_for_review` and is never eligible for
// auto-publishing; a clean one is born `new`.
export async function createBugReportWithinRateLimit(
  input: CreateBugReportInput,
  limit: number,
): Promise<CreateBugReportResult | null> {
  return withDbTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('bug_reports:' || $1))`, [input.userId]);
    const recent = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM bug_reports
        WHERE user_id = $1
          AND created_at > NOW() - ($2 || ' minutes')::interval`,
      [input.userId, String(BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES)],
    );
    if (Number(recent.rows[0]?.count ?? '0') >= limit) {
      return null;
    }
    return insertBugReport(client, input);
  });
}

async function insertBugReport(
  client: PoolClient,
  input: CreateBugReportInput,
): Promise<CreateBugReportResult> {
  const sanitized = sanitizeBugReport(input.message, input.context);
  const status: BugReportStatus = sanitized.riskLevel === 'flagged' ? 'held_for_review' : 'new';

  const result = await client.query<{ id: string; status: BugReportStatus }>(
    `INSERT INTO bug_reports (
       user_id, status, raw_message, raw_context, page_url, plugin_slug,
       app_version, user_agent, redacted_message, redacted_context,
       risk_flags, risk_level
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, status`,
    [
      input.userId,
      status,
      input.message,
      input.context,
      input.pageUrl,
      input.pluginSlug,
      input.appVersion,
      input.userAgent,
      sanitized.redactedMessage,
      sanitized.redactedContext,
      sanitized.riskFlags,
      sanitized.riskLevel,
    ],
  );

  const row = result.rows[0];
  return { id: row.id, status: row.status, riskLevel: sanitized.riskLevel };
}

// Reports eligible for issue creation: clean and not yet published. Used by the
// create-issues job (which runs outside the app, against the private triage repo).
export async function listReportsReadyForIssue(limit: number): Promise<BugReportRow[]> {
  const result = await queryDb<BugReportRow>(
    `SELECT *
       FROM bug_reports
      WHERE status = 'new'
      ORDER BY created_at ASC
      LIMIT $1`,
    [limit],
  );

  return result.rows;
}

// What an admin sees for one report. Deliberately omits raw_message / raw_context: the
// raw user text never leaves the database (rule 129), so even the admin review surface
// shows only the redacted copy plus the risk flags that explain why a report was held.
export type BugReportAdminRow = {
  id: string;
  status: BugReportStatus;
  user_id: string;
  reporter_username: string | null;
  redacted_message: string | null;
  redacted_context: string | null;
  risk_flags: BugReportRiskFlag[];
  risk_level: BugReportRiskLevel;
  page_url: string | null;
  plugin_slug: string | null;
  app_version: string | null;
  triage_repo: string | null;
  issue_number: number | null;
  issue_url: string | null;
  created_at: string;
  updated_at: string;
};

// Admin list of reports for the /admin/bug-reports review page. Held reports surface
// first (they are the ones waiting on a human), then the rest, newest within each group.
// Redacted fields only — never the raw text. The reporter's identity (user_id + username)
// is included so an admin can follow up with the member — ADMIN surface only; it is never
// added to the triage-repo issue (rule 129). The username comes from the legacy
// `public.users` table (a v2-prod clone); a fresh database may not have that table, so
// probe first (same pattern as lib/engagement/login-activity.ts) and fall back to a null
// username — the display handle still resolves to a stable per-user pseudonym.
export async function listReportsForAdmin(limit = 200): Promise<BugReportAdminRow[]> {
  const usersTable = await queryDb<{ reg: string | null }>(
    `SELECT to_regclass('public.users')::text AS reg`,
  );
  const hasUsersTable = usersTable.rows[0]?.reg != null;

  const result = await queryDb<BugReportAdminRow>(
    hasUsersTable
      ? `SELECT b.id, b.status, b.user_id, u.username AS reporter_username,
                b.redacted_message, b.redacted_context, b.risk_flags, b.risk_level,
                b.page_url, b.plugin_slug, b.app_version, b.triage_repo, b.issue_number,
                b.issue_url, b.created_at, b.updated_at
           FROM bug_reports b
           LEFT JOIN users u ON u.id::text = b.user_id
          ORDER BY (b.status = 'held_for_review') DESC, b.created_at DESC
          LIMIT $1`
      : `SELECT id, status, user_id, NULL::text AS reporter_username,
                redacted_message, redacted_context, risk_flags, risk_level,
                page_url, plugin_slug, app_version, triage_repo, issue_number,
                issue_url, created_at, updated_at
           FROM bug_reports
          ORDER BY (status = 'held_for_review') DESC, created_at DESC
          LIMIT $1`,
    [limit],
  );

  return result.rows;
}

// Release a held report back into the `new` state so the create-issues job picks it up on
// its next run and publishes the redacted copy to the triage repo. Only a held report can
// be released; the guard keeps a double-click from disturbing an already-published row.
// Returns true when a row actually changed.
export async function releaseHeldReport(id: string): Promise<boolean> {
  const result = await queryDb(
    `UPDATE bug_reports
        SET status = 'new', updated_at = NOW()
      WHERE id = $1 AND status = 'held_for_review'`,
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}

// Reject a report so it never reaches the triage repo. Allowed from `held_for_review` or
// `new` (a clean report an admin decides not to forward). Returns true when a row changed.
export async function rejectReport(id: string): Promise<boolean> {
  const result = await queryDb(
    `UPDATE bug_reports
        SET status = 'rejected', updated_at = NOW()
      WHERE id = $1 AND status IN ('held_for_review', 'new')`,
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}

// Mark a report as published into the triage repo.
export async function markReportIssueCreated(
  id: string,
  triageRepo: string,
  issueNumber: number,
  issueUrl: string,
): Promise<void> {
  await queryDb(
    `UPDATE bug_reports
        SET status = 'issue_created',
            triage_repo = $2,
            issue_number = $3,
            issue_url = $4,
            updated_at = NOW()
      WHERE id = $1`,
    [id, triageRepo, issueNumber, issueUrl],
  );
}

// Account deletion: replace each of the member's raw report texts with its redacted copy, inside
// the deletion transaction and before the registry's pseudonymize step overwrites `user_id` (after
// that the rows can no longer be found by the member's id). `raw_message` is NOT NULL, so the
// registry's clear-columns (which write NULL) cannot reach it; an unredacted report keeps an empty
// string. Nothing in the app shows raw text to an admin, so triage loses nothing.
export async function redactRawBugReportTextForDeletion(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `UPDATE bug_reports
        SET raw_message = COALESCE(redacted_message, ''),
            updated_at = NOW()
      WHERE user_id = $1`,
    [userId],
  );
}
