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
