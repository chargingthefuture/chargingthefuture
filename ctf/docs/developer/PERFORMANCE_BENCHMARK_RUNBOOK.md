# Performance Benchmark Runbook

## Goal

Collect repeatable baseline metrics on low-end hardware for web and Android-native, then compare against budget thresholds.

## Devices

- Chromebook (low-end): web desktop profile
- Android device (low-end): Android-native and mobile web (Chrome)
- iOS device: mobile web (Safari)

## Run Discipline

- Use production builds only.
- Run each scenario at least 20 times.
- Report p50 and p75.
- Use the same route/flow order each run.
- Record build SHA and date.

## Scenarios

### Web: Chromebook

- Cold navigation to main user landing route
- Repeat navigation to same route
- Primary interaction flow (open feature page, trigger primary CTA)

### Web: Android Chrome

- Cold mobile-web load
- Repeat mobile-web load
- Mobile interaction flow

### Web: iOS Safari

- Cold mobile-web load
- Repeat mobile-web load
- Mobile interaction flow

### Android Native

- Cold start (process not running)
- Warm start
- Navigation flow across key screens
- Scroll stress flow (long list)

## Metrics

### Web

- LCP
- INP
- CLS
- Initial JavaScript bytes
- Initial CSS bytes

### Android

- Cold start time
- Warm start time
- Janky frame percentage
- Build/export size footprint

## Data Capture Template

Copy this block per scenario:

```text
Scenario:
Device:
Date:
Build SHA:
Runs:
p50:
p75:
Worst run:
Notes:
```

Machine-readable template:

- `ctf/docs/developer/PERFORMANCE_BENCHMARK_RESULTS_TEMPLATE.json`
- Copy it to a dated results file and fill real device data after each baseline run.

## Budget Interpretation

- Under warning threshold: healthy
- Between warning and block threshold: warning (monitor, optimize)
- Over block threshold: critical regression (warning mode for now, planned future blocking mode)

## Execution Commands

From `ctf/`:

- `pnpm run build`
- `pnpm run perf:budgets`
- `pnpm run perf:budgets:ci`

## Follow-up

- Open a performance remediation task for any metric above warning threshold.
- Include trace evidence for p75 regressions.
- Store completed benchmark result files next to the template using a dated filename.
