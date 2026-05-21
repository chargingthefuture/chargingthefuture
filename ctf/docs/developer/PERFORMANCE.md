# Performance Program

Repeatable, low-overhead performance tracking for web and Android (plus mobile
web on iOS Safari). Combines the rollout/status tracker and the manual
benchmark runbook.

Source of truth in code:
- Budgets: `ctf/config/performance-budgets.json`
- Audit script: `ctf/scripts/performanceBudgetAudit.mjs`
- Results template: `ctf/docs/developer/PERFORMANCE_BENCHMARK_RESULTS_TEMPLATE.json`
- CI wiring: `.github/workflows/rewrite-ci.yml`

## Mode

Balanced thresholds, low CI overhead, **warning-only gating** (does not block
merges yet). Checks stay inside `ctf/` and reuse existing build outputs; never
reference `/platform`.

## Status

Foundation is in place and wired into CI (warning mode):

- [x] Budget config + size-audit script (`web.jsBytes`, `web.cssBytes`, `android.totalBytes`, `android.jsBundleBytes`)
- [x] Scripts: `pnpm --dir ctf run perf:budgets`, `perf:budgets:ci`
- [x] CI runs the audit after web/mobile build gates and uploads the JSON artifact
- [x] Benchmark runbook + machine-readable results template

Next slices: budget delta/trend script (compare current vs prior artifact), CI
step-summary annotation for warnings, and a first populated baseline from real
device runs.

> Known pre-existing blocker (outside perf scope): `pnpm --dir ctf run build`
> can fail at prerender on `/admin/feed-announcements`
> (`Cannot read properties of undefined (reading 'call')`).

## Device Matrix

- Low-end Chromebook — web
- Low-end Android device — native app + mobile web (Chrome)
- iOS device — mobile web (Safari)

## Benchmark Runbook (manual)

**Discipline:** production builds only; run each scenario ≥20×; report p50 and
p75; same route/flow order each run; record build SHA + date.

**Scenarios:** cold + repeat navigation and a primary interaction flow per
surface; for Android native also warm start and a scroll-stress flow.

**Metrics:**
- Web — LCP, INP, CLS, initial JS bytes, initial CSS bytes
- Android — cold start, warm start, janky-frame %, build/export size

**Capture** (copy per scenario):
```text
Scenario:  Device:  Date:  Build SHA:
Runs:  p50:  p75:  Worst run:  Notes:
```
Copy `PERFORMANCE_BENCHMARK_RESULTS_TEMPLATE.json` to a dated results file and
fill in real device data after each baseline run.

**Commands** (from `ctf/`): `pnpm run build`, `pnpm run perf:budgets`, `pnpm run perf:budgets:ci`.

## Budget Interpretation

- Under warning threshold → healthy
- Between warning and block threshold → warning (monitor, optimize)
- Over block threshold → critical regression (warning mode now; blocking mode planned)

Open a remediation task for any metric above the warning threshold; include
trace evidence for p75 regressions.
