# Metric Definition and Confirmation (MDC)

This directory contains the **MDC rule enforcement** system for metric-related
code in the Charging the Future platform.  Before any alert rule, ETL job,
schema column, or dashboard widget can be created or modified, the target
metric **must** exist in the canonical registry.

---

## How it works

1. All metric-dependent code calls `checkMetricDefined(metricIdentifier, caller)` from `checkMetricDefined.ts`.
2. If the metric is found in `canonical_metrics.yaml`, the full canonical entry is returned and code generation proceeds normally.
3. If the metric is **not found** or the identifier matches **multiple entries** (ambiguous), the function:
   - Returns a `MdcDefinitionRequest` with a human-readable blocking message and a structured list of questions.
   - **Does not generate** any metric-dependent code.
   - Emits a structured JSON audit log line (`timestamp`, `caller`, `metric_identifier`, `result`).

---

## Adding a new metric to `canonical_metrics.yaml`

Copy the template below, fill in every field, and open a pull request:

```yaml
- id: "your_metric_id"           # snake_case, unique across the registry
  name: "Human Readable Name"
  description: "Precise description of what is measured, over what population, and in what context."
  owner: "team-name@chargingthefuture.io"
  data_type: integer              # integer | float | percent | currency | datetime | string
  unit: "users"                   # e.g. users, USD, kWh, ms, percent
  calculation: |
    SELECT ...                    # SQL, formula, or pseudocode
  inputs:
    - name: "field_name"
      type: "type description"
  example_values:
    - input: { key: "value" }
      output: 12345
  last_updated: "YYYY-MM-DDTHH:MM:SSZ"
  allowed_thresholds:
    min: 0
    max: 1000000
    alert_rules:
      - condition: "value < 100"
        severity: "critical"
        message: "Metric dropped below safe threshold."
```

Answer all seven questions before submitting:

1. Confirm the exact metric name and any aliases or synonyms.
2. Provide a precise human-readable description (what, which population, what context).
3. Specify `data_type` and `unit`.
4. Provide calculation logic (SQL, formula, pseudocode) and all required input fields with their types.
5. Provide at least two concrete example inputs with expected output values.
6. Specify the metric owner (name + email) and acceptable thresholds / alert rules.
7. Indicate the update cadence (real-time, hourly, daily, monthly) and data retention period.

---

## Blocking workflow

When `checkMetricDefined` returns an `MdcDefinitionRequest`:

1. **Do not merge** any code that depends on the undefined metric.
2. Open a GitHub issue and paste the `blocking_message` and `definition_questions` as the issue body.
3. Tag the proposed metric owner and the platform-metrics team.
4. Once the metric is added to `canonical_metrics.yaml` and merged, re-run the blocked code generation.

---

## Files

| File | Purpose |
|---|---|
| `canonical_metrics.yaml` | Single source of truth for all approved metrics |
| `checkMetricDefined.ts` | MDC enforcement function + audit logging |
| `integration_examples.ts` | Examples: alert, ETL, schema, dashboard |
| `README.md` | This document |
