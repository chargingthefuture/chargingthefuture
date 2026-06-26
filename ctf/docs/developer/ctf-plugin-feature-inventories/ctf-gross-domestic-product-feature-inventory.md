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

### 2.4 Currency Rate Factor Management (issue #312 P2)

1. Admin-only view of the owner-curated USD factor for every active currency: current factor,
   `as_of` date, and source label, plus the prior factors as history (newest first).
2. Revise action that adds a new dated `currency_usd_rates` row (the latest `as_of` becomes the
   active factor); revising the same day updates that day's row, never overwriting older history.
3. These factors are used ONLY to roll multi-currency volume into the single USD-denominated GDP
   estimate. The surface carries a calm disclaimer that the factors only estimate GDP and are
   never a redemption rate, per-wallet conversion, or the price of ServiceCredits. Currencies are
   shown by their label (e.g. "ServiceCredits", "United States Dollar"), never the bare code as a
   value. United States Dollar is the fixed baseline and is not revisable.
4. Web: `/admin/gdp/rates` (linked from `/admin/gdp`), desktop + mobile-responsive via
   `useIsMobile()`. Android: a GDP Rate Admin screen gated on `user.isAdmin`.

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

Implemented admin routes (currency rate factors, issue #312 P2):

- `GET /api/gdp/admin/currency-rates` — admin-only. For each active currency returns
  `code`, `label`, `symbol`, `isServiceCredits`, `decimalPlaces`, `sortOrder`, its current
  factor (`current`: the latest `as_of` row's `usdRate`, `asOf`, `source`, or `null` when none
  set) and its prior factors (`history`, newest first). Gated by `requireGdpAdminAccess()`.
  Command contract: `admin.currency.rate.list`.
- `POST /api/gdp/admin/currency-rates` — admin-only revise. Body
  `{ currencyCode, usdRate, asOf?, source? }`. Inserts a `currency_usd_rates` row with
  `ON CONFLICT (currency_code, as_of) DO UPDATE`, so revising the same `as_of` date updates that
  row instead of failing the UNIQUE constraint; any other date adds a new history row and leaves
  prior rows intact. `asOf` defaults to today; `source` defaults to `owner`. Validates
  `usdRate > 0` and that `currencyCode` is an active currency. Requires the `x-ctf-csrf: 1`
  header. Audited via `gdp_admin_audit_trail` (`gdp.currency-rate.revise`, allow + deny on
  unknown currency). Command contract: `admin.currency.rate.revise`. LEGAL GUARDRAIL: these
  factors only estimate aggregate GDP — never a per-wallet, per-price, or redemption value.

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

1. `gdp_metric_snapshots` — per-metric weekly snapshot. Carries `is_estimate` (issue #121): TRUE for USD-normalized aggregates such as `gdp_total_revenue`, so the UI can label them estimates. The report read path (`lib/gdp/repository.ts` `mapMetric` and the `GET /api/gdp/report/current` projection) surfaces this flag per metric as `isEstimate`, so the web shell and the Android view render the understated "Estimate" chip plus footnote only where the data is flagged an estimate.
2. `gdp_category_breakdowns`
3. `gdp_provider_tier_snapshots`
4. `gdp_rollout_targets`
5. `gdp_rollout_actuals`
6. `gdp_metric_definition_events`
7. `gdp_publish_events`
8. `currency_usd_rates` — notional USD conversion factor per currency (`currency_code` FK → `currencies.code`, plus `usd_rate`, `as_of`, `source`). Used ONLY by the GDP estimation layer to roll multi-currency transaction volume into the single USD-denominated GDP estimate; the most recent `as_of` per currency is the active rate. LEGAL GUARDRAIL: never surfaced as a per-wallet or per-price "ServiceCredits = fiat" equivalence.
9. `gdp_publications` — the weekly GDP transparency **publication**: the human-authored narrative report (title + summary) that accompanies the metric snapshots, distinct from `gdp_metric_snapshots` (the numbers) and from `gdp_publish_events` (item 7, the immutable publish-audit trail). Columns: `id` UUID PK, `week_start_date` DATE, `title` TEXT, `summary` TEXT, `status` TEXT CHECK (`draft` | `published`), `created_by_user_id` TEXT, `published_by_user_id` TEXT (nullable; set on publish), `published_at` TIMESTAMPTZ (nullable), `updated_at` TIMESTAMPTZ default now, `host_user_id` TEXT (nullable). Written by the admin publication flow (`POST /api/gdp/admin/publications`); `getLatestPublication` (`lib/gdp/repository.ts`) reads the newest `published` row for the public report and the `/admin/gdp` latest-publication panel.

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
  - `gdp_publications`: published transparency-report narrative (aggregate community record, no per-member data); retained per compliance baseline alongside the snapshots it accompanies.
6. DSAR and deletion handling must align with `ctf/docs/contracts/GDP_PROFILE_AND_DELETION_CONTRACT.md` and plugin-scoped deletion boundaries.

### 4.4 Metrics and Accounting Semantics

1. Account-deletion treasury returns are reserve reallocations and MUST NOT be recognized as GDP.
2. GDP recognition occurs on eligible spend events only, per canonical metric definitions.
3. Reclaim/finalization events from deletion workflows are excluded from GDP numerator calculations and tracked as accounting-state movements.
4. Multi-value composition (issue #121): the platform transacts in ServiceCredits, fiat, crypto, barter, and free (one-way mutual aid at no charge). These are combined into ONE relative figure — the **Community Value Index** — via owner-set, non-binding **contribution weights** (`currency_usd_rates`, with USD only as the reference base = 1), applied only in the value layer (`ctf/packages/web/lib/gdp/recognition.ts`). The index is labeled an estimate (`gdp_metric_snapshots.is_estimate`) and is **NOT money**: it is shown with no currency symbol and never as a per-wallet, per-price, exchange, or redemption value for any currency or token (the no-fiat-parity line from issue #120). No value type is "pegged" — ServiceCredits, barter, and free contribute through weights exactly like fiat/crypto, but the output is a community-built index, not dollars. Account-deletion reclaim stays a reserve reallocation per point 1 above — it is not recognized.
5. Recognition pipeline (issue #121 follow-up): `recognizeCommunityValueIndex` (`recognition.ts`) and the `scripts/recognizeGdp.mjs` job (`pnpm gdp:recognize`) fold every registered source's eligible settled value into the single `gdp_value_index` metric ALONGSIDE the projection target — they do not replace it. No currency is converted to dollars or excluded; each value type's raw volume is also returned for the per-type breakdown. Registered sources (owner-approved, one at a time): (a) **TrustTransport** completed-task earnings (`trust_transport_earnings_ledger`, `credit`/`release` entries; fiat/crypto); (b) **LevelUp** trainer payouts for validated mentorship work — governed mint grants with reason `levelup_trainer_split` in `service_credits_governance_events` (ServiceCredits); (c) **Foundation** paid service calls — `SUM(blocks_charged * rate_credits_locked)` ServiceCredits read from `foundation_call_sessions` (a caller paying a provider for a metered 1:1 consultation call; read from Foundation's own per-call record, not the SC transfer ledger); (d) **Direct ServiceCredits transfers** — a member sending another member credits from the "Send Credits" form (peer-to-peer, not tied to any plugin transaction): `SUM(amount)` of `completed` `service_credits_transfers` rows with `origin_plugin = 'service-credits'`; (e) **Chyme peer tips** — the same read with `origin_plugin = 'chyme'` (the tip backend exists but is not yet wired to a UI, so it reads zero until tipping is connected); (f) **SocketRelay completed favors** — mutual aid carries no per-favor price, so each successfully-completed favor (`socket_relay_fulfillments.close_reason = 'successful'`) counts as one `FREE` exchange by count (the standalone SocketRelay SC transfer route is intentionally not also counted, to avoid double-counting a single favor). LevelUp recognition is the trainer-split slice only; learner-side amounts (escrow returns, completion bonuses, stipends, microgrants) are excluded as incentives/returns, not spend, and the SC ledger is not read directly because its mint-grant entries are tagged `accounting_scope = service_credits_non_gdp`. **Barter** and **Free** are first-class value types (`BARTER`/`FREE` in the `currencies` catalog, `requires_amount=false`), each counted by completed-exchange count once a source registers. LightHouse rent and Foundation quote-requests register once they settle a chosen value type on-platform via the shared payment selector (issue #420 / issue #885). **Incentives are never recognized** (owner directive): Skills Hunt accept rewards (`skills_hunt_accept_reward`), Unlock verification incentives (`unlock_quora_verification_approval`), and Contributions thank-you grants (`contributions_confirmed`) are incentive mints and stay excluded. The ServiceCredits ledger is **never blindly summed**: each transfer is attributed to its source by `origin_plugin` and only delivered (`completed`) transfers count, so a genuine peer-to-peer send outside any plugin transaction is recognized (source (d)) while plugin-mediated transfers are attributed to their own plugin without double-counting (Foundation, for example, is counted once via its call-session record, never again via its transfers). A value type with no active contribution weight is surfaced and excluded, never silently treated as zero.
6. Live dashboard read (issue: GDP dashboard activity): `GET /api/gdp/report/current` computes the report **live on every request** via `buildLiveGdpReport` (`lib/gdp/repository.ts`) — there is no weekly publish/snapshot step for the headline figure. It returns live metric rows (`gdp_value_index` = the Community Value Index from `recognizeCommunityValueIndex`; `weekly_active_users`; `total_members`), the per-source contribution breakdown, and an optional owner-written narrative (a standing "live" narrative is synthesized when none is published). The read NEVER writes a snapshot; `gdp_metric_snapshots` and the weekly `scripts/recognizeGdp.mjs` job remain only for optional history, not for what the dashboard shows. Web (`gdp-shell.tsx` → `shapeLiveGdpMetrics` / `shapeSourceSectors`) and Android (`packages/mobile/src/features/gdp`) read the same live payload, so the figure is identical across platforms.

7. LightHouse settled rent source (issue #885): LightHouse is now registered in both `recognition.ts` and `scripts/recognizeGdp.mjs`. It counts only completed `lighthouse_matches` rows with explicit `settlement_currency` and `settled_at`; priced currencies require a positive `settlement_amount`, while amount-less value types such as Free/Barter count one completed exchange. Listing `monthly_rent` remains an asking price and is never recognized by itself.

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

`web+android complete` (pixel-pass delivered). GDP transparency report and admin publications surfaces are shipped on web (`/apps/gdp`) and Android (`packages/mobile/src/features/gdp`). KPI definitions, semantics, and published values are identical across platforms.

Web pixel pass complete: the shell (`gdp-shell.tsx` + `gdp-*` sub-components) is aligned to `design/.../survivor-hub/GDP.tsx` and decomposed within rule-116 limits; per the real-data-only rule it renders sectors/countries/metrics only from `/api/gdp/report/current` and omits the design's mock contribution/live-feed/trend/chat figures.

Android pixel pass complete (2026-05-31): `Gdp.tsx` rewritten to match `design/.../survivor-hub/MobileGDP.tsx` (+ Empty/Loading/Public states) using React Native primitives. Real `api.ts` created, bound exclusively to `GET /api/gdp/report/current`. Metric bindings: `gdp_total_revenue` (hero value) and `weekly_active_users` (active-users chip). Omissions per real-data-only rule: sector breakdown, country breakdown, per-user contribution, weekly trend series, and $300B target progress (none backed by an API field). `MockGdp.tsx` retained as dead code but no longer imported. Export `Gdp` preserved; `App.tsx` unchanged.

Currency rate admin shipped (2026-06-06, issue #312 P2, surface 1): an admin-only screen to view
and revise the owner-curated USD factors used only to roll multi-currency volume into the single
USD-denominated GDP estimate. Web `/admin/gdp/rates` (`components/gdp/gdp-rate-admin.tsx`, desktop +
mobile-responsive via `useIsMobile()`, linked from `/admin/gdp`) and Android (`GdpRateAdmin.tsx` +
`rateAdminApi.ts`, gated on `user.isAdmin`) both bind to `GET`/`POST /api/gdp/admin/currency-rates`.
Matches `design/.../survivor-hub/GDPRateAdmin.tsx` and `MobileGDPRateAdmin.tsx`. The hard legal line
is honored everywhere: a calm disclaimer that these factors only estimate aggregate GDP and are never
a redemption rate, per-wallet conversion, or the price of ServiceCredits; currencies are shown by
label, never as a per-wallet "N ServiceCredits = $X" equivalence.

Estimate treatment shipped (2026-06-06, issue #312 P2): the headline GDP figure and the sidebar USD aggregate now show an understated "Estimate" chip plus a short footnote on web (`gdp-dashboard.tsx` hero — desktop and the mobile-responsive layout — and `gdp-sidebar.tsx` Live Ticker) and Android (`Gdp.tsx` overview hero), driven by the `isEstimate` flag the report projection surfaces off `gdp_metric_snapshots.is_estimate`. The chip/footnote render only where the data is flagged an estimate. Copy describes a community-wide normalized USD estimate (a morale/transparency metric, not a ledger), never a per-user redemption value, honoring the no-fiat-parity line.

World map shipped (2026-06-07): the "Map" tab now renders a real inline-SVG world map instead of the "coming soon" stub. Web `components/gdp/gdp-world-map.tsx` draws simplified continent silhouettes on a 1000x500 canvas (no mapping dependency) and overlays the real community-wide aggregates read by key from `/api/gdp/report/current` (`gdp_total_revenue`, `weekly_active_users`); `gdp-map.tsx` is the thin data binder and `gdp-shell.tsx` threads the raw metric rows through. Android `Gdp.tsx` Home tab renders an equivalent static, View-based map (no SVG dependency) with the same real aggregate overlay. Per the real-data-only rule there is NO per-country GDP table, so every region renders in one neutral cyan "unpopulated" state and no per-country figures are invented; the map shows an honest empty caption when no report is published. Desktop, mobile-responsive, and Android all bind to the same aggregates. No schema/route/contract change.

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

- 2026-06-27: Registered LightHouse settled rent as a Community Value Index source (issue #885). Live GDP recognition and the weekly `recognizeGdp.mjs` job now read completed `lighthouse_matches` settlement fields, joining `currencies.requires_amount` so priced currencies sum positive `settlement_amount` and amount-less value types count one completed exchange. Listing `monthly_rent` is explicitly excluded.

- 2026-06-25: **Documented the `gdp_publications` table** (inventory-debt burn-down — documentation catch-up, no code change). Added `gdp_publications` (the weekly narrative transparency report — draft/published, written by `POST /api/gdp/admin/publications`, read by `getLatestPublication`) as item 9 in §4.2 Domain Entities, with a matching retention-class line in §4.3. It was referenced in prose (the admin publication flow) but missing from the entity list. Verified against `schema.sql` and `lib/gdp/repository.ts`. Removed `gdp_publications` from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/gdp` page with `components/gdp/gdp-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, latest-publication stat blocks, a weekly-publication form, and a link to the existing Currency Rate admin). Bound to the real backend — `getLatestPublication` — and the real `POST /api/gdp/admin/publications` endpoint (with `x-ctf-csrf: '1'`) to save a draft or publish a weekly report. The legal-approval gate is surfaced in the form and still enforced server-side (publishing without it is denied). No mockup exists for this admin surface, so it follows the established admin design system over real data (rule 131). No new endpoint, schema, or contract.
- 2026-06-12: The Android GDP API clients (`api.ts`, `rateAdminApi.ts`) now use the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing plain fetch calls against hardcoded development URLs; the optional hand-passed token parameter on the report fetcher was removed. No schema, route, or contract change.
- 2026-06-12: Added **Free** as a value type (one-way mutual aid at no charge). `FREE` row in the `currencies` catalog (`kind=free`, `requires_amount=false`; the `kind` check widened to allow `free`), a non-binding contribution weight in `seedCurrencyUsdRates.mjs`, and `CurrencyKind` extended on web and mobile. Like barter, free is counted in the Community Value Index by completed-exchange count (never a fiat amount), so mutual aid still counts toward the community economy. The shared payment selector shows it automatically (it reads the catalog live); the per-plugin create forms hide the amount input when the selected type carries no amount (`requires_amount=false`). No source is wired yet — free/barter exchanges register once a plugin settles them on-platform (issue #420).
- 2026-06-11: Reframed the recognized figure as the non-fiat **Community Value Index** and registered LevelUp as a source (owner-approved). (1) `recognition.ts` (`recognizeCommunityValueIndex`) and `scripts/recognizeGdp.mjs` fold every value type — fiat, crypto, ServiceCredits, barter — into ONE relative figure via owner-set, non-binding contribution weights (`currency_usd_rates`, USD = reference base 1); no currency is converted to dollars or excluded. The job writes a single `gdp_value_index` metric (replacing the earlier `gdp_recognized_volume_usd`/`_sc` pair); `canonical_metrics.yaml` registers it. (2) Sources: **TrustTransport** completed-task earnings (fiat/crypto) and **LevelUp** trainer payouts (`levelup_trainer_split` mint grants, ServiceCredits; trainer-split slice only, reading governance events not the `service_credits_non_gdp`-tagged ledger). (3) **Barter** added to the `currencies` catalog (`kind=barter`, `requires_amount=false`) so it is selectable and counted by completed-trade count. (4) `seedCurrencyUsdRates.mjs` rows reframed as contribution weights (SC re-added, BARTER added); `seedGdp.mjs` seeds a demo `gdp_value_index`. (5) UI: the GDP map overlay headline (web `gdp-world-map.tsx`/`gdp-map.tsx`, Android `Gdp.tsx`) is the Community Value Index, shown with **no currency symbol** and a one-source disclaimer that it is a relative index — not money, a price, or a redemption value for any token. `gdp-map.tsx` drops differential-privacy-suppressed rows before reading. Plugin stays named "GDP". LightHouse/SocketRelay/Foundation register as sources once they settle a chosen-currency amount on-platform via the shared payment selector (issue #420). No schema change beyond the `BARTER` catalog row; reuses `gdp_metric_snapshots`.
- 2026-06-07: GDP world map shipped. Replaced the `gdp-map.tsx` "World Map — coming soon" stub with a real inline-SVG world map. Web: new `components/gdp/gdp-world-map.tsx` (simplified continent silhouettes on a 1000x500 equirectangular canvas, no mapping dependency, region tooltips, subtle pulse markers); `gdp-map.tsx` rewritten as a thin binder that reads the real community-wide aggregates by metric key (`gdp_total_revenue`, `weekly_active_users`) and overlays them; `gdp-shell.tsx` now keeps the raw metric rows in state and threads them to the map; shared helpers (`formatGdpUsd`, `formatGdpCount`, `pickGdpMetricValue`, `GDP_ACTIVE_MEMBERS_METRIC_KEY`) added to `gdp-shared.ts`. Android: `Gdp.tsx` Home tab now renders an equivalent static, View-based map with the same aggregate overlay (no SVG dependency added). Per the real-data-only rule, the GDP module has no per-country table, so regions render in one neutral cyan state and no per-country values are fabricated; an honest empty caption shows when no report is published. No new dependency, no schema/route/contract change. Desktop + mobile-responsive + Android.
- 2026-06-06: GDP currency rate admin shipped (issue #312, prompt P2, surface 1). New admin-only
  endpoints `GET`/`POST /api/gdp/admin/currency-rates` (`app/api/gdp/admin/currency-rates/route.ts`),
  gated by `requireGdpAdminAccess()` with the GDP CSRF helper (`x-ctf-csrf: 1`) on the mutation.
  `GET` returns each active currency with its current factor (latest `as_of`) and history (older
  rows, newest first); `POST` revises by inserting a `currency_usd_rates` row with
  `ON CONFLICT (currency_code, as_of) DO UPDATE` (same-day revise updates that row, preserving older
  history; latest `as_of` stays active), `asOf` defaulting to today and `source` to `owner`,
  validating `usdRate > 0` and that the currency exists. DB work added to `lib/gdp/repository.ts`
  (`listCurrencyRateAdmin`, `currencyExists`, `upsertCurrencyUsdRate`); audited via
  `gdp_admin_audit_trail` (`gdp.currency-rate.revise`). Web: `components/gdp/gdp-rate-admin.tsx`
  client surface + `/admin/gdp/rates` page (admin-gated, linked from `/admin/gdp`), desktop and
  mobile-responsive (`useIsMobile()`), states loading/empty/populated/saved, bound to the GET (no stub
  data). Android: `packages/mobile/src/features/gdp/GdpRateAdmin.tsx` + `rateAdminApi.ts`, gated on
  `user.isAdmin`, registered in `App.tsx`. Command + access-policy contracts added
  (`admin.currency.rate.list`, `admin.currency.rate.revise`). Matches `GDPRateAdmin.tsx` /
  `MobileGDPRateAdmin.tsx`. No schema change (`currency_usd_rates` already existed). LEGAL HARD LINE:
  these factors only estimate aggregate GDP — never a per-wallet, per-price, or redemption
  "ServiceCredits = fiat" value; currencies are shown by label. Mockup control omitted for lack of
  backend: the mockup's editable `as_of` field is not exposed in the revise form (the endpoint accepts
  an optional `asOf` but the UI always revises as of today, matching the "new dated row with today's
  date" copy); no other controls omitted.
- 2026-06-06: GDP "Estimate" treatment shipped (issue #312, prompt P2). Surfaced the existing `gdp_metric_snapshots.is_estimate` flag through the report read path: `lib/gdp/repository.ts` `mapMetric` now selects and maps `is_estimate` → `isEstimate`, and `GET /api/gdp/report/current` returns it per metric. Web (`gdp-shell.tsx` derives the headline-metric estimate flag; `gdp-dashboard.tsx` hero and `gdp-sidebar.tsx` Live Ticker render an understated "Estimate" chip + footnote on the GDP/USD-aggregate figures, desktop and mobile-responsive) and Android (`Gdp.tsx` overview hero + `api.ts` `pickMetricIsEstimate`) now show the chip/footnote only where the data is flagged an estimate, matching `design/.../survivor-hub/GDP.tsx`, `GDPPublic.tsx`, `MobileGDP.tsx`, `MobileGDPPublic.tsx`. Copy reads as a community-wide normalized USD estimate (a morale/transparency metric, not a ledger or redemption value); the ServiceCredits→USD factor stays confined to the aggregate, never a per-wallet/per-price fiat equivalence. No schema change (the column already existed). Read-only projection change, not design-gated.
- 2026-06-01: GDP recognition pipeline (issue #121 follow-up): added an extensible source registry in `recognition.ts` (`RecognitionSource` + `recognizeGdpVolumeUsd`) and the `scripts/recognizeGdp.mjs` rollup job (`pnpm gdp:recognize`) that recognizes actual multi-currency volume into the `gdp_recognized_volume_usd` estimate metric, ALONGSIDE the projection target. First source: TrustTransport completed-task earnings (`credit`/`release`), normalized via `currency_usd_rates`; other plugins register as the owner approves them. Registered the metric in `canonical_metrics.yaml`. The rate-admin screen and the in-product "estimate" label stay design-gated (no mockup yet); their design brief is handed to the owner directly rather than committed (prompts are one-time, not kept in the repo). No schema change (reuses `gdp_metric_snapshots` + `currency_usd_rates`).
- 2026-06-01: Multi-currency recognition foundation (issue #121): added the `currency_usd_rates` table (notional USD factor per currency, FK → `currencies.code`, with `as_of`) + `seedCurrencyUsdRates.mjs`; an `is_estimate` flag on `gdp_metric_snapshots`; and the GDP estimation-layer helper `ctf/packages/web/lib/gdp/recognition.ts` that rolls multi-currency volume into one USD estimate (the FX factor lives only here, never a per-wallet/per-price parity). Seeded `gdp_total_revenue` as an estimate. Documented the model and the no-fiat-parity guardrail; reconciled with the account-deletion-reclaim non-recognition rule (§4.4). The live automated rollup across plugin transaction tables, the admin rate-management UI, and the in-product estimate label remain next steps (the last two are design-gated).
- 2026-05-31: Android pixel pass — rewrote `Gdp.tsx` to match `MobileGDP.tsx` / `MobileGDPEmpty.tsx` / `MobileGDPLoading.tsx` / `MobileGDPPublic.tsx` design mockups using React Native primitives (exact colors, spacing, type, layout). Created real `api.ts` bound to `GET /api/gdp/report/current`. Real metric bindings: `gdp_total_revenue` (hero), `weekly_active_users` (chip). Omissions per real-data-only rule: sector breakdown, country breakdown, per-user contribution, weekly trend series, $300B target progress. Loading/empty/public/error states all covered. MockGdp.tsx retained as dead file (no import). No schema/route/contract changes.
- 2026-05-31: Seed runtime fix. `seedGdp.mjs` now opens its own `pg` Pool and defines a local `queryDb` helper instead of importing the TypeScript `packages/web/lib/db/postgres.ts`, which plain Node (e.g. the Node 20 seed/provision workflows) cannot load. Added `pool.end()` teardown. No change to seeded rows, schema, or API.
- 2026-05-30: Web pixel pass — aligned the shell to `design/.../survivor-hub/GDP.tsx` and decomposed the 210-line / complexity-29 monolith into modular sub-components (`gdp-shared.ts`, `gdp-loading.tsx`, `gdp-icon-rail`, `gdp-sidebar`, `gdp-dashboard` with Hero/Sectors/Countries, `gdp-map`, thin shell) within rule-116 limits. Added a real loading splash and aria-labels on the icon-only rail buttons; removed the sidebar's "By Phase" filter (a banned term absent from the design mockup). Per real-data-only, all figures derive from `/api/gdp/report/current`; the design's mock contribution/live-feed/trend/chat content stays omitted. Dropped the unused `isAdmin` prop at the call site. No schema/route/contract changes.
- 2026-05-18: Replaced "Web and Android Parity Plan" with canonical "Web and Android Delivery Status" (`web+android complete`); removed web-first/Android-backlog language. Promoted "Release-Blocking Privacy Evidence" subsection to its own section 7 (these are ongoing artifacts, not pre-release blockers). Renamed "Gaps, Ambiguities, and Technical Debt (Current)" to canonical "Gaps and Known Technical Debt"; removed planning-only entries.
- 2026-02-25: Added DP-first privacy controls, authenticated-only reporting posture, command-level protection matrix, retention/deletion refinements, and privacy evidence artifacts.
- 2026-02-24: Initial GDP CTF rewrite inventory created.


## Build Checklist

> **Reconciliation (2026-05-26):** the Delivery Status above is `web+android complete` (feature parity).
> Unchecked items below are obsolete web-first / Android-deferral planning artifacts and deferred MVP
> validation/release gates (Rule 118) — not missing implementation. The authoritative production bar
> (pixel-perfect to `design` + parity + gates + deploy) is tracked in
> `ctf/docs/developer/PRODUCTION_READINESS_PLAN.md`, which wins where it differs from this checklist.

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

### �� Contract Lock

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

### �� Metrics Registry and Model Definition

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

### �� Schema and Migration Planning

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

### �� API and Command Execution Planning

- [ ] Define public read command projections.
  - Acceptance criteria:
    - Dashboard snapshot, metric list/detail, and rollout-progress retrieval contracts are deterministic.
- [ ] Define admin mutation command projections.
  - Acceptance criteria:
    - Metric propose/approve, snapshot publish, and backfill commands enforce policy and audit.
- [ ] Define failure and fallback schema behavior.
  - Acceptance criteria:
    - Fallback payloads match declared contracts and avoid schema drift.

### �� Web Delivery Planning

- [ ] Plan public GDP dashboard surfaces.
  - Acceptance criteria:
    - Total/per-capita/category/tier/rollout views included with canonical metric references.
- [ ] Plan admin governance surfaces.
  - Acceptance criteria:
    - Metric proposal/review/publish operations are role-gated and auditable.
- [ ] Plan data quality and trust cues.
  - Acceptance criteria:
    - Freshness, ownership, and formula context visible to users.

### �� Android Delivery Planning

- [ ] Plan critical path parity for survivor-facing GDP transparency.
  - Acceptance criteria:
    - Android displays equivalent KPI semantics and outcomes to web.
- [ ] Plan parity closure for deferred admin capabilities.
  - Acceptance criteria:
    - Deferrals tracked with owner, due date, and risk notes.

### �� Compliance, Hardening, and Operations

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
