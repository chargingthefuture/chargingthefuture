# Gross Domestic Product Plugin Feature Inventory (CTF Rewrite)

## Scope

- Rewrite target only: `ctf/`
- Legacy reference excluded from implementation: `platform/`
- Plugin name: `Gross Domestic Product`
- Plugin slug / service key: `gross-domestic-product`
- Primary mission scope:
  - provide public-facing GDP transparency for the survivor community,
  - track shared service-economy progress with canonical metrics,
  - support survivor-led governance through auditable KPI definitions,
  - avoid fabricated or ambiguous metrics via canonical metric registry enforcement.

## Intent and Outcome

The Gross Domestic Product plugin is a trauma-informed, transparency-first economics plugin for survivors to:

1. view total and per-capita GDP progress,
2. inspect service-sector and goods/local-economy composition,
3. monitor provider participation and earning opportunity trends,
4. understand progress against the 5-year rollout milestones,
5. trust reported values through auditable canonical metric contracts.

The plugin must provide equivalent core behavior across web and Android, with phased parity tracked and closed before GA.

---

## 1) User-Facing Features

### 1.1 GDP Transparency Overview

1. Authenticated survivor-facing GDP summary dashboard.
2. Current annual `Total GDP`, `Service GDP`, `Goods/Local GDP` with plain-language explanations.
3. Per-capita indicators based on population baseline and selected period.
4. Progress-to-target indicators for $300B total and $210B services goals.

### 1.2 Service Category Composition

1. Service breakdown by category:
   - personal and social care,
   - professional and knowledge services,
   - platforms and marketplaces,
   - creative and cultural,
   - maintenance and utilities.
2. Category share and absolute value displays.
3. Year-over-year change visibility by category.
4. Footnotes linking each category to canonical metric IDs.

### 1.3 Provider Participation and Unit Economics

1. Active provider counts and participation rate.
2. Blended and tiered hourly-rate trend views.
3. Billable hours and revenue by provider tier:
   - high-value specialists,
   - mid-value professionals,
   - low-value/microservice providers.
4. Transparent assumptions panel for scenario interpretation.

### 1.4 Five-Year Rollout Tracking

1. Year-by-year target and actual views for service GDP capture.
2. Milestone tracking for provider growth and specialist certification targets.
3. Gap-to-target indicators for each year and category.
4. Backfilled timeline display for prior years once data is available.

### 1.5 Data Quality and Trust Cues

1. Metric freshness indicators (`last_updated`, update cadence).
2. Canonical-definition status indicator per KPI.
3. Clear handling for unresolved/blocked metrics (not found/ambiguous).
4. Human-readable metric definition panel (name, owner, formula summary).

---

## 2) Admin Features

### 2.1 Metric Governance Operations

1. Canonical metric lifecycle management (proposal/review/approval).
2. Alias and naming conflict resolution workflow.
3. Ownership and stewardship tracking for each KPI.

### 2.2 Data Pipeline and Model Operations

1. Controlled publishing of GDP snapshots.
2. Validation queue for failed metric checks.
3. Backfill and replay controls for historical periods.

### 2.3 Policy and Compliance Operations

1. Access controls for administrative metric mutation commands.
2. Full audit trail for metric definition and publish actions.
3. Data retention and legal basis review for metric inputs.

---

## 3) API Surface and Route Map

## 3.1 Plugin Command Surface (Authoritative)

All command contracts must conform to templates from:

- `201-plugin-command-schema-template.mdc`
- `202-plugin-access-policy-schema-template.mdc`
- `203-plugin-audit-schema-template.mdc`

Planned command groups:

1. `gross-domestic-product.metrics.list`
2. `gross-domestic-product.metrics.get`
3. `gross-domestic-product.dashboard.snapshot.get`
4. `gross-domestic-product.rollout.progress.get`
5. `gross-domestic-product.scenario.assumptions.get`
6. `gross-domestic-product.admin.metric.propose`
7. `gross-domestic-product.admin.metric.approve`
8. `gross-domestic-product.admin.snapshot.publish`
9. `gross-domestic-product.admin.backfill.run`

### 3.2 HTTP Projection Routes

User routes:

- All user routes are authenticated-only and deny unauthenticated access by default.
- `GET /api/gross-domestic-product/metrics`
- `GET /api/gross-domestic-product/metrics/:metricId`
- `GET /api/gross-domestic-product/dashboard/snapshot`
- `GET /api/gross-domestic-product/rollout/progress`
- `GET /api/gross-domestic-product/scenario/assumptions`

Admin routes:

- `POST /api/gross-domestic-product/admin/metrics/proposals`
- `POST /api/gross-domestic-product/admin/metrics/:metricId/approve`
- `POST /api/gross-domestic-product/admin/snapshots/publish`
- `POST /api/gross-domestic-product/admin/backfill`
- `GET /api/gross-domestic-product/admin/audit-events`

---

## 4) Data Model and Storage Contracts

### 4.1 Canonical Profile and Plugin Extension

Must follow single-profile rule:

1. Reuse canonical user profile for identity and access context.
2. Add plugin extension data linked by `user_id` only where required.
3. Do not introduce a standalone GDP profile duplicating canonical fields.

Planned extension entity:

- `gdp_user_extension`
  - `user_id`
  - display preferences for GDP views,
  - locale/unit preferences,
  - notification preferences for GDP update events.

### 4.2 Domain Entities

Planned domain tables (initial set):

1. `gdp_metric_snapshots`
2. `gdp_category_breakdowns`
3. `gdp_provider_tier_snapshots`
4. `gdp_rollout_targets`
5. `gdp_rollout_actuals`
6. `gdp_metric_definition_events`
7. `gdp_publish_events`

### 4.3 Lifecycle and Storage Constraints

1. Immutable history for published snapshots.
2. Versioned metric definition changes with compatibility notes.
3. Deterministic source links from dashboard tiles to canonical metric IDs.
4. Retention metadata captured per domain entity.
5. Entity retention classes (initial proposal):
  - `gdp_metric_snapshots`: aggregate reporting record, retained per compliance baseline with legal-hold override.
  - `gdp_category_breakdowns`: aggregate reporting record, retained per compliance baseline with suppression metadata.
  - `gdp_provider_tier_snapshots`: higher re-identification-risk aggregate, shorter default retention and stricter access class.
  - `gdp_rollout_targets`: planning/governance record, retained for auditability of commitments.
  - `gdp_rollout_actuals`: aggregate historical accountability record, retained for longitudinal governance.
  - `gdp_metric_definition_events`: immutable governance audit trail; retention aligned to compliance audit minimums.
  - `gdp_publish_events`: immutable publication audit trail; retention aligned to compliance audit minimums.
6. DSAR and deletion handling must align with `ctf/docs/contracts/GDP_PROFILE_AND_DELETION_CONTRACT.md` and plugin-scoped deletion boundaries.

### 4.4 Metrics and Accounting Semantics

1. Account-deletion treasury returns are reserve reallocations and MUST NOT be recognized as GDP.
2. GDP recognition occurs on eligible spend events only, per canonical metric definitions.
3. Reclaim/finalization events from deletion workflows are excluded from GDP numerator calculations and tracked as accounting-state movements.

---

## 5) Security, Privacy, and Compliance Controls

1. Server-side authorization for every command execution.
2. Deny-by-default administrative command access.
3. Mandatory canonical metric check before metric-dependent changes.
4. Audit events for allow + deny decisions on GDP admin commands.
5. No sensitive raw payload values in audit logs.
6. Explicit versioning for breaking metric/schema changes.

### 5.1 Privacy Threat Model and Harm Controls (Required)

1. Re-identification risk is treated as a release-blocking threat for any output with small cells, unique timestamp patterns, or high-dimensional attribute combinations.
2. Secondary harms (targeting by traffickers, stigmatization, legal retaliation, coercion) are first-class safety risks and must be reviewed before any endpoint is enabled.
3. Contributor/source-data provenance is mandatory; no dataset is accepted without attestation of lawful and ethical collection scope.
4. Consent scope and lawful basis must be documented for each GDP processing surface; unresolved lawful-basis metadata blocks release.

### 5.2 Public/Restricted Release Posture (Required)

1. GDP reporting endpoints are authenticated-only in v1; unauthenticated public API access is not permitted.
2. No raw transactional logs, exact event timestamps, precise locations, free-text notes, or small-cell tables are exposed through user-facing views.
3. Region and time are coarsened by default (coarse geographic bins + rolling windows) to reduce singling-out risk.
4. Programmatic access is policy-scoped, rate-limited, and audit-logged with purpose metadata.

### 5.3 Statistical Disclosure Controls (DP-First Baseline)

1. Differential privacy (DP) is the default publication mechanism for sensitive aggregate KPIs, with documented mechanism, epsilon/delta, and budget reset cadence.
2. Minimum cell-size thresholds and suppression rules are mandatory even when DP is applied.
3. Secondary suppression is required where one suppressed cell can be reconstructed from row/column totals.
4. Output transformations include rounding/binning/top-bottom coding where needed to prevent differencing attacks.
5. Any temporary non-DP exception requires written risk acceptance, expiry date, owner, and mitigation plan.

### 5.4 Command-Level Data Protection Matrix (Required)

| Command | Access posture | Data class/output level | Required privacy controls | Required audit event(s) |
| --- | --- | --- | --- | --- |
| `gross-domestic-product.metrics.list` | Authenticated read | Aggregate KPI catalog + metadata | Canonical metric validation, coarse dimensions only, no direct identifiers | `gdp.metrics.list.allowed` / `gdp.metrics.list.denied` |
| `gross-domestic-product.metrics.get` | Authenticated read | Aggregate metric details | DP where sensitive aggregates appear, cell threshold checks, suppression fallback | `gdp.metrics.get.allowed` / `gdp.metrics.get.denied` |
| `gross-domestic-product.dashboard.snapshot.get` | Authenticated read | Dashboard aggregate snapshot | DP-first release path, anti-differencing constraints, coarse region/time bins | `gdp.dashboard.snapshot.get.allowed` / `gdp.dashboard.snapshot.get.denied` |
| `gross-domestic-product.rollout.progress.get` | Authenticated read | Year-level aggregate rollout progress | Minimum cohort thresholds, suppression + secondary suppression, no pinpoint geography | `gdp.rollout.progress.get.allowed` / `gdp.rollout.progress.get.denied` |
| `gross-domestic-product.scenario.assumptions.get` | Authenticated read | Assumption metadata + model notes | No user-level source rows, disclose caveats and uncertainty bounds, no raw contributor identifiers | `gdp.scenario.assumptions.get.allowed` / `gdp.scenario.assumptions.get.denied` |
| `gross-domestic-product.admin.metric.propose` | Restricted admin mutate | KPI definition proposal metadata | Role-gated mutation, provenance attestation, schema validation, canonical metric precheck | `gdp.admin.metric.propose.allowed` / `gdp.admin.metric.propose.denied` |
| `gross-domestic-product.admin.metric.approve` | Restricted admin mutate | KPI approval/activation action | Four-eyes approval policy, immutable audit chain, deny on unresolved lawful basis or consent scope | `gdp.admin.metric.approve.allowed` / `gdp.admin.metric.approve.denied` |
| `gross-domestic-product.admin.snapshot.publish` | Restricted admin mutate | Snapshot publication event | Release gate on DP/suppression pass, policy check, retention tagging, no raw payload in logs | `gdp.admin.snapshot.publish.allowed` / `gdp.admin.snapshot.publish.denied` |
| `gross-domestic-product.admin.backfill.run` | Restricted admin mutate | Historical aggregate recomputation | Controlled execution scope, replay isolation, red-team reviewed before publish exposure | `gdp.admin.backfill.run.allowed` / `gdp.admin.backfill.run.denied` |

### 5.5 Governance and Survivor Safety Review (Required)

1. Conduct adversarial re-identification assessments before each major GDP release and remediate all high-severity findings.
2. Require independent ethics review and survivor-safety consultation checkpoints for high-impact metric changes.
3. Keep dashboard/source code open, while treating raw datasets and high-risk intermediate outputs as controlled data assets.
4. Publish a plain-language privacy risk statement describing controls, limitations, and known residual risk.

---

## 6) Web and Android Parity Plan

1. Core read-only GDP transparency flows are parity-required.
2. Administrative mutation capabilities may ship web-first with tracked Android parity backlog.
3. KPI definitions, semantics, and values must be identical across platforms.
4. Any deferred parity requires owner, due date, and risk note.

---

## 8) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

### 8.1 Release-Blocking Privacy Evidence (Required)

Before GA, evidence artifacts must include:

1. Completed command/access/audit contract parity for all 9 planned commands across:
  - `ctf/docs/contracts/GDP_PLUGIN_COMMAND_CONTRACTS.yaml`
  - `ctf/docs/contracts/GDP_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`
  - `ctf/docs/contracts/GDP_PLUGIN_AUDIT_CONTRACTS.yaml`
2. DP parameter register and publication policy (or formally approved temporary exception with expiry).
3. Cell-threshold + suppression policy with secondary-suppression proof cases.
4. Audit samples showing both allow and deny decisions without sensitive raw payload leakage.
5. Threat-model and red-team re-identification report with remediation closure.
6. Lawful-basis/consent-scope mapping for GDP data classes and processing purposes.
7. DSAR/deletion conformance evidence aligned with `ctf/docs/contracts/GDP_PROFILE_AND_DELETION_CONTRACT.md`.
8. Schema/contract drift check evidence from CI pre-deployment gates.

---

## 9) Gaps, Ambiguities, and Technical Debt (Current)

1. Final ownership assignments for economics metrics are pending.
2. Regional/legal constraints for authenticated cross-region GDP publication and transfer controls need confirmation.
3. Snapshot publication SLA and freeze windows are not finalized.
4. Migration/version strategy for metric definition evolution requires first implementation RFC.
5. Contract parity gaps remain until all 9 planned commands are represented in command/access/audit artifacts.

---

## 10) Change Log

- 2026-02-24: Initial GDP CTF rewrite inventory created.
- 2026-02-25: Added DP-first privacy controls, authenticated-only reporting posture, command-level protection matrix, retention/deletion refinements, and GA privacy evidence blockers.
