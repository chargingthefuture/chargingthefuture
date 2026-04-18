# Config Directory

## Purpose
Central location for configuration files governing metrics, performance budgets, and plugin parity contracts.

## Files

### `canonical_metrics.yaml`
- Defines metrics: name, SQL calculation, inputs, thresholds, cadence, retention, owner.
- Used in the MDC process (see root README).

### `performance-budgets.json`
- Budget profiles for web and Android.
- Modes: `warning` (soft fail), `block` (hard fail).
- Metrics: web JS bytes, web CSS bytes, Android total bytes, Android JS bytes.

### `plugin-parity-contracts.json`
- Declares which plugins require mobile and web surfaces.
- Used by `check-web-android-parity.mjs` to enforce feature parity.
