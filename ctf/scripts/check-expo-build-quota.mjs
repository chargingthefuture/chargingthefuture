#!/usr/bin/env node
// check-expo-build-quota.mjs
//
// Quota guard for Android EAS builds. The Expo free plan gives a small, fixed
// number of Android builds per calendar month (see
// ctf/packages/mobile/expo-free-tier-quota.json — the single source of truth).
// This script reads that file, asks EAS how many Android builds the account has
// already started THIS calendar month, and decides whether one more is allowed.
//
// It is meant to run in GitHub Actions before an `eas build` step. It writes
// `build_allowed=true|false` and a human-readable `reason` to $GITHUB_OUTPUT so
// the workflow can skip the build instead of failing. No human has to remember
// the quota — the numbers live in the JSON and this guard enforces them.
//
// Modes (first CLI arg, default "scheduled"):
//   scheduled  Enforce the automated cron budget (policy.scheduledBuildBudgetPerMonth).
//              Used by the 3x/week cron so automated builds never eat the whole month.
//   hard       Enforce the absolute monthly cap (limits.androidBuildsPerMonth).
//              Used by on-demand preview builds — blocks only at the real ceiling.
//   report     Never blocks; just prints the current count and the limits.
//
// Required env: EXPO_TOKEN (so `eas build:list` can authenticate).
// Optional env: EXPO_QUOTA_FORCE=1 forces build_allowed=true regardless (manual override).

import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = resolve(here, '../packages/mobile');
const quotaPath = resolve(mobileDir, 'expo-free-tier-quota.json');

const mode = (process.argv[2] || 'scheduled').toLowerCase();

function emit(allowed, reason) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    appendFileSync(out, `build_allowed=${allowed ? 'true' : 'false'}\n`);
    // Reason can contain anything; keep it single-line for the simple key=value format.
    appendFileSync(out, `reason=${reason.replace(/\r?\n/g, ' ')}\n`);
  }
  console.log(`[expo-build-quota] mode=${mode} build_allowed=${allowed}`);
  console.log(`[expo-build-quota] ${reason}`);
}

let quota;
try {
  quota = JSON.parse(readFileSync(quotaPath, 'utf8'));
} catch (err) {
  // Without the budget file we cannot make a safe decision. Fail open so a
  // deliberate build is never silently lost, but say so loudly.
  emit(true, `Could not read ${quotaPath} (${err.message}). Proceeding without a quota check.`);
  process.exit(0);
}

const hardCap = quota?.limits?.androidBuildsPerMonth?.value ?? 15;
const scheduledBudget = quota?.policy?.scheduledBuildBudgetPerMonth ?? Math.max(1, hardCap - 3);

if (process.env.EXPO_QUOTA_FORCE === '1') {
  emit(true, `Override: EXPO_QUOTA_FORCE=1 set — skipping the quota check on purpose.`);
  process.exit(0);
}

// Count Android builds created in the current UTC calendar month. EAS bills per
// build attempt, so we count every status EXCEPT canceled (a canceled build does
// not consume the allotment). Counting conservatively protects the free tier —
// the whole point is to never overspend.
function countThisMonth() {
  let raw;
  try {
    raw = execFileSync(
      'eas',
      // 50 is the highest --limit the EAS CLI accepts. That is far more than the
      // 15-builds-per-month cap, so the current month is always fully covered.
      ['build:list', '--platform', 'android', '--limit', '50', '--json', '--non-interactive'],
      // Run inside the Expo app directory. The workflows call this script from the
      // repo root, and there is no app config there, so `eas build:list` would exit
      // with "EAS project not configured" and the guard would fail open.
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: mobileDir },
    );
  } catch (err) {
    // Include the CLI's own output; err.message alone only repeats the command,
    // which hides why the read failed. The EAS CLI puts some failures on stdout.
    const detail = [err?.stdout, err?.stderr].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
    return { error: detail ? `${err.message} ${detail}` : err.message };
  }

  let builds;
  try {
    builds = JSON.parse(raw);
  } catch (err) {
    return { error: `could not parse eas build:list output: ${err.message}` };
  }
  if (!Array.isArray(builds)) return { error: 'eas build:list did not return an array' };

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  let count = 0;
  for (const b of builds) {
    const created = b?.createdAt ? new Date(b.createdAt) : null;
    if (!created || Number.isNaN(created.getTime())) continue;
    if (created.getUTCFullYear() !== year || created.getUTCMonth() !== month) continue;
    const status = String(b?.status || '').toLowerCase();
    if (status === 'canceled' || status === 'cancelled') continue;
    count += 1;
  }
  return { count };
}

const result = countThisMonth();

if (result.error) {
  // We could not read usage from EAS. The cron frequency (3x/week ≈ 13/month) is
  // itself a soft bound, so fail open rather than block a build on a transient
  // CLI/auth error — but log it so it is visible.
  emit(true, `Could not read EAS build usage (${result.error}). Falling back to the cron frequency cap and proceeding.`);
  process.exit(0);
}

const used = result.count;
const limit = mode === 'hard' ? hardCap : scheduledBudget;
const label = mode === 'hard' ? `monthly cap (${hardCap})` : `automated-build budget (${scheduledBudget}, reserving ${hardCap - scheduledBudget} for releases)`;

if (mode === 'report') {
  emit(true, `This month: ${used} Android build(s) used. Limits — hard cap ${hardCap}, automated budget ${scheduledBudget}, CI/CD-minutes ${quota?.limits?.ciWorkflowMinutesPerMonth?.value} (EAS Workflows, unused here), updates MAU ${quota?.limits?.updatesMonthlyActiveUsers?.value}.`);
  process.exit(0);
}

if (used >= limit) {
  emit(false, `Skipping build: ${used} Android build(s) already used this month, which meets the ${label}. The build will run again next cycle once the month rolls over or usage frees up. Set EXPO_QUOTA_FORCE=1 to override.`);
  process.exit(0);
}

emit(true, `Allowed: ${used} of ${limit} (${label}) Android build(s) used this month.`);
process.exit(0);
