#!/usr/bin/env node
// Flag a plugin whose feature inventory changed in this PR but whose manual test script did NOT.
//
// Same drift idea as check-inventory-drift.mjs, applied to the manual test scripts: when you change
// what a plugin does (its inventory is the source of truth), its test script — the steps to confirm
// it works on a device — should be regenerated or updated in the same change, so the two never fall
// out of step. The daily rotation refreshes scripts over time, but a PR that edits behavior should
// not merge with a test script that still describes the old behavior.
//
// This is diff-based (unlike the inventory gate, which scans the whole tree): it compares the PR
// branch against its base. Outside a PR / with no resolvable base it does nothing, so it is safe to
// run locally.
//
//   Base ref:  TEST_SCRIPT_DRIFT_BASE (default: origin/main)
//   Run:       pnpm --dir ctf run check:test-script-drift
//   Exit 1 on drift; prints each drifted plugin and how to fix it.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const manifestPath = join(repoRoot, 'ctf/config/manual-test-script-manifest.json');

const BASE = (process.env.TEST_SCRIPT_DRIFT_BASE || 'origin/main').trim();

// Dialect-only edits are excluded. A repo-wide US-spelling sweep rewrites a word in an inventory's
// prose without changing anything about how the plugin is tested, and demanding a matching
// test-script edit for that would only produce a fabricated one. changed-files.mjs drops a file
// whose entire diff disappears when both sides are rewritten to US English, and nothing else — a
// real edit anywhere in the same file keeps it in the list.
function changedFiles(base) {
  try {
    const out = execFileSync('node', [join(repoRoot, 'ctf/scripts/changed-files.mjs'), '--base', base], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean));
  } catch (error) {
    return null; // base not resolvable (e.g. local checkout without the ref) -> skip cleanly
  }
}

function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const changed = changedFiles(BASE);
  if (changed === null) {
    console.log(`check-test-script-drift: base ref '${BASE}' not resolvable; skipping (this is normal locally).`);
    return;
  }

  const drifted = [];
  for (const plugin of manifest.plugins) {
    const inventoryRel = `${manifest.inventoryDir}/${plugin.inventory}`;
    const scriptRel = `${manifest.outputDir}/${plugin.slug}-test-script.md`;
    const inventoryChanged = changed.has(inventoryRel);
    const scriptChanged = changed.has(scriptRel);
    if (inventoryChanged && !scriptChanged) {
      drifted.push({ slug: plugin.slug, inventoryRel, scriptRel, scriptExists: existsSync(join(repoRoot, scriptRel)) });
    }
  }

  if (drifted.length === 0) {
    console.log('check-test-script-drift: no drift — every changed inventory has a matching test-script change.');
    return;
  }

  console.error('check-test-script-drift: a plugin inventory changed but its manual test script did not.\n');
  for (const d of drifted) {
    console.error(`  • ${d.slug}`);
    console.error(`      inventory changed: ${d.inventoryRel}`);
    console.error(`      test script ${d.scriptExists ? 'unchanged' : 'MISSING'}: ${d.scriptRel}`);
    console.error(`      fix: pnpm --dir ctf test-script:generate -- ${d.slug}   (or update ${d.scriptRel} by hand), then commit it.`);
  }
  console.error(
    '\nIf the inventory change genuinely does not affect how the plugin is tested, make a matching ' +
      'note/edit in the test script so the two stay in step. The test script is the runnable counterpart ' +
      'of the inventory — they should move together.',
  );
  process.exit(1);
}

main();
