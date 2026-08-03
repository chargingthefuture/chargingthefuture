> **SUPERSEDED — kept as history. Do not follow.** This is a 2026-03 dispatch-planning document
> from before the Render migration and the no-phases planning rule. Its infrastructure order
> (Railway/Vercel baselines), phase buckets, and rule-file references (e.g.
> `111-deployment-topology-rules.mdc`, `index.mdc`) are out of date or point at files that no
> longer exist. Current planning guidance lives in `CLAUDE.md`; current infrastructure is Render
> (`render.yaml`) with secrets in Infisical.

# CTF Plugin Background-Agent Assignment Matrix

Date: 2026-03-01

This matrix is designed for dispatching background coding agents using the dependency order in `ctf-plugin-implementation-order.md`.

## Handoff artifact contract (applies to every agent)

Each agent handoff should include:

1. Contracts updated (command/access/audit YAML, or explicit release-gate note if deferred).
2. Migration + schema drift evidence for changed entities.
3. API routes implemented with policy checks and deny taxonomy.
4. Web + Android parity note (delivered/deferred with owner/date).
5. Seed data updates and validation notes.
6. ~~Test evidence summary (unit/integration/manual checklist references).~~ [DEFERRED FOR MVP — see Rule 118.]

## Agent matrix

| Agent                               | Plugin(s)                                          | Start gate                                                                                                    | Primary scope                                                                                                       | Required handoff artifacts                                                                                    |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `agent-bf-01-auth-foundation`       | Baseline auth/web foundation                       | Baseline Phase -1A — start immediately.                                                                       | Provider-neutral auth integration, auth middleware/guards, env contract baseline                                    | Current env mapping by environment; protected-route deny taxonomy; baseline validation evidence               |
| `agent-bf-02-railway-baseline`      | Baseline Railway deployment                        | Baseline Phase -1B — start after BF-01.                                                                       | Railway canonical runtime baseline, runtime config, deploy readiness                                                | Railway deploy evidence; env/secret mapping; runtime health checks                                            |
| `agent-bf-03-vercel-integration`    | Baseline Vercel staging integration                | Baseline Phase -1C — start after BF-02.                                                                       | Vercel frontend staging against Railway backend, env isolation                                                      | Vercel/Railway routing assumptions; auth domain split evidence; staging smoke checks                          |
| `agent-bf-04-expo-baseline`         | Baseline Expo/EAS Android deployment               | Baseline Phase -1D — start after BF-03.                                                                       | Expo build/release baseline and mobile env propagation                                                              | EAS profile/channel readiness; Android preview/production path evidence                                       |
| `agent-bf-01-auth-foundation-v2`    | Baseline auth/web foundation (second pass)         | Baseline Phase -1E — start after BF-01 handoff acceptance.                                                    | Resolve BF-01 residual gaps to production-complete auth baseline                                                    | Delta-vs-handoff closure list; clarify-first Q&A log; no-scaffold completion evidence                         |
| `agent-bf-02-railway-baseline-v2`   | Baseline Railway deployment (second pass)          | Baseline Phase -1F — start after BF-02 handoff acceptance.                                                    | Resolve BF-02 residual deploy/runtime gaps to production-complete Railway baseline                                  | Delta-vs-handoff closure list; clarify-first Q&A log; runtime proof with owner/date for any deferral          |
| `agent-bf-03-vercel-integration-v2` | Baseline Vercel staging integration (second pass)  | Baseline Phase -1G — start after BF-03 handoff acceptance.                                                    | Resolve BF-03 residual staging/env/domain split gaps to production-complete web baseline                            | Delta-vs-handoff closure list; clarify-first Q&A log; end-to-end staging parity proof                         |
| `agent-bf-04-expo-baseline-v2`      | Baseline Expo/EAS Android deployment (second pass) | Baseline Phase -1H — start after BF-04 handoff acceptance.                                                    | Resolve BF-04 residual Android release/env propagation gaps to production-complete mobile baseline                  | Delta-vs-handoff closure list; clarify-first Q&A log; Android preview/production closure evidence             |
| `agent-00-chyme-core`               | `chyme`                                            | Phase 0 — start after BF-01..BF-04 complete.                                                                  | Fresh implementation of room/chat/join/deletion baseline with contracts                                             | Chyme contracts + migration evidence; route/policy/audit proof; seed + parity notes                           |
| `agent-01-taxonomy-core`            | `skills-taxonomy`                                  | Phase 0 — start after BF-01..BF-04 complete.                                                                  | Taxonomy CRUD, hierarchy/flattened read models, dependency-impact preview, destructive safeguards                   | Contract triplet updates; taxonomy migrations; compatibility notes for Directory/Workforce consumers          |
| `agent-02-directory-core`           | `directory`                                        | Phase 0 — start after BF-01..BF-04 complete; align selector contracts with Skills Taxonomy as they stabilize. | Unified user/admin surface, profile + announcements routes, claimed/unclaimed policy guardrails, public projections | Directory migrations; policy/audit evidence; selector compatibility with taxonomy; parity tracking table      |
| `agent-03-feed-announcements`       | `feed` + `announcements`                           | Phase 0 — start after BF-01..BF-04 complete as a combined stream (do not split before contract lock).         | Central `/admin/feed-announcements` surface, feed timeline, announcement lifecycle, membership event flows          | Joint contracts for feed+announcements; fan-out quota note; route ownership proof; release-gate backlog notes |
| `agent-04-workforce`                | `workforce`                                        | Phase 1 — start after Phase 0 Directory contracts/migrations stabilize.                                       | Dashboard/reporting, occupations/admin flows, recruited-state derivation from Directory writes                      | Recruited inference mapping evidence; canonical metric updates; export policy checks; parity notes            |
| `agent-05-skills-hunt`              | `skills-hunt`                                      | Phase 1 — start after Phase 0 Directory policy adapters and ownership lifecycle contracts are stable.         | Round lifecycle, submission moderation, leaderboard/achievements, governed unclaimed Directory profile generation   | Adapter contract to Directory; moderation audit evidence; seed fixtures                                       |
| `agent-06-foundation`               | `foundation`                                       | Phase 1 — start after Phase 0 Directory read-only projections are stable.                                     | Provider discovery using read-only Directory projections, connection/quote/notification flows                       | Read-only boundary validation; no-write-to-Directory proof; rate-limit/capacity policy evidence               |
| `agent-07-lighthouse`               | `lighthouse`                                       | Phase 2 — parallel start after Phase 0 completion.                                                            | Profile/property/match/announcements/blocks parity scope                                                            | Full route contract coverage; host-profile prerequisite flow validation                                       |
| `agent-08-socket-relay`              | `socket-relay`                                      | Phase 2 — parallel start after Phase 0 completion.                                                            | Request/fulfillment/chat/public sharing/admin moderation                                                            | Public DTO privacy validation; CSRF/admin write evidence; lifecycle coverage                                  |
| `agent-09-trusttransport`           | `trusttransport`                                   | Phase 2 — parallel start after Phase 0 completion.                                                            | Ride/package/food request-fulfillment lifecycle, payout and trust/safety controls                                   | Safety policy evidence; dispute/proof contracts; payout and earnings audit trail notes                        |
| `agent-10-peer-programming`         | `peer-programming`                                 | Phase 2 — parallel start after Phase 0 completion.                                                            | Weekly cohort assignment, persistent room/thread model, tiered participation, topic guidance admin                  | Fallback-open behavior evidence; notification retry/idempotency notes                                         |
| `agent-11-mood`                     | `mood`                                             | Phase 2 — parallel start after Phase 0 completion.                                                            | Authenticated mood check + eligibility window with anonymous `clientId` persistence                                 | Cooldown semantics validation; auth + anonymous persistence policy note; parity outcomes                      |
| `agent-12-gentle-pulse`              | `gentle-pulse`                                      | Phase 2 — parallel start after Phase 0 completion.                                                            | Library/favorites/ratings/play endpoints; no in-app admin scope                                                     | Migration/cutover note for anonymous-to-auth model; excluded-scope checks; parity evidence                    |
| `agent-13-weekly-performance`       | `weekly-performance`                               | Phase 2 — parallel start after Phase 0 completion.                                                            | Week-based admin analytics, deterministic week boundaries, comparison/export contracts                              | Metric dictionary lock notes; export gate decision status                                                     |
| `agent-14-gdp`                      | `gross-domestic-product`                           | Phase 3 — start after upstream metric/event semantics are stable from Phases 1 and 2.                         | Aggregate GDP metrics/reporting/admin publish governance                                                            | DP/suppression controls evidence; canonical metric mapping; deletion-accounting exclusion checks              |
| `agent-15-service-credits`          | `service-credits`                                  | Phase 3 — start with/after GDP policy and accounting semantics lock.                                          | Wallet/escrow/transfer/governance/dispute/deletion-reclaim policy flows                                             | Non-GDP reclaim accounting evidence; cross-plugin path validation; ledger adapter controls                    |

## Phase mapping (aligned with task briefs)

- **Phase -1A to -1D (mandatory baseline pass 1):** `agent-bf-01-clerk-foundation`, `agent-bf-02-railway-baseline`, `agent-bf-03-vercel-integration`, `agent-bf-04-expo-baseline`
- **Phase -1E to -1H (mandatory baseline pass 2):** `agent-bf-01-clerk-foundation-v2`, `agent-bf-02-railway-baseline-v2`, `agent-bf-03-vercel-integration-v2`, `agent-bf-04-expo-baseline-v2`
- **Phase 0 (start after baseline):** `agent-00-chyme-core`, `agent-01-taxonomy-core`, `agent-02-directory-core`, `agent-03-feed-announcements`
- **Phase 1 (dependency-gated):** `agent-04-workforce`, `agent-05-skills-hunt`, `agent-06-foundation`
- **Phase 2 (parallel after Phase 0 completion):** `agent-07-lighthouse`, `agent-08-socket-relay`, `agent-09-trusttransport`, `agent-10-peer-programming`, `agent-11-mood`, `agent-12-gentle-pulse`, `agent-13-weekly-performance`
- **Phase 3 (stabilization/finance lock):** `agent-14-gdp`, `agent-15-service-credits`

## Coordination checkpoints

1. **Checkpoint BF (end Phase -1):** Lock baseline auth + deployment assumptions for Clerk, Railway, Vercel, and Expo.
2. **Checkpoint A (end Phase 0):** Lock and publish stable consumer contracts for Chyme, Taxonomy, Directory, and Feed/Announcements.
3. **Checkpoint B (mid Phase 1):** Verify downstream adapters (Workforce, SkillsHunt, Foundation) against frozen upstream contracts.
4. **Checkpoint C (Phase 2 ongoing):** Run shared deny-taxonomy and parity drift checks across independent plugin teams.
5. **Checkpoint D (Phase 3):** Validate finance/accounting semantics between GDP and ServiceCredits before release-candidate cut.

## Dispatch notes

- If you need fewer agents, merge `agent-11-mood` + `agent-12-gentle-pulse` and merge `agent-14-gdp` + `agent-15-service-credits`.
- If you need faster throughput, split `agent-03-feed-announcements` into two agents only after shared admin-surface contract lock is merged.
- Do not dispatch Phase 0+ plugin prompts before the full baseline sequence (Phase -1 pass 1 and pass 2) completes.
- Dispatch policy for every agent: require clarify-first Q&A until requirements are unambiguous, and reject scaffold-only handoffs.

## Dispatch status tracker

Update this table as you launch and receive handoffs.

Status legend:

- `Not started` — not yet dispatched.
- `Dispatched` — prompt sent; waiting for first progress signal.
- `In progress` — active implementation underway.
- `Blocked` — cannot continue without dependency/decision/input.
- `Done` — handoff received and accepted.

| Agent                               | Phase     | Status | Started At | Owner | PR/Branch | Handoff Received |
| ----------------------------------- | --------- | ------ | ---------- | ----- | --------- | ---------------- |
| `agent-bf-01-clerk-foundation`      | Phase -1A | Done   | 2026-03-01 |       |           | Yes              |
| `agent-bf-02-railway-baseline`      | Phase -1B | Done   | 2026-03-01 |       |           | Yes              |
| `agent-bf-03-vercel-integration`    | Phase -1C | Done   | 2026-03-01 |       |           | Yes              |
| `agent-bf-04-expo-baseline`         | Phase -1D | Done   | 2026-03-01 |       |           | Yes              |
| `agent-bf-01-clerk-foundation-v2`   | Phase -1E | Done   | 2026-03-02 |       |           | Yes              |
| `agent-bf-02-railway-baseline-v2`   | Phase -1F | Done   | 2026-03-02 |       |           | Yes              |
| `agent-bf-03-vercel-integration-v2` | Phase -1G | Done   | 2026-03-02 |       |           | Yes              |
| `agent-bf-04-expo-baseline-v2`      | Phase -1H | Done   | 2026-03-02 |       |           | Yes              |
| `agent-00-chyme-core`               | Phase 0   | Done   | 2026-03-02 |       |           | Yes              |
| `agent-01-taxonomy-core`            | Phase 0   | Done   | 2026-03-02 |       |           | Yes              |
| `agent-02-directory-core`           | Phase 0   | Done   | 2026-03-02 |       |           | Yes              |
| `agent-03-feed-announcements`       | Phase 0   | Done   | 2026-03-02 |       |           | Yes              |
| `agent-04-workforce`                | Phase 1   | Done   | 2026-03-03 |       |           | Yes              |
| `agent-05-skills-hunt`              | Phase 1   | Done   | 2026-03-03 |       |           | Yes              |
| `agent-06-foundation`               | Phase 1   | Done   | 2026-03-03 |       |           | Yes              |
| `agent-07-lighthouse`               | Phase 2   | Done   | 2026-03-03 |       |           | Yes              |
| `agent-08-socket-relay`              | Phase 2   | Done   | 2026-03-03 |       |           | Yes              |
| `agent-09-trusttransport`           | Phase 2   | Done   | 2026-03-03 |       |           | Yes              |
| `agent-10-peer-programming`         | Phase 2   | Done   | 2026-03-04 |       |           | Yes              |
| `agent-11-mood`                     | Phase 2   | Done   | 2026-03-04 |       |           | Yes              |
| `agent-12-gentle-pulse`              | Phase 2   | Done   | 2026-03-04 |       |           | Yes              |
| `agent-13-weekly-performance`       | Phase 2   | Done   | 2026-03-04 |       |           | Yes              |
| `agent-14-gdp`                      | Phase 3   | Done   | 2026-03-04 |       |           | Yes              |
| `agent-15-service-credits`          | Phase 3   | Done   | 2026-03-04 |       |           | Yes              |
