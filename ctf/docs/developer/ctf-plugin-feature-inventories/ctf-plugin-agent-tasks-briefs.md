> **SUPERSEDED — kept as history. Do not follow.** This is a 2026-03 dispatch-planning document
> from before the Render migration and the no-phases planning rule. Its infrastructure order
> (Railway/Vercel baselines), phase buckets, and rule-file references (e.g.
> `111-deployment-topology-rules.mdc`, `index.mdc`) are out of date or point at files that no
> longer exist. Current planning guidance lives in `CLAUDE.md`; current infrastructure is Render
> (`render.yaml`) with secrets in Infisical.

# CTF Plugin Agent Task Briefs (Copy-Paste Prompts)

Date: 2026-03-01

Use these prompts to dispatch background agents.

Dispatch note:

- This repository is a fresh-start rewrite from boilerplate. Do not assume prior plugin implementation exists unless explicitly stated in a prompt.
- Baseline foundation prompts are mandatory before broad plugin parallelization.
- Required baseline order: auth integration → Railway deployment baseline → Vercel deployment integration → Expo deployment baseline.
- Mandatory for every prompt in this document: before implementation, the agent must ask clarifying questions until requirements are unambiguous, wait for answers, and then proceed.
- Mandatory for every prompt in this document: scaffold-only output is not acceptable; agent must either deliver completion-grade implementation evidence or provide an explicit blocked-by list with owner and date.
- Completion-status reconciliation rule: before marking any phase complete, verify both handoff docs and assignment matrix status are aligned; if they differ, mark as "needs reconciliation" and resolve before next dispatch.

---

## Prompt BF-01 — `agent-bf-01-auth-foundation`

```text
Read this first: #file:index.mdc
Then read:
- #file:.claude/rules/107-integration-stack-rules.mdc
- #file:.claude/rules/111-deployment-topology-rules.mdc
- #file:.claude/rules/123-environment-configuration-rules.mdc
- #file:.claude/rules/103-web-nextjs-structure-rules.mdc
- #file:ctf/README.md

You are `agent-bf-01-auth-foundation` working only under `ctf/`.
Start gate:
- Baseline Phase -1A — start immediately.

Scope:
- Implement a provider-neutral auth baseline for web (App Router structure + server-side authz checks) while preserving the current env contract.
- Establish deterministic environment contract documentation for local, Railway staging/production, and Vercel staging frontend integration.
- Ensure protected route policy behavior and deny taxonomy are documented for plugin routes to consume.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Environment/auth constraints in Rule 123; do not rename env variables without explicit approval.

Deliverables:
1) Clerk foundation integration notes + env contract updates
2) Web auth middleware/server-side guardrails evidence
3) Deny taxonomy baseline for unauthorized/forbidden scenarios
4) CI/config notes for Clerk-dependent checks
5) Validation evidence (manual + automated where available)

Handoff output:
- List changed files
- Clerk domain/key assumptions by environment
- Open auth decisions/blockers
```

## Prompt BF-02 — `agent-bf-02-railway-baseline`

```text
Read this first: #file:index.mdc
Then read:
- #file:.claude/rules/111-deployment-topology-rules.mdc
- #file:.claude/rules/123-environment-configuration-rules.mdc
- #file:.claude/rules/119-github-actions-ci-rules.mdc
- #file:ctf/railway.toml

You are `agent-bf-02-railway-baseline` working only under `ctf/`.
Start gate:
- Baseline Phase -1B — start after BF-01 Clerk foundation is complete.

Scope:
- Establish Railway as canonical full-stack runtime baseline (frontend + backend path for CTF).
- Validate build/start/runtime expectations, environment injection, and health-check/deploy readiness.
- Produce deployment evidence that downstream plugin agents can rely on.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Deployment topology constraints from Rule 111 and env constraints from Rule 123.

Deliverables:
1) Railway baseline deployment/config updates
2) Runtime environment and secrets mapping evidence
3) CI/deploy pipeline alignment notes
4) Known gaps/blockers with owner recommendation
5) Validation evidence (logs/checks/screens)

Handoff output:
- List changed files
- Railway deployment assumptions and unresolved risks
- What plugin teams can now assume as stable
```

## Prompt BF-03 — `agent-bf-03-vercel-integration`

```text
Read this first: #file:index.mdc
Then read:
- #file:.claude/rules/111-deployment-topology-rules.mdc
- #file:.claude/rules/123-environment-configuration-rules.mdc
- #file:.claude/rules/119-github-actions-ci-rules.mdc
- #file:ctf/packages/web/vercel.json

You are `agent-bf-03-vercel-integration` working only under `ctf/`.
Start gate:
- Baseline Phase -1C — start after BF-02 Railway baseline is complete.

Scope:
- Implement Vercel staging frontend integration against Railway-backed APIs.
- Validate environment isolation and Clerk domain/key separation for Vercel staging.
- Ensure deployment docs and route/proxy assumptions are explicit for plugin teams.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Keep backend runtime canonical on Railway and avoid Vercel backend drift.

Deliverables:
1) Vercel staging integration/config updates
2) Clerk + env isolation validation notes
3) API origin/routing assumptions documentation
4) CI/staging check updates
5) Validation evidence (preview + smoke checks)

Handoff output:
- List changed files
- Vercel-to-Railway integration decisions
- Remaining staging risks
```

## Prompt BF-04 — `agent-bf-04-expo-baseline`

```text
Read this first: #file:index.mdc
Then read:
- #file:.claude/rules/104-mobile-react-native-android-rules.mdc
- #file:.claude/rules/106-expo-eas-mobile-workflow-rules.mdc
- #file:.claude/rules/111-deployment-topology-rules.mdc
- #file:.claude/rules/123-environment-configuration-rules.mdc
- #file:.claude/rules/119-github-actions-ci-rules.mdc
- #file:ctf/docs/mobile/EXPO_CLOUD_WORKFLOW.md

You are `agent-bf-04-expo-baseline` working only under `ctf/`.
Start gate:
- Baseline Phase -1D — start after BF-03 Vercel integration is complete.

Scope:
- Establish Expo/EAS Android deployment baseline (preview + production profile readiness).
- Validate env propagation and endpoint/domain contracts for mobile clients.
- Produce baseline parity and release workflow evidence for later plugin mobile parity work.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Expo channel/profile governance and CI requirements.

Deliverables:
1) Expo/EAS baseline config + workflow updates
2) Android build profile and release-path notes
3) Mobile env contract alignment with Railway/Vercel/Clerk
4) CI pipeline or manual workflow alignment notes
5) Validation evidence (preview/build/test runs)

Handoff output:
- List changed files
- Expo deployment assumptions and remaining blockers
- What mobile/plugin teams can treat as stable baseline
```

## Prompt 00 — `agent-00-chyme-core`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-chyme-feature-inventory.md
- #file:ctf/docs/contracts/CHYME_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/CHYME_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/CHYME_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/CHYME_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-00-chyme-core` working only under `ctf/`.
Start gate:
- Phase 0 — start after baseline phases BF-01 through BF-04 are complete.

Scope:
- Implement `chyme` plugin core capabilities from fresh start (room bootstrap, chat read/send, join flow, and deletion behavior).
- Deliver initial web implementation with policy/audit guardrails and migration-backed persistence.
- Capture explicit parity deferment or Android parity implementation evidence.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Plugin command/access/audit templates (201/202/203).

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) API + policy + audit coverage
4) Seed fixtures + deterministic validation notes
5) Test/manual validation evidence (or blocked-by list)

Handoff output:
- List changed files
- Contract and route decisions
- Open gaps/debt with owner recommendation
```

## Prompt 01 — `agent-01-taxonomy-core`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-skills-taxonomy-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-skills-taxonomy-feature-inventory.md
- #file:ctf/docs/contracts/SKILLS_TAXONOMY_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/SKILLS_TAXONOMY_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/SKILLS_TAXONOMY_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/SKILLS_TAXONOMY_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-01-taxonomy-core` working only under `ctf/`.
Start gate:
- Phase 0 — start after baseline phases BF-01 through BF-04 are complete.

Scope:
- Implement `skills-taxonomy` plugin core capabilities.
- Deliver hierarchy + flattened read models, CRUD for sectors/job-titles/skills, dependency-impact preview, and destructive-action safeguards.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Plugin command/access/audit templates (201/202/203).

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) API + policy enforcement
4) Seed fixtures
5) Test evidence

Handoff output:
- List changed files
- Contract decisions and any open risks
- Compatibility notes for Directory and Workforce consumers
```

## Prompt 02 — `agent-02-directory-core`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-directory-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-directory-feature-inventory.md
- #file:ctf/docs/contracts/DIRECTORY_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/DIRECTORY_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/DIRECTORY_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/DIRECTORY_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-02-directory-core` working only under `ctf/`.
Start gate:
- Phase 0 — start after baseline phases BF-01 through BF-04 are complete; align selector contracts with Skills Taxonomy as they stabilize.

Scope:
- Implement `directory` unified user/admin surface with role-gated controls.
- Implement profile + announcements routes, public projection routes, and claimed/unclaimed policy guardrails.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Single-profile/plugin-extension boundaries.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) Policy/audit enforcement on write paths
4) Seed updates + parity notes
5) Test evidence

Handoff output:
- List changed files
- Selector compatibility notes with skills-taxonomy
- Any unresolved policy decisions
```

## Prompt 03 — `agent-03-feed-announcements`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-feed-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-announcements-feature-inventory.md
- #file:ctf/docs/contracts/FEED_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/FEED_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/FEED_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/FEED_PROFILE_AND_DELETION_CONTRACT.md
- #file:ctf/docs/contracts/ANNOUNCEMENTS_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/ANNOUNCEMENTS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/ANNOUNCEMENTS_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/ANNOUNCEMENTS_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-03-feed-announcements` working only under `ctf/`.
Start gate:
- Phase 0 — start after baseline phases BF-01 through BF-04 are complete, as a combined stream (do not split Feed and Announcements before contract lock).

Scope:
- Implement `feed` and `announcements` together with centralized admin surface `/admin/feed-announcements`.
- Deliver timeline, announcement lifecycle (draft/publish/archive), and membership-event driven visibility updates.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Keep feed+announcements contracts aligned and avoid split ownership drift.

Deliverables:
1) Updated contracts (both plugins)
2) Migrations + schema-drift evidence
3) API + policy checks + audit coverage
4) Quota-impact note for fan-out changes
5) Test evidence

Handoff output:
- List changed files
- Feed/announcements coupling decisions
- Deferred parity items (if any) with owner/date
```

## Prompt 04 — `agent-04-workforce`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-workforce-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-workforce-feature-inventory.md
- #file:ctf/docs/contracts/WORKFORCE_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/WORKFORCE_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/WORKFORCE_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/WORKFORCE_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-04-workforce` working only under `ctf/`.
Start gate:
- Phase 1 — start after Phase 0 Directory contracts/migrations stabilize.

Scope:
- Implement `workforce` dashboard/reporting, occupations/admin flows, export workflow, and recruited-state derivation.
- Respect Directory-upstream inference rules.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Canonical metric registry requirements.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) Recruited derivation implementation + policy checks
4) Canonical metric update notes
5) Test evidence

Handoff output:
- List changed files
- Directory dependency assumptions
- Remaining open compliance/metric decisions
```

## Prompt 05 — `agent-05-skills-hunt`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-skills-hunt-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-skills-hunt-feature-inventory.md
- #file:ctf/docs/contracts/SKILLS_HUNT_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/SKILLS_HUNT_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/SKILLS_HUNT_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/SKILLS_HUNT_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-05-skills-hunt` working only under `ctf/`.
Start gate:
- Phase 1 — start after Phase 0 Directory policy adapters and ownership lifecycle contracts are stable.

Scope:
- Implement round lifecycle, submission moderation/scoring, leaderboards, achievements, notifications, and feature-reward card.
- Implement governed generation of unclaimed Directory profiles only.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Do not bypass Directory policy controls.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) Anti-spam + moderation policy enforcement
4) Directory adapter governance evidence
5) Test evidence

Handoff output:
- List changed files
- Directory integration behavior summary
- Open policy ambiguities
```

## Prompt 06 — `agent-06-foundation`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-foundation-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-foundation-feature-inventory.md
- #file:ctf/docs/contracts/FOUNDATION_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/FOUNDATION_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/FOUNDATION_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/FOUNDATION_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-06-foundation` working only under `ctf/`.
Start gate:
- Phase 1 — start after Phase 0 Directory read-only projections are stable.

Scope:
- Implement Foundation provider search, connection/message/call flows, quote lifecycle, history, notifications, and admin capacity controls.
- Use Directory read-only projections only.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Enforce no-write boundary to Directory.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) API + policy + audit coverage
4) Read-only boundary validation evidence
5) Test evidence

Handoff output:
- List changed files
- Boundary compliance summary
- Any capacity/rate-limit follow-up tasks
```

## Prompt 07 — `agent-07-lighthouse`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-lighthouse-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-lighthouse-feature-inventory.md
- #file:ctf/docs/contracts/LIGHTHOUSE_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/LIGHTHOUSE_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/LIGHTHOUSE_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/LIGHTHOUSE_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-07-lighthouse` working only under `ctf/`.
Start gate:
- Phase 2 — parallel start after Phase 0 completion.

Scope:
- Implement profile/property/match/announcements/blocks parity scope for LightHouse.
- Preserve role and ownership policy constraints.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Blocks are required in v1 parity scope.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) API + policy + CSRF/audit coverage
4) Blocks lifecycle implementation evidence
5) Test evidence

Handoff output:
- List changed files
- Remaining open parity/risk items
- Admin and user flow validation summary
```

## Prompt 08 — `agent-08-socket-relay`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-socket-relay-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-socket-relay-feature-inventory.md
- #file:ctf/docs/contracts/SOCKET_RELAY_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/SOCKET_RELAY_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/SOCKET_RELAY_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/SOCKET_RELAY_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-08-socket-relay` working only under `ctf/`.
Start gate:
- Phase 2 — parallel start after Phase 0 completion.

Scope:
- Implement profile/request/fulfillment/chat/public sharing/admin moderation for SocketRelay.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Preserve privacy-minimized public DTO projection contracts.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) API + policy + CSRF/admin write checks
4) Public projection privacy evidence
5) Test evidence

Handoff output:
- List changed files
- Public DTO contract summary
- Known debt and mitigation notes
```

## Prompt 09 — `agent-09-trusttransport`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-trust-transport-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-trust-transport-feature-inventory.md
- #file:ctf/docs/contracts/TRUSTTRANSPORT_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/TRUSTTRANSPORT_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/TRUSTTRANSPORT_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/TRUSTTRANSPORT_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-09-trusttransport` working only under `ctf/`.
Start gate:
- Phase 2 — parallel start after Phase 0 completion.

Scope:
- Implement ride/package/food request-and-fulfillment flows, safety controls, disputes, payouts, and admin market controls.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Preserve trauma-informed and safety-first constraints.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) Policy + audit coverage for safety/dispute/payout actions
4) Risk/compliance control implementation notes
5) Test evidence

Handoff output:
- List changed files
- Safety/risk decisions taken
- Remaining compliance questions
```

## Prompt 10 — `agent-10-peer-programming`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-peer-programming-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-peer-programming-feature-inventory.md
- #file:ctf/docs/contracts/PEER_PROGRAMMING_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/PEER_PROGRAMMING_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/PEER_PROGRAMMING_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/PEER_PROGRAMMING_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-10-peer-programming` working only under `ctf/`.
Start gate:
- Phase 2 — parallel start after Phase 0 completion.

Scope:
- Implement weekly cohort assignment, in-app assignment notifications, persistent room/thread interactions, tiered participation, and weekly topic guidance admin.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Preserve deterministic cohort and fallback-open behaviors.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) Tier/policy enforcement + notification idempotency
4) Persistence and fallback behavior evidence
5) Test evidence

Handoff output:
- List changed files
- Cohort algorithm decisions and edge cases
- Open operational risks
```

## Prompt 11 — `agent-11-mood`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-mood-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-mood-feature-inventory.md
- #file:ctf/docs/contracts/MOOD_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/MOOD_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/MOOD_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/MOOD_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-11-mood` working only under `ctf/`.
Start gate:
- Phase 2 — parallel start after Phase 0 completion.

Scope:
- Implement mood check submission and eligibility endpoint with 7-day cooldown.
- Keep standalone mood scope (no admin/announcements scope).

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Preserve authenticated routes with anonymous `clientId` persistence contract.

Deliverables:
1) Updated contracts
2) Migrations/schema notes (if changed)
3) API + validation + policy checks
4) Cooldown + multi-device behavior notes
5) Test evidence

Handoff output:
- List changed files
- Anonymity/persistence policy assumptions
- Open product decision points
```

## Prompt 12 — `agent-12-gentle-pulse`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gentle-pulse-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gentle-pulse-feature-inventory.md
- #file:ctf/docs/contracts/GENTLE_PULSE_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/GENTLE_PULSE_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/GENTLE_PULSE_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/GENTLE_PULSE_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-12-gentle-pulse` working only under `ctf/`.
Start gate:
- Phase 2 — parallel start after Phase 0 completion.

Scope:
- Implement library listing/detail/play, ratings, favorites, and support route behavior.
- Respect exclusions: no in-app admin routes, no plugin-scoped announcements, no progress endpoints.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Keep app-level settings ownership outside plugin scope.

Deliverables:
1) Updated contracts
2) Migrations/schema notes (if changed)
3) API + validation + policy checks
4) Anonymous-to-auth cutover/backfill notes
5) Test evidence

Handoff output:
- List changed files
- Scope-exclusion checks
- Open migration/cutover risks
```

## Prompt 13 — `agent-13-weekly-performance`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-weekly-performance-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-weekly-performance-feature-inventory.md
- #file:ctf/docs/contracts/WEEKLY_PERFORMANCE_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/WEEKLY_PERFORMANCE_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/WEEKLY_PERFORMANCE_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/WEEKLY_PERFORMANCE_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-13-weekly-performance` working only under `ctf/`.
Start gate:
- Phase 2 — parallel start after Phase 0 completion.

Scope:
- Implement admin week selection, week navigation guardrails, current-week polling semantics, metrics/comparison routes, and export path (if approved).

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Keep non-financial metric scope.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) API + policy + audit coverage
4) Week-boundary contract validation
5) Test evidence

Handoff output:
- List changed files
- Metric dictionary assumptions
- Export gate status and open decisions
```

## Prompt 14 — `agent-14-gdp`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gross-domestic-product-feature-inventory.md
- #file:ctf/docs/contracts/GDP_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/GDP_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/GDP_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/GDP_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-14-gdp` working only under `ctf/`.
Start gate:
- Phase 3 — start after upstream metric/event semantics are stable from Phases 1 and 2.

Scope:
- Implement Gross Domestic Product aggregate transparency/reporting/admin publish flows with compliance controls.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Preserve DP/suppression and lawful-basis controls.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) API + policy + audit coverage
4) GDP metric governance evidence
5) Test evidence

Handoff output:
- List changed files
- Data-governance/compliance decision summary
- Open legal/compliance dependencies
```

## Prompt 15 — `agent-15-service-credits`

```text
Read this first: #file:index.mdc
Then read:
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-service-credits-feature-inventory.md
- #file:ctf/docs/developer/ctf-plugin-feature-inventories/ctf-service-credits-feature-inventory.md
- #file:ctf/docs/contracts/SERVICE_CREDITS_PLUGIN_COMMAND_CONTRACTS.yaml
- #file:ctf/docs/contracts/SERVICE_CREDITS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
- #file:ctf/docs/contracts/SERVICE_CREDITS_PLUGIN_AUDIT_CONTRACTS.yaml
- #file:ctf/docs/contracts/SERVICE_CREDITS_PROFILE_AND_DELETION_CONTRACT.md

You are `agent-15-service-credits` working only under `ctf/`.
Start gate:
- Phase 3 — start with/after GDP policy and accounting semantics lock.

Scope:
- Implement wallet/balance/transfers/escrow/disputes/governance/treasury/deletion-reclaim flows for ServiceCredits.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Preserve non-GDP accounting treatment for deletion reclaim outcomes.

Deliverables:
1) Updated contracts
2) Migrations + schema-drift evidence
3) API + policy + audit coverage
4) Cross-plugin path validation and ledger adapter controls
5) Test evidence

Handoff output:
- List changed files
- Accounting semantics verification notes
- Open adapter/compliance risks
```

---

## Prompt BF-01 v2 — `agent-bf-01-clerk-foundation-v2`

```text
Read this first: #file:index.mdc
Then read:
- #file:.claude/rules/107-integration-stack-rules.mdc
- #file:.claude/rules/111-deployment-topology-rules.mdc
- #file:.claude/rules/123-environment-configuration-rules.mdc
- #file:.claude/rules/103-web-nextjs-structure-rules.mdc
- #file:ctf/README.md
- #file:ctf/docs/developer/BASELINE_HANDOFF_BF01_BF04.md

You are `agent-bf-01-clerk-foundation-v2` working only under `ctf/`.
Start gate:
- Baseline v2 pass — run only after reviewing BF-01 handoff evidence and identifying unresolved/partial items.

Scope:
- Perform a second pass for BF-01 to close incomplete implementation and remove scaffold-only behavior.
- Re-validate Clerk App Router integration, server-side authz checks, deny taxonomy behavior, and env-contract determinism.
- Convert any placeholder/scaffold outputs into production-ready baseline implementation artifacts.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Environment/auth constraints in Rule 123; do not rename env variables without explicit approval.

Deliverables:
1) Delta report vs prior BF-01 handoff (what was incomplete, what is now closed)
2) Completion-grade Clerk/auth implementation updates
3) Updated validation evidence (manual + automated where available)
4) Remaining blockers (if any) with owner/date and concrete next action
5) Completion status recommendation: complete / needs reconciliation / blocked

Handoff output:
- List changed files
- Clarifying questions asked and answers received
- Closed items from BF-01 and remaining decisions (if any)
```

## Prompt BF-02 v2 — `agent-bf-02-railway-baseline-v2`

```text
Read this first: #file:index.mdc
Then read:
- #file:.claude/rules/111-deployment-topology-rules.mdc
- #file:.claude/rules/123-environment-configuration-rules.mdc
- #file:.claude/rules/119-github-actions-ci-rules.mdc
- #file:ctf/railway.toml
- #file:ctf/docs/developer/BASELINE_HANDOFF_BF01_BF04.md

You are `agent-bf-02-railway-baseline-v2` working only under `ctf/`.
Start gate:
- Baseline v2 pass — run only after reviewing BF-02 handoff evidence and identifying unresolved/partial items.

Scope:
- Perform a second pass for BF-02 to close incomplete implementation and remove scaffold-only behavior.
- Re-validate Railway canonical runtime baseline, startup preflight checks, env injection, deploy readiness, and diagnostics.
- Convert any placeholder/scaffold outputs into production-ready baseline implementation artifacts.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Deployment topology constraints from Rule 111 and env constraints from Rule 123.

Deliverables:
1) Delta report vs prior BF-02 handoff (what was incomplete, what is now closed)
2) Completion-grade Railway baseline updates
3) Updated runtime/deploy validation evidence
4) Remaining blockers (if any) with owner/date and concrete next action
5) Completion status recommendation: complete / needs reconciliation / blocked

Handoff output:
- List changed files
- Clarifying questions asked and answers received
- Closed items from BF-02 and unresolved risks (if any)
```

## Prompt BF-03 v2 — `agent-bf-03-vercel-integration-v2`

```text
Read this first: #file:index.mdc
Then read:
- #file:.claude/rules/111-deployment-topology-rules.mdc
- #file:.claude/rules/123-environment-configuration-rules.mdc
- #file:.claude/rules/119-github-actions-ci-rules.mdc
- #file:ctf/packages/web/vercel.json
- #file:ctf/docs/developer/BASELINE_HANDOFF_BF01_BF04.md

You are `agent-bf-03-vercel-integration-v2` working only under `ctf/`.
Start gate:
- Baseline v2 pass — run only after reviewing BF-03 handoff evidence and identifying unresolved/partial items.

Scope:
- Perform a second pass for BF-03 to close incomplete implementation and remove scaffold-only behavior.
- Re-validate Vercel staging frontend integration against Railway canonical backend, including env isolation and Clerk domain/key separation.
- Convert any placeholder/scaffold outputs into production-ready baseline implementation artifacts.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Keep backend runtime canonical on Railway and avoid Vercel backend drift.

Deliverables:
1) Delta report vs prior BF-03 handoff (what was incomplete, what is now closed)
2) Completion-grade Vercel staging integration updates
3) Updated validation evidence (preview + smoke checks)
4) Remaining blockers (if any) with owner/date and concrete next action
5) Completion status recommendation: complete / needs reconciliation / blocked

Handoff output:
- List changed files
- Clarifying questions asked and answers received
- Closed items from BF-03 and remaining staging risks (if any)
```

## Prompt BF-04 v2 — `agent-bf-04-expo-baseline-v2`

```text
Read this first: #file:index.mdc
Then read:
- #file:.claude/rules/104-mobile-react-native-android-rules.mdc
- #file:.claude/rules/106-expo-eas-mobile-workflow-rules.mdc
- #file:.claude/rules/111-deployment-topology-rules.mdc
- #file:.claude/rules/123-environment-configuration-rules.mdc
- #file:.claude/rules/119-github-actions-ci-rules.mdc
- #file:ctf/docs/mobile/EXPO_CLOUD_WORKFLOW.md
- #file:ctf/docs/developer/BASELINE_HANDOFF_BF01_BF04.md

You are `agent-bf-04-expo-baseline-v2` working only under `ctf/`.
Start gate:
- Baseline v2 pass — run only after reviewing BF-04 handoff evidence and identifying unresolved/partial items.

Scope:
- Perform a second pass for BF-04 to close incomplete implementation and remove scaffold-only behavior.
- Re-validate Expo/EAS Android deployment baseline (preview/staging/production profile readiness), env propagation, and release workflow readiness.
- Convert any placeholder/scaffold outputs into production-ready baseline implementation artifacts.

Must follow:
- Rule precedence from #file:index.mdc.
- Before implementation, ask clarifying questions until requirements are unambiguous; wait for answers before coding.
- Do not stop at scaffold code; complete implementation or provide explicit blocked-by owner/date.
- Maintain Expo channel/profile governance and CI requirements.

Deliverables:
1) Delta report vs prior BF-04 handoff (what was incomplete, what is now closed)
2) Completion-grade Expo/EAS baseline updates
3) Updated validation evidence (preview/build/test runs)
4) Remaining blockers (if any) with owner/date and concrete next action
5) Completion status recommendation: complete / needs reconciliation / blocked

Handoff output:
- List changed files
- Clarifying questions asked and answers received
- Closed items from BF-04 and remaining blockers (if any)
```
