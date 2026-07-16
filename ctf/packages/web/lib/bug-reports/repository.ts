// Data access for bug reports. The raw report row is the private source of truth and
// never leaves the database; only a redacted restatement is ever published to the
// triage repo (see rule 129).

import { queryDb } from 'lib/db/postgres';
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

// How many reports this user has filed inside the rolling rate-limit window. Used to
// reject accidental floods before they ever hit the table's main path.
export async function countRecentReportsByUser(userId: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM bug_reports
      WHERE user_id = $1
        AND created_at > NOW() - ($2 || ' minutes')::interval`,
    [userId, String(BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES)],
  );

  return Number(result.rows[0]?.count ?? '0');
}

// Store one report. The sanitizer runs synchronously so the redacted copy and the risk
// classification land with the row. A flagged report is born `held_for_review` and is
// never eligible for auto-publishing; a clean one is born `new`.
export async function createBugReport(
  input: CreateBugReportInput,
): Promise<CreateBugReportResult> {
  const sanitized = sanitizeBugReport(input.message, input.context);
  const status: BugReportStatus = sanitized.riskLevel === 'flagged' ? 'held_for_review' : 'new';

  const result = await queryDb<{ id: string; status: BugReportStatus }>(
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
