#!/usr/bin/env node
// Drain clean bug reports from the database into the PRIVATE triage repo as issues.
//
// Safety rules (see rule 129):
//   - Only rows with status 'new' are picked. Flagged reports are 'held_for_review'
//     and are never touched here — they wait for the owner in the private admin view.
//   - The RAW user text is never published. Only the redacted fields go to the issue.
//   - Issues are created in the private triage repo, not the public app repo.
//   - The row is flipped to 'issue_created' only after the issue is made, so a crash
//     mid-run never double-publishes.
//
// This script no-ops safely when its environment is not configured, so it is harmless
// to schedule before the secrets/labels are in place.
//
// Required environment:
//   DATABASE_URL            Postgres connection string (the app database).
//   GH_TOKEN                A token with `issues: write` on the triage repo.
//   BUG_REPORTS_TRIAGE_REPO owner/repo of the private triage repo
//                           (default: chargingthefuture/bug-reports).

import { execFileSync } from 'node:child_process';
import pg from 'pg';

const BATCH_LIMIT = 25;
const TRIAGE_REPO = (process.env.BUG_REPORTS_TRIAGE_REPO || 'chargingthefuture/bug-reports').trim();
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log('createBugReportIssues: DATABASE_URL not set; nothing to do.');
  process.exit(0);
}

if (!process.env.GH_TOKEN) {
  console.log('createBugReportIssues: GH_TOKEN not set; nothing to do.');
  process.exit(0);
}

function buildIssueBody(row) {
  const lines = [];
  lines.push('A user reported a problem from inside the app.');
  lines.push('');
  lines.push('> Raw text is kept private in the app database and is intentionally NOT included here.');
  lines.push('> The text below has had emails, phone numbers, and token-like strings removed.');
  lines.push('');
  lines.push('## What went wrong');
  lines.push('');
  lines.push(row.redacted_message || '(no message)');
  if (row.redacted_context) {
    lines.push('');
    lines.push('## What they were trying to do');
    lines.push('');
    lines.push(row.redacted_context);
  }
  lines.push('');
  lines.push('## Context');
  lines.push('');
  lines.push(`- Report id: \`${row.id}\``);
  lines.push(`- Page: ${row.page_url || '(unknown)'}`);
  lines.push(`- Plugin: ${row.plugin_slug || '(unknown)'}`);
  lines.push(`- App version: ${row.app_version || '(unknown)'}`);
  lines.push(`- Filed: ${new Date(row.created_at).toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('Next: a triage agent investigates and proposes a fix plan, then waits for the owner to');
  lines.push('add the `approved-to-build` label before any branch or PR is created.');
  return lines.join('\n');
}

function buildIssueTitle(row) {
  const firstLine = (row.redacted_message || 'User-reported problem').split('\n')[0].trim();
  const short = firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
  return `User report: ${short}`;
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  let created = 0;
  try {
    const { rows } = await client.query(
      `SELECT id, redacted_message, redacted_context, page_url, plugin_slug, app_version, created_at
         FROM bug_reports
        WHERE status = 'new'
        ORDER BY created_at ASC
        LIMIT $1`,
      [BATCH_LIMIT],
    );

    for (const row of rows) {
      const title = buildIssueTitle(row);
      const body = buildIssueBody(row);

      // gh prints the new issue URL on success.
      const issueUrl = execFileSync(
        'gh',
        [
          'issue',
          'create',
          '--repo',
          TRIAGE_REPO,
          '--title',
          title,
          '--body',
          body,
          '--label',
          'user-report',
          '--label',
          'needs-triage',
        ],
        { encoding: 'utf8' },
      ).trim();

      const issueNumber = Number(issueUrl.split('/').pop());

      await client.query(
        `UPDATE bug_reports
            SET status = 'issue_created',
                triage_repo = $2,
                issue_number = $3,
                issue_url = $4,
                updated_at = NOW()
          WHERE id = $1`,
        [row.id, TRIAGE_REPO, Number.isFinite(issueNumber) ? issueNumber : null, issueUrl],
      );

      created += 1;
    }
  } finally {
    await client.end();
  }

  console.log(`createBugReportIssues: created ${created} issue(s) in ${TRIAGE_REPO}.`);
}

main().catch((error) => {
  console.error('createBugReportIssues failed:', error?.message || error);
  process.exit(1);
});
