#!/usr/bin/env node
// Mark a bug report resolved once its triage issue is closed as completed (owner decision,
// 2026-10-16; issue #2693).
//
// `resolved` was in the status list, the admin screen and the Android client, and the admin
// landing dot leaves resolved reports out, but nothing ever set it. So a report whose fix had
// shipped kept counting the same as a new one. The triage issue is where the fix is tracked, so
// its closing is the signal: closed as completed means fixed. An issue closed as not planned or
// as a duplicate leaves the report as it is, for the owner to decide on.
//
// Safety rules (see rule 129):
//   - Only rows in 'issue_created' with an issue number in the same triage repo are touched, and
//     only to move them to 'resolved'. Nothing is read from or written to the issue itself.
//   - The update re-checks the status, so a report an admin moved on since the read is left alone.
//   - A reopened issue does not move its report back; a report reopened by hand is a new decision.
//
// This script no-ops safely when its environment is not configured, like createBugReportIssues.mjs.
//
// Required environment:
//   DATABASE_URL            Postgres connection string (the app database).
//   GH_TOKEN                A token that can read issues in the triage repo.
//   BUG_REPORTS_TRIAGE_REPO owner/repo of the private triage repo
//                           (default: chargingthefuture/bug-reports).

import { execFileSync } from 'node:child_process';
import pg from 'pg';

// Closed issues read per run, newest first. Every run reads the most recent ones, so a backlog
// larger than this is worked through as older reports are resolved.
const CLOSED_ISSUE_LIMIT = 1000;
const TRIAGE_REPO = (process.env.BUG_REPORTS_TRIAGE_REPO || 'chargingthefuture/bug-reports').trim();
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log('resolveBugReportsFromTriage: DATABASE_URL not set; nothing to do.');
  process.exit(0);
}

if (!process.env.GH_TOKEN) {
  console.log('resolveBugReportsFromTriage: GH_TOKEN not set; nothing to do.');
  process.exit(0);
}

// Issue numbers in the triage repo that are closed as completed.
function listCompletedIssueNumbers() {
  const output = execFileSync(
    'gh',
    [
      'issue',
      'list',
      '--repo',
      TRIAGE_REPO,
      '--state',
      'closed',
      '--limit',
      String(CLOSED_ISSUE_LIMIT),
      '--json',
      'number,stateReason',
    ],
    { encoding: 'utf8' },
  );
  const issues = JSON.parse(output);
  return issues
    .filter((issue) => issue.stateReason === 'COMPLETED' && Number.isInteger(issue.number))
    .map((issue) => issue.number);
}

async function main() {
  const completed = listCompletedIssueNumbers();
  if (completed.length === 0) {
    console.log(`resolveBugReportsFromTriage: no completed issues in ${TRIAGE_REPO}; nothing to do.`);
    return;
  }

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      `UPDATE bug_reports
          SET status = 'resolved',
              updated_at = NOW()
        WHERE status = 'issue_created'
          AND triage_repo = $1
          AND issue_number = ANY($2::int[])`,
      [TRIAGE_REPO, completed],
    );
    console.log(`resolveBugReportsFromTriage: marked ${rowCount ?? 0} report(s) resolved from ${TRIAGE_REPO}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('resolveBugReportsFromTriage failed:', error?.message || error);
  process.exit(1);
});
