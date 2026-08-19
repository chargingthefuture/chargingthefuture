#!/usr/bin/env node
/**
 * check-unlock-tier-exceptions.mjs — keep the Unlock gate closed.
 *
 * Unlock approval is what grants access to this app. `evaluatePluginAccess({ minUnlockTier:
 * 'any_authenticated' })` bypasses that: it lets a signed-in member who has NOT been approved use
 * the surface behind it. That is correct in a short, closed list of places and nowhere else.
 *
 * WHY A GATE AND NOT A COMMENT. An agent building a new surface copies whatever nearby code does.
 * Every exception on this list makes the next unreviewed copy more likely, and a bypass added by
 * copy-and-paste does not look like a decision in review — it looks like the house style. So the
 * list is enforced here rather than described somewhere an agent may not read.
 *
 * The exceptions fall into two kinds, and the difference matters when judging a new request:
 *
 *   MACHINERY — the gate cannot work if these are gated. Unlock's own submission and status
 *   routes, the account area (see and delete your own data), bug reporting (report the thing
 *   blocking your onboarding), and small feeds a gated screen needs to render. Gating these would
 *   trap a member outside the app with no way in and no way out.
 *
 *   OWNER-APPROVED FEATURES — a real capability deliberately opened to unapproved members, each
 *   one an explicit owner decision recorded with its date. These are the ones that must not grow
 *   by imitation.
 *
 * ADDING AN ENTRY IS AN OWNER DECISION, not a build step. If a new surface seems to need this,
 * the answer is almost always `approved_full`; ask before adding a line here.
 *
 *   Run: pnpm --dir ctf run check:unlock-tier-exceptions
 *   Exit 1 on any file using the bypass that is not on the list.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = join(import.meta.dirname, '..', '..');
const webRoot = join(repoRoot, 'ctf', 'packages', 'web');
const allowlistPath = join(repoRoot, 'ctf', 'config', 'unlock-tier-exception-allowlist.json');

// The tier constant is declared and documented in the auth module itself, so that file names the
// string without being a call site.
const SELF = 'ctf/packages/web/lib/auth/server-authz.ts';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      acc.push(full);
    }
  }
  return acc;
}

// Only a real call counts. A comment explaining the tier is not a bypass, and flagging one would
// teach the next writer to stop explaining themselves.
const CALL_RE = /minUnlockTier\s*:\s*'any_authenticated'/;

const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
const allowed = new Map(allowlist.exceptions.map((entry) => [entry.file, entry]));

const offenders = [];
const seen = new Set();

for (const file of walk(webRoot)) {
  const rel = relative(repoRoot, file);
  if (rel === SELF) continue;
  const text = readFileSync(file, 'utf8');
  if (!CALL_RE.test(text)) continue;
  seen.add(rel);
  if (!allowed.has(rel)) offenders.push(rel);
}

const stale = [...allowed.keys()].filter((file) => !seen.has(file));

if (offenders.length > 0) {
  console.error(
    'Unlock tier check failed: these files let a member who is NOT approved in Unlock use the\n' +
      'surface behind them, and are not on the approved exception list:\n',
  );
  for (const file of offenders) console.error(`  • ${file}`);
  console.error(
    '\nUnlock approval is what grants access to this app. `approved_full` is the answer for almost\n' +
      'every surface. If this one genuinely belongs in the exception list, that is the owner\'s call\n' +
      `to make, not a build step — ask first, then add it to ${relative(repoRoot, allowlistPath)}\n` +
      'with the reason and the date of the decision.',
  );
  process.exit(1);
}

// A dead entry is worse than a missing one: it makes the list look longer and more permissive than
// the code actually is, which is exactly the impression this gate exists to prevent.
if (stale.length > 0) {
  console.error('Unlock tier check failed: these allowlist entries no longer use the bypass:\n');
  for (const file of stale) console.error(`  • ${file}`);
  console.error('\nRemove them. The list should only ever shrink on its own.');
  process.exit(1);
}

console.log(
  `Unlock tier check passed: ${seen.size} approved exception(s); every other surface requires Unlock approval.`,
);
