#!/usr/bin/env node
// Triage one user-reported bug from the PRIVATE triage repo.
//
// What it does (see rule 129):
//   1. Finds the oldest open issue labeled `needs-triage` in the triage repo.
//   2. Pulls a little code context from this checked-out app repo (by plugin slug).
//   3. Asks Claude for a root-cause hypothesis + a minimal fix plan.
//   4. Posts that as a comment and relabels the issue `triaged` + `awaiting-owner-approval`.
//
// It NEVER opens a branch or PR — that only happens after the owner adds the
// `approved-to-build` label (handled by the build workflow). One issue per run; a
// frequent schedule drains the queue. No-ops safely when unconfigured.
//
// Required environment:
//   GH_TOKEN                A token with issues:read+write on the triage repo.
//   ANTHROPIC_API_KEY       For the model call.
//   BUG_REPORTS_TRIAGE_REPO owner/repo (default: chargingthefuture/bug-reports).
//   BUG_REPORTS_TRIAGE_MODEL Optional model id (default: claude-sonnet-4-6).

import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const webRoot = join(repoRoot, 'ctf/packages/web');

const TRIAGE_REPO = (process.env.BUG_REPORTS_TRIAGE_REPO || 'chargingthefuture/bug-reports').trim();
const MODEL = (process.env.BUG_REPORTS_TRIAGE_MODEL || 'claude-sonnet-4-6').trim();

if (!process.env.GH_TOKEN) {
  console.log('triageBugReportIssues: GH_TOKEN not set; nothing to do.');
  process.exit(0);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.log('triageBugReportIssues: ANTHROPIC_API_KEY not set; nothing to do.');
  process.exit(0);
}

function gh(args, options = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', ...options });
}

function ensureLabel(name, color, description) {
  try {
    gh(['label', 'create', name, '--repo', TRIAGE_REPO, '--color', color, '--description', description, '--force']);
  } catch {
    // no-trace: label tooling is best-effort, since applying the label below is what matters.
  }
}

// Find the oldest open `needs-triage` issue.
function findOldestNeedsTriage() {
  const raw = gh([
    'issue',
    'list',
    '--repo',
    TRIAGE_REPO,
    '--label',
    'needs-triage',
    '--state',
    'open',
    '--json',
    'number,title,body,createdAt',
    '--limit',
    '50',
  ]);
  const list = JSON.parse(raw);
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return list[0];
}

function parseField(body, label) {
  const match = body.match(new RegExp(`- ${label}:\\s*(.+)`));
  return match ? match[1].trim() : '';
}

// Pull a small amount of code context by plugin slug, so the model reasons against real
// files rather than guessing. Bounded so the prompt stays small.
function gatherCodeContext(pluginSlug) {
  if (!pluginSlug || pluginSlug === '(unknown)') {
    return 'No plugin slug on the report; investigate from the description.';
  }
  const safe = pluginSlug.replace(/[^a-z0-9-]/gi, '');
  if (!safe) {
    return 'No usable plugin slug on the report.';
  }
  try {
    const files = execFileSync(
      'bash',
      [
        '-lc',
        `if command -v rg >/dev/null 2>&1; then rg -l --max-count 1 "${safe}" "${webRoot}/app" "${webRoot}/components" "${webRoot}/lib" 2>/dev/null | head -25; else grep -RIl "${safe}" "${webRoot}/app" "${webRoot}/components" "${webRoot}/lib" 2>/dev/null | head -25; fi`,
      ],
      { encoding: 'utf8' },
    ).trim();
    return files
      ? `Candidate files mentioning "${safe}":\n${files}`
      : `No files matched "${safe}"; investigate from the description.`;
  } catch {
    return `Could not search the codebase for "${safe}".`;
  }
}

async function askClaude(issue, codeContext) {
  const system = [
    'You are a senior engineer triaging a user-reported bug in "Charging the Future", an',
    'open-source Next.js app (web code under ctf/packages/web). You are NOT writing code now —',
    'you are proposing a plan a human will read and approve.',
    '',
    'Write in plain language. No jargon. Be concrete and brief. Do not invent details.',
  ].join('\n');

  const user = [
    `Triage issue #${issue.number}: ${issue.title}`,
    '',
    'Issue body (text is already redacted; do not ask for more from the user):',
    '"""',
    issue.body || '(empty)',
    '"""',
    '',
    'Code context from the current checkout:',
    codeContext,
    '',
    'Respond in this exact markdown shape:',
    '## Root cause (best hypothesis)',
    '## Proposed fix (files to change + approach, kept minimal)',
    '## Risk / blast radius',
    '## Confidence (low / medium / high) and what would raise it',
  ].join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }
  const result = await response.json();
  return result.content[0].text.trim();
}

async function main() {
  const issue = findOldestNeedsTriage();
  if (!issue) {
    console.log('triageBugReportIssues: no issues labeled needs-triage.');
    return;
  }

  const pluginSlug = parseField(issue.body || '', 'Plugin');
  const codeContext = gatherCodeContext(pluginSlug);
  const plan = await askClaude(issue, codeContext);

  const comment = [
    '### Automated triage proposal',
    '',
    plan,
    '',
    '---',
    '_This is an automated proposal. No code has been written. To approve, add the',
    '`approved-to-build` label and the build agent will open a pull request._',
  ].join('\n');

  ensureLabel('triaged', '0e8a16', 'Investigated; a fix plan was proposed');
  ensureLabel('awaiting-owner-approval', 'fbca04', 'Waiting for the owner to approve the proposed fix');

  gh(['issue', 'comment', String(issue.number), '--repo', TRIAGE_REPO, '--body', comment]);
  gh([
    'issue',
    'edit',
    String(issue.number),
    '--repo',
    TRIAGE_REPO,
    '--add-label',
    'triaged',
    '--add-label',
    'awaiting-owner-approval',
    '--remove-label',
    'needs-triage',
  ]);

  console.log(`triageBugReportIssues: triaged issue #${issue.number}.`);
}

main().catch((error) => {
  const message = error?.message || String(error);
  // A transient GitHub API rate limit is not something to act on — the token's hourly budget was
  // spent (often by other automation or interactive use on the same shared token), and the next
  // scheduled run picks up the same needs-triage issue. Skip cleanly (exit 0) so a rate limit does
  // not red this scheduled maintenance workflow and spawn a CI-health issue. A genuine error still
  // fails the run (exit 1).
  if (/rate limit/i.test(message)) {
    console.log(
      'triageBugReportIssues: GitHub API rate limit hit; skipping this run. The next scheduled run will retry.',
    );
    process.exit(0);
  }
  console.error('triageBugReportIssues failed:', message);
  process.exit(1);
});
