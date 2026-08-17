#!/usr/bin/env node
// ClickLog scheme-suggestion pipeline. Two jobs, both filing issues in the PRIVATE triage repo
// (member-written suggestion text may carry personal detail, so it never goes to the public
// app repo — same reasoning as bug reports):
//
//   1. Suggestion issues. Drain click_log_scheme_suggestions rows with status='new' into one
//      issue per distinct suggestion text (normalized trim+lowercase). The issue carries the
//      suggestion text, the optional member-provided Quora self-link (a spam signal for the
//      owner), how many members wrote the same text, and the dates — NEVER user_id or
//      incident_id. Every drained row is stamped status='issue_created' + the issue reference,
//      so reruns and overlapping schedules are safe.
//
//   2. Threshold alert. Count shared incidents tagged with the "Not listed" scheme slug
//      (other-scheme) over the trend window. If the count reaches the threshold and no alert
//      was filed within the cooldown, file ONE issue saying unnamed schemes are trending —
//      counts only, no member data — and record the alert in click_log_unnamed_scheme_alerts.
//
// SAFETY: this script NEVER writes the canonical scheme list (packages/web/lib/click-log/
// tags.ts). Naming a new scheme stays a deliberate human/agent step from the issue: a PR that
// adds the slug+label to tags.ts and mirrors the name on the landing /schemes page.
//
// Required environment:
//   DATABASE_URL   Postgres connection string (the app database).
//   GH_TOKEN       Token the gh CLI uses; needs issues:write on the triage repo.
// Optional:
//   SCHEME_TRIAGE_REPO        owner/repo to file into (default: chargingthefuture/bug-reports).
//   SUGGESTION_BATCH_LIMIT    Max suggestion groups per run (default 10).
//   SCHEME_THRESHOLD          Shared "Not listed" incidents that trigger the alert (default 5).
//   SCHEME_WINDOW_DAYS        Trend window in days (default 90).
//   SCHEME_ALERT_COOLDOWN_DAYS  Min days between alerts (default 30).
//
// Never prints secret values.

import { execFileSync } from 'node:child_process';
import pg from 'pg';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

const DATABASE_URL = requireEnv('DATABASE_URL');
const TRIAGE_REPO = (process.env.SCHEME_TRIAGE_REPO || 'chargingthefuture/bug-reports').trim();
const BATCH_LIMIT = Number(process.env.SUGGESTION_BATCH_LIMIT || 10);
const THRESHOLD = Number(process.env.SCHEME_THRESHOLD || 5);
const WINDOW_DAYS = Number(process.env.SCHEME_WINDOW_DAYS || 90);
const COOLDOWN_DAYS = Number(process.env.SCHEME_ALERT_COOLDOWN_DAYS || 30);

// gh prints the new issue URL on success. Labels may not exist in the triage repo yet; retry
// once without labels rather than losing the issue.
function createIssue(title, body, labels) {
  const labelArgs = labels.flatMap((label) => ['--label', label]);
  try {
    return execFileSync(
      'gh',
      ['issue', 'create', '--repo', TRIAGE_REPO, '--title', title, '--body', body, ...labelArgs],
      { encoding: 'utf8' },
    ).trim();
  } catch (err) {
    if (labels.length === 0) throw err;
    return execFileSync(
      'gh',
      ['issue', 'create', '--repo', TRIAGE_REPO, '--title', title, '--body', body],
      { encoding: 'utf8' },
    ).trim();
  }
}

function buildSuggestionTitle(suggestion) {
  const firstLine = suggestion.split('\n')[0].trim();
  const short = firstLine.length > 70 ? `${firstLine.slice(0, 67)}...` : firstLine;
  return `Scheme suggestion: ${short}`;
}

function buildSuggestionBody(group) {
  const lines = [];
  lines.push('A member picked the "Not listed" scheme tag in ClickLog and described the scheme:');
  lines.push('');
  lines.push(`> ${group.suggestion.replace(/\n/g, '\n> ')}`);
  lines.push('');
  lines.push(`- Times suggested (distinct incidents with this exact text): ${group.count}`);
  lines.push(`- First written: ${new Date(group.first_created_at).toISOString()}`);
  lines.push(`- Last written: ${new Date(group.last_created_at).toISOString()}`);
  for (const url of group.quora_urls) {
    lines.push(`- Member-provided Quora self-link (spam check): ${url}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('Next: if this is a real scheme, name it and open a PR that adds the slug+label to');
  lines.push('`ctf/packages/web/lib/click-log/tags.ts` (CLICK_LOG_SCHEME_TAGS) and mirrors the name');
  lines.push('on the landing-page `/schemes` list. This pipeline never edits the list itself.');
  lines.push('No member identity is attached to this issue by design.');
  return lines.join('\n');
}

async function fileSuggestionIssues(client) {
  const { rows: groups } = await client.query(
    `SELECT lower(trim(suggestion)) AS normalized,
            min(suggestion) AS suggestion,
            count(*)::int AS count,
            min(created_at) AS first_created_at,
            max(created_at) AS last_created_at,
            array_remove(array_agg(DISTINCT quora_url), NULL) AS quora_urls
       FROM click_log_scheme_suggestions
      WHERE status = 'new'
      GROUP BY 1
      ORDER BY min(created_at) ASC
      LIMIT $1`,
    [BATCH_LIMIT],
  );

  let created = 0;
  for (const group of groups) {
    const issueUrl = createIssue(
      buildSuggestionTitle(group.suggestion),
      buildSuggestionBody(group),
      ['scheme-suggestion', 'needs-triage'],
    );
    const issueNumber = Number(issueUrl.split('/').pop());
    await client.query(
      `UPDATE click_log_scheme_suggestions
          SET status = 'issue_created',
              triage_repo = $2,
              issue_number = $3,
              issue_url = $4,
              updated_at = NOW()
        WHERE status = 'new' AND lower(trim(suggestion)) = $1`,
      [group.normalized, TRIAGE_REPO, Number.isFinite(issueNumber) ? issueNumber : null, issueUrl],
    );
    created += 1;
  }
  console.log(`proposeSchemeSuggestions: filed ${created} suggestion issue(s) in ${TRIAGE_REPO}.`);
}

async function fileThresholdAlert(client) {
  const { rows: countRows } = await client.query(
    `SELECT count(*)::int AS count
       FROM click_log_incidents
      WHERE shared_with_owner
        AND scheme_tag = 'other-scheme'
        AND created_at >= NOW() - make_interval(days => $1)`,
    [WINDOW_DAYS],
  );
  const count = countRows[0]?.count ?? 0;
  if (count < THRESHOLD) {
    console.log(`proposeSchemeSuggestions: threshold not met (${count}/${THRESHOLD} in ${WINDOW_DAYS}d).`);
    return;
  }
  const { rows: recent } = await client.query(
    `SELECT 1 FROM click_log_unnamed_scheme_alerts
      WHERE created_at >= NOW() - make_interval(days => $1)
      LIMIT 1`,
    [COOLDOWN_DAYS],
  );
  if (recent.length > 0) {
    console.log('proposeSchemeSuggestions: threshold met but an alert is within cooldown; skipping.');
    return;
  }
  const title = `Unnamed schemes trending: ${count} shared "Not listed" incidents in ${WINDOW_DAYS} days`;
  const body = [
    `${count} shared ClickLog incidents carried the "Not listed" scheme tag in the last ${WINDOW_DAYS} days`,
    `(threshold ${THRESHOLD}). Members are seeing schemes the canonical list does not name yet.`,
    '',
    'This alert holds counts only — no notes, no locations, no member identity.',
    'Check the open scheme-suggestion issues here, and the community channels, for what to name.',
    '',
    '---',
    'Naming a scheme is a PR: add the slug+label to `ctf/packages/web/lib/click-log/tags.ts`',
    '(CLICK_LOG_SCHEME_TAGS) and mirror the name on the landing-page `/schemes` list.',
  ].join('\n');
  const issueUrl = createIssue(title, body, ['scheme-suggestion', 'needs-triage']);
  await client.query(
    `INSERT INTO click_log_unnamed_scheme_alerts (id, window_days, shared_count, issue_url, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
    [WINDOW_DAYS, count, issueUrl],
  );
  console.log(`proposeSchemeSuggestions: filed threshold alert in ${TRIAGE_REPO}.`);
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await fileSuggestionIssues(client);
    await fileThresholdAlert(client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
