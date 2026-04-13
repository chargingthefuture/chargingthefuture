# Performance Rollout Tracker

Owner: AI agent (handoff-ready)
Status: In progress
Mode: Balanced thresholds, low CI overhead, warning-only gating

## Objective

Ship a repeatable, low-overhead performance program for web and Android with mobile-web coverage on iOS Safari. Track startup, responsiveness, smoothness, memory, and size, and prevent silent regressions.

## Device Matrix

- Low-end Chromebook: web
- Low-end Android device: native app and mobile web
- iOS device: mobile web (Safari)

## Scope Decisions

- Keep checks inside `ctf/` only.
- Keep CI overhead low by reusing existing build outputs in `rewrite-ci`.
- Start with warning-mode budgets to gather baseline without blocking merges.
- Do not reference or depend on `/platform`.

## Implementation Log

### Step 1: Persistent tracker created

- Created this tracker so work can resume without context loss.

### Step 2: Budget config and audit script created

- Added `ctf/config/performance-budgets.json` with balanced thresholds and warning-first policy.
- Added `ctf/scripts/performanceBudgetAudit.mjs`.
- Script computes low-overhead build footprint metrics using existing build outputs:
  - `web.jsBytes`
  - `web.cssBytes`
  - `android.totalBytes`
  - `android.jsBundleBytes`
- Script supports modes:
  - `warn`: never blocks
  - `block`: exits non-zero on blocked thresholds
- Script supports JSON output for CI artifact retention.

### Step 3: CI wiring (warning mode) completed

- Added package scripts:
  - `pnpm --dir ctf run perf:budgets`
  - `pnpm --dir ctf run perf:budgets:ci`
- Updated `.github/workflows/rewrite-ci.yml` to:
  - run budget audit after existing web/mobile build gates
  - upload budget JSON artifact
- This preserves low overhead by reusing already-built outputs.

### Step 4: Local validation completed

- `pnpm --dir ctf run typecheck`: passed.
- `pnpm --dir ctf run lint`: passed.
- `pnpm --dir ctf run perf:budgets:ci`: passed in warning mode.
- `pnpm --dir ctf run build`: failed in existing web prerender path with:
  - `TypeError: Cannot read properties of undefined (reading 'call')`
  - route: `/admin/feed-announcements`
  - status: pre-existing blocker outside this performance-infra change set.

### Step 5: Validation completed for edited files

- Clean results:
  - `ctf/scripts/performanceBudgetAudit.mjs`
  - `ctf/config/performance-budgets.json`
  - `ctf/package.json`
- Workflow/docs compatibility notes:
  - Script lint findings were fixed (`process`/`console` globals declared) and re-verified.

### Next implementation slice

- Add optional trend script that compares current report vs previous report artifact for delta visibility.
- Add warning summary annotation in CI job output for quick PR scanning.
- Add first baseline result file derived from real Chromebook/Android/iOS manual runs.

## Resume From Here

The performance-infra foundation is in place. The next agent should continue in this order:

1. Keep only performance-infra edits in scope.
2. Do not revert or reason about unrelated generated/tooling changes unless the user asks.
3. Add a budget delta/trend script that compares the current JSON artifact to a prior artifact.
4. Add CI step-summary output so warnings are visible without downloading artifacts.
5. Create the first populated benchmark results file using the manual device matrix in `PERFORMANCE_BENCHMARK_RUNBOOK.md`.
6. Re-run validation and update this tracker again.

## Known Non-Performance Workspace Changes To Ignore

- `ctf/packages/mobile/dist/android/**` changes when Expo export runs.
- Those changes were not intentionally authored as part of the performance-infra implementation.
- Unless the user explicitly asks, do not treat them as part of the intended change set.

## Work Backlog

- [x] Create durable tracker document
- [x] Add machine-readable performance budget config
- [x] Add low-overhead web/mobile size audit script
- [x] Add benchmark runbook for manual device runs
- [x] Add machine-readable benchmark result template
- [x] Add npm scripts for local and CI warning mode
- [x] Wire warning-mode check into `.github/workflows/rewrite-ci.yml`
- [x] Run required local validation (`pnpm build`, lint/typecheck as needed)
- [x] Update tracker with final outputs and follow-up actions

## Current Validation Snapshot

- `pnpm --dir ctf run lint`: passed
- `pnpm --dir ctf run typecheck`: passed
- `pnpm --dir ctf run perf:budgets:ci`: passed
- `pnpm --dir ctf run build`: still blocked by existing web prerender error on `/admin/feed-announcements`

## Handoff Notes

If session ends abruptly, start with `Resume From Here`, then keep this file updated after each completed change.
