#!/usr/bin/env node
/**
 * check-contract-coverage.mjs — every API surface has its contract files, or a recorded reason.
 *
 * Rule 200 makes the command, access-policy and audit contracts mandatory for every plugin command
 * surface, and rule 114 adds the profile-and-deletion contract. Until this gate existed nothing
 * checked that the files were there: check-schema-drift.sh validates a contract file's keys only
 * when the file is in the diff, and the code-review sweep and the test-script generator skip a
 * missing file in silence. Bug reporting shipped and was reviewed for months with none of the four.
 *
 * What it checks: for every top-level directory under ctf/packages/web/app/api/ that contains at
 * least one route.ts, the four files
 *   ctf/docs/contracts/<PREFIX>_PLUGIN_COMMAND_CONTRACTS.yaml
 *   ctf/docs/contracts/<PREFIX>_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
 *   ctf/docs/contracts/<PREFIX>_PLUGIN_AUDIT_CONTRACTS.yaml
 *   ctf/docs/contracts/<PREFIX>_PROFILE_AND_DELETION_CONTRACT.md
 * must exist. PREFIX is the directory name upper-snake-cased, unless
 * ctf/config/code-review-slice-manifest.json gives that slice a contractPrefix (a surface served by
 * another plugin's contracts, e.g. api/commons -> FEED). Both the code-review sweep and this gate
 * read the same manifest, so a prefix declared once is honored everywhere.
 *
 * A surface that deliberately has no contract of one kind is listed in
 * ctf/scripts/contract-coverage-allowlist.json with the kinds it lacks and the reason. The gate
 * also fails when an allowlisted file has since been written, so the list can only shrink on its
 * own. Platform machinery (the account area, admin tools, secret-gated internal endpoints, the
 * health probe) is listed there with its reason rather than skipped by a hard-coded rule, so the
 * next reader sees the decision and not a hole.
 *
 * Exit 1 on any gap. Run: pnpm --dir ctf run check:contract-coverage
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const apiRoot = join(repoRoot, 'ctf/packages/web/app/api');
const contractsDir = join(repoRoot, 'ctf/docs/contracts');
const manifestPath = join(repoRoot, 'ctf/config/code-review-slice-manifest.json');
const allowlistPath = join(here, 'contract-coverage-allowlist.json');

const KINDS = {
  command: '_PLUGIN_COMMAND_CONTRACTS.yaml',
  'access-policy': '_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml',
  audit: '_PLUGIN_AUDIT_CONTRACTS.yaml',
  deletion: '_PROFILE_AND_DELETION_CONTRACT.md',
};

function fail(message) {
  console.error(`Contract coverage gate failed: ${message}`);
  process.exit(1);
}

function hasRouteFile(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (hasRouteFile(full)) return true;
    } else if (/^route\.tsx?$/.test(entry)) {
      return true;
    }
  }
  return false;
}

function readJson(path, what) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`could not read ${what} at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const manifest = readJson(manifestPath, 'the code-review slice manifest');
const allowlist = readJson(allowlistPath, 'the contract coverage allowlist');

if (!Array.isArray(allowlist.surfaces)) {
  fail(`${allowlistPath} must have a "surfaces" array.`);
}
const allowBySurface = new Map();
for (const entry of allowlist.surfaces) {
  if (typeof entry.surface !== 'string' || !Array.isArray(entry.missing) || typeof entry.reason !== 'string' || !entry.reason.trim()) {
    fail(`every allowlist entry needs "surface", "missing" (array) and a non-empty "reason"; got ${JSON.stringify(entry)}`);
  }
  for (const kind of entry.missing) {
    if (!(kind in KINDS)) {
      fail(`allowlist entry for "${entry.surface}" names unknown contract kind "${kind}" (known: ${Object.keys(KINDS).join(', ')}).`);
    }
  }
  if (allowBySurface.has(entry.surface)) {
    fail(`allowlist lists "${entry.surface}" twice.`);
  }
  allowBySurface.set(entry.surface, entry);
}

const surfaces = readdirSync(apiRoot)
  .filter((name) => statSync(join(apiRoot, name)).isDirectory() && hasRouteFile(join(apiRoot, name)))
  .sort();

const problems = [];
const seenAllowlisted = new Set();

for (const surface of surfaces) {
  const override = manifest?.slices?.[surface]?.contractPrefix;
  const prefix = typeof override === 'string' && override ? override : surface.toUpperCase().replace(/-/g, '_');
  const allowed = allowBySurface.get(surface);
  if (allowed) seenAllowlisted.add(surface);
  const allowedKinds = new Set(allowed?.missing ?? []);

  for (const [kind, suffix] of Object.entries(KINDS)) {
    const file = `${prefix}${suffix}`;
    const present = existsSync(join(contractsDir, file));
    if (!present && !allowedKinds.has(kind)) {
      problems.push(
        `api/${surface}: missing ctf/docs/contracts/${file}. Write it (model: a sibling plugin's ${suffix} file), ` +
          `or if this surface is served by another plugin's contracts set "contractPrefix" for "${surface}" in ` +
          `ctf/config/code-review-slice-manifest.json, or record the decision in ctf/scripts/contract-coverage-allowlist.json.`,
      );
    }
    if (present && allowedKinds.has(kind)) {
      problems.push(
        `api/${surface}: ctf/docs/contracts/${file} now exists, so remove "${kind}" from its entry in ` +
          `ctf/scripts/contract-coverage-allowlist.json (the list only shrinks).`,
      );
    }
  }
}

for (const surface of allowBySurface.keys()) {
  if (!seenAllowlisted.has(surface)) {
    problems.push(
      `allowlist entry "${surface}" matches no directory with a route file under ctf/packages/web/app/api/; remove it.`,
    );
  }
}

if (problems.length > 0) {
  console.error('Contract coverage gate failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Contract coverage gate passed: ${surfaces.length} API surfaces checked, ${allowBySurface.size} with a recorded exception.`);
