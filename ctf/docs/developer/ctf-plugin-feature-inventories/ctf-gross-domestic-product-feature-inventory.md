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

Command groups:

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

Extension entity:

- `gdp_user_extension`
  - `user_id`
  - display preferences for GDP views,
  - locale/unit preferences,
  - notification preferences for GDP update events.

### 4.2 Domain Entities

Domain tables:

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

## 6) Web and Android Delivery Status

`web+android complete`. GDP transparency report and admin publications surfaces are shipped on web (`/apps/gdp`) and Android (`packages/mobile/src/features/gdp`). KPI definitions, semantics, and published values are identical across platforms.

---

## 7) Privacy Evidence Artifacts (Required)

Each major GDP release maintains:

1. Command/access/audit contract parity across `ctf/docs/contracts/GDP_PLUGIN_COMMAND_CONTRACTS.yaml`, `GDP_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`, and `GDP_PLUGIN_AUDIT_CONTRACTS.yaml`.
2. DP parameter register and publication policy (or formally approved temporary exception with expiry).
3. Cell-threshold + suppression policy with secondary-suppression proof cases.
4. Audit samples showing both allow and deny decisions without sensitive raw payload leakage.
5. Threat-model and red-team re-identification report with remediation closure.
6. Lawful-basis/consent-scope mapping for GDP data classes and processing purposes.
7. DSAR/deletion conformance evidence aligned with `ctf/docs/contracts/GDP_PROFILE_AND_DELETION_CONTRACT.md`.
8. Schema/contract drift check evidence from CI pre-deployment gates.

---

## 8) Seed Coverage Status

GDP draws aggregated values from upstream plugin schemas; no dedicated seed script is required. Local validation runs against upstream seed outputs and snapshot fixtures committed under `ctf/docs/contracts/`.

---

## 9) Gaps and Known Technical Debt

1. Ownership assignments for economics metrics are documented in contracts but not surfaced in a single roster page.
2. Regional/legal constraints for authenticated cross-region GDP publication are governed by platform defaults; a plugin-specific transfer-control contract has not been finalized.
3. Snapshot publication SLA and freeze windows follow operational best-effort; an explicit SLA document has not been published.

---

## 10) Change Log

- 2026-05-18: Replaced "Web and Android Parity Plan" with canonical "Web and Android Delivery Status" (`web+android complete`); removed web-first/Android-backlog language. Promoted "Release-Blocking Privacy Evidence" subsection to its own section 7 (these are ongoing artifacts, not pre-release blockers). Renamed "Gaps, Ambiguities, and Technical Debt (Current)" to canonical "Gaps and Known Technical Debt"; removed planning-only entries.
- 2026-02-25: Added DP-first privacy controls, authenticated-only reporting posture, command-level protection matrix, retention/deletion refinements, and privacy evidence artifacts.
- 2026-02-24: Initial GDP CTF rewrite inventory created.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No code changes required in `platform/`.
- [ ] Confirm GDP plugin ID and command namespace.
  - Acceptance criteria:
    - Stable plugin ID `gross-domestic-product` approved.
- [ ] Confirm phased parity policy (web then Android completion before GA).
  - Acceptance criteria:
    - Core survivor-facing transparency flows marked parity-required.

### Phase 0 — Contract Lock

- [ ] Define GDP plugin command contracts for v1.
  - Acceptance criteria:
    - Every command includes required fields from `201-plugin-command-schema-template.mdc`.
- [ ] Define access policy contracts for v1 GDP commands.
  - Acceptance criteria:
    - Every command includes roles, attribute checks, consent/legal basis, and deny conditions from `202-plugin-access-policy-schema-template.mdc`.
- [ ] Define audit event contracts for v1 GDP commands.
  - Acceptance criteria:
    - Every command logs allow/deny + result using `203-plugin-audit-schema-template.mdc`.
- [ ] Resolve open governance and publication policy decisions.
  - Acceptance criteria:
    - Metric ownership, publish cadence, correction policy, and public disclosure controls approved.

### Phase 1 — Metrics Registry and Model Definition

- [ ] Add canonical GDP metric definitions to `ctf/config/canonical_metrics.yaml`.
  - Acceptance criteria:
    - Full model fields included with required MDC fields (`id`, `name`, `description`, `owner`, `data_type`, `unit`, `calculation`, `inputs`, `example_values`, `last_updated`).
- [ ] Define service category split metrics and provider-tier metrics.
  - Acceptance criteria:
    - Category and tier metrics map to baseline GDP model assumptions and formulas.
- [ ] Define rollout target metrics for years 0–5.
  - Acceptance criteria:
    - Target and actual metrics are versioned and comparable by year.
- [ ] Confirm metric naming/versioning policy.
  - Acceptance criteria:
    - Aliases and deprecations are documented; ambiguous names avoided.

### Phase 2 — Schema and Migration Planning

- [ ] Design GDP extension model on canonical profile.
  - Acceptance criteria:
    - No duplicate standalone profile table; extension keyed by `user_id`.
- [ ] Define GDP snapshot and governance domain tables.
  - Acceptance criteria:
    - Snapshot, breakdown, tier, target/actual, and publish/audit entities are specified.
- [ ] Prepare migration strategy under `ctf/migrations/`.
  - Acceptance criteria:
    - Replay and rollback strategy documented before implementation.
- [ ] Define retention classes per entity.
  - Acceptance criteria:
    - Retention metadata is explicit for snapshots, events, and governance records.

### Phase 3 — API and Command Execution Planning

- [ ] Define public read command projections.
  - Acceptance criteria:
    - Dashboard snapshot, metric list/detail, and rollout-progress retrieval contracts are deterministic.
- [ ] Define admin mutation command projections.
  - Acceptance criteria:
    - Metric propose/approve, snapshot publish, and backfill commands enforce policy and audit.
- [ ] Define failure and fallback schema behavior.
  - Acceptance criteria:
    - Fallback payloads match declared contracts and avoid schema drift.

### Phase 4 — Web Delivery Planning

- [ ] Plan public GDP dashboard surfaces.
  - Acceptance criteria:
    - Total/per-capita/category/tier/rollout views included with canonical metric references.
- [ ] Plan admin governance surfaces.
  - Acceptance criteria:
    - Metric proposal/review/publish operations are role-gated and auditable.
- [ ] Plan data quality and trust cues.
  - Acceptance criteria:
    - Freshness, ownership, and formula context visible to users.

### Phase 5 — Android Delivery Planning

- [ ] Plan critical path parity for survivor-facing GDP transparency.
  - Acceptance criteria:
    - Android displays equivalent KPI semantics and outcomes to web.
- [ ] Plan parity closure for deferred admin capabilities.
  - Acceptance criteria:
    - Deferrals tracked with owner, due date, and risk notes.

### Phase 6 — Compliance, Hardening, and Operations

- [ ] Define observability and error-budget requirements.
  - Acceptance criteria:
    - Key GDP command latency/error/failure metrics are measurable.
- [ ] Define correction and republishing governance.
  - Acceptance criteria:
    - Historical corrections preserve immutable history and audit linkage.
- [ ] Define plugin-scoped and full-account deletion behavior.
  - Acceptance criteria:
    - GDP extension and domain data deletion contracts are documented and policy-aligned.

### Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command schema design documentation.
  - Acceptance criteria:
    - Unknown fields/invalid types/bounds failures handling is documented.
- [ ] Access policy enforcement design documentation.
  - Acceptance criteria:
    - Unauthorized role and deny-condition scenarios are documented.
- [ ] Audit integrity design documentation.
  - Acceptance criteria:
    - Allow + deny events append-only and correlation fields documentation.
- [ ] Snapshot and model rollup design documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Core read/mutate paths determinism requirements are documented.
- [ ] Schema drift predeployment checks.
  - Acceptance criteria:
    - Drift checks documented with required schema-drift evidence.

### Documentation and Inventory Lifecycle

- [ ] Keep `ctf-gross-domestic-product-feature-inventory.md` updated per accepted scope change.
  - Acceptance criteria:
    - Any add/remove/behavioral change updates inventory in same PR.
- [ ] Record deprecations/removals in inventory changelog.
  - Acceptance criteria:
    - Removed features are moved to dated changelog entries.
- [ ] Implementation tracking. [EVIDENCE COLLECTION DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; evidence collection deferred to post-MVP.

### Open Decisions Tracker

- [ ] Final owner teams for economics and platform metric governance.
- [ ] Public disclosure policy for sensitive regional breakdowns.
- [ ] Backfill/late-data correction SLA and approval workflow.
- [ ] Versioning strategy for canonical metric formula changes.
- [ ] GA criteria for parity closure across web and Android.
