# Chyme Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` remains reference-only and must not be modified.
- Unified plugin scope slug: `chyme`
- This document captures the implemented Chyme scope in `ctf/` as of the current rewrite baseline.

## Intent and Outcome

Chyme delivers a lightweight social-audio room with companion text chat, shared-adapter Stream-backed room join flow, provider-neutral access enforcement, and plugin-scoped deletion behavior under the CTF plugin-first architecture.

Lifecycle/governance references applied:

1. Inventory/checklist lifecycle follows `index.mdc` precedence and Rule 120.
2. Profile/deletion boundaries follow Rule 114 and `ctf/docs/contracts/CHYME_PROFILE_AND_DELETION_CONTRACT.md`.
3. Implementation sequencing must honor baseline phase order: auth integration, Railway deployment baseline, Vercel integration, Expo baseline.

## Target User Features (Implementation Scope)

1. Authenticated room bootstrap via `GET /api/chyme/room` with deterministic room provisioning (`chyme-main-room`) and participant upsert.
2. Companion text chat read/send via `GET /api/chyme/messages` and `POST /api/chyme/messages`, with DB persistence and Stream message fan-out through shared adapters.
3. Stream-backed room join/token flow via `POST /api/chyme/join`, using shared Stream wrappers in `packages/shared`.
4. Service-scoped deletion request via `DELETE /api/account/chyme-profile`.
5. Full-account deletion request initiation via `DELETE /api/account/full-account`, including Service Credits reclaim dependency queueing in existing reclaim/outbox tables.
6. Web UI surface includes participant list, join-call action, chat panel, and deletion actions.
7. Android UI surface includes room summary, participant roster, chat send/read, join action, and deletion actions using runtime-configured provider-neutral identity headers.

## Target Admin Features

1. No Chyme-specific admin UI is required for MVP unless called by contracts/checklist updates.
2. Eligibility gate must enforce shared access approval model (`approved user` or `admin`) for room/chat/join routes.

## API Surface and Route Map (Target)

Chyme plugin routes:

- `GET /api/chyme/room`
- `GET /api/chyme/messages`
- `POST /api/chyme/messages`
- `POST /api/chyme/join`

Deletion/account routes used by Chyme UI:

- `DELETE /api/account/chyme-profile`
- `DELETE /api/account/full-account`

Current command-contract note:

- Chyme should be delivered as route + repository flows aligned to plugin command/access/audit contracts.
- Plugin command/access/audit YAML triplet artifacts are present:
  - `ctf/docs/contracts/CHYME_PLUGIN_COMMAND_CONTRACTS.yaml`
  - `ctf/docs/contracts/CHYME_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`
  - `ctf/docs/contracts/CHYME_PLUGIN_AUDIT_CONTRACTS.yaml`

## Data Model and Storage Contracts (Target)

Canonical schema target: Chyme core tables are defined in `ctf/schema.sql`, aligned to route assumptions and schema-drift checks.

1. `chyme_rooms`
   - Shared room metadata (`service_name='chyme'`, `call_active`).
2. `chyme_service_profiles`
   - Plugin extension lifecycle per user (`active|deleted`, timestamps).
3. `chyme_room_members`
   - Membership roster keyed by `(room_id, user_id)`, role enum (`speaker|listener`), last-seen updates.
4. `chyme_messages`
   - Message history with DB-level text constraint (`1..1000` chars).
5. `chyme_deletion_events`
   - Service/account deletion event log.
6. `service_credits_account_deletion_reclaims`
   - Downstream reclaim dependency record created when full-account deletion is requested.
7. `service_credits_adapter_outbox`
   - Queue used to hand the reclaim dependency to the existing Service Credits execution flow.

## Security, Privacy, and Compliance Controls (Target)

1. Authenticated access is required on Chyme routes; unauthenticated requests are denied (`401`).
2. Access gate enforces approved-user or admin eligibility (`403` for non-approved non-admin users).
3. Identity handle source is the canonical auth-provider username/handle for username/`@mention` semantics, aligned to `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`.
4. Message payloads are trimmed server-side and rejected when empty.
5. Service deletion runs in transaction and records deletion event for audit trail.
6. Full-account endpoint records the Chyme deletion request and queues the downstream Service Credits reclaim dependency.
7. Stream integration is routed through shared wrappers/adapters in `ctf/packages/shared`.

## Web and Android Delivery Status

1. Web implementation is delivered for room/chat/join/deletion workflows.
2. Android implementation is delivered for room/chat/join/deletion workflows using runtime-configured request identity and the same protected API surface.
3. Current feature-parity status is web+android complete.
4. Web pixel pass: `chyme-live-shell` is aligned to `design/.../survivor-hub/Chyme.tsx`, using lucide-react iconography in place of emoji glyphs. Loading and empty states render inline; there is no public state by design (Chyme is auth-only per the #102 visibility decision). The Android pixel pass to `MobileChyme.tsx` remains tracked in `PRODUCTION_READINESS_PLAN.md`.

## Seed Coverage Status

Rule requirement: deterministic plugin seed script for manual validation in dev environments.

Current status:

- Deterministic Chyme seed script is present under `ctf/scripts/seedChyme.mjs`.
- Validation and release evidence live in `ctf/docs/testing/CHYME_FIRST_TEST_PASS.md` and `ctf/docs/quota-impact/2026-04-05-chyme-phase0-remediation.md`.

## Gaps and Known Technical Debt

1. Full-account delete lifecycle remains request-first; terminal orchestrator completion still depends on the broader account-deletion workflow.
2. Chyme-specific admin tooling and moderation controls are out of MVP scope.
3. In-room native call client (beyond Stream chat channels for coordination) remains a future enhancement.

## Change Log

- 2026-05-29: Design-sync reconcile to `c5d83c0`. Removed user-facing "GetStream" wording from `chyme-live-shell`: "Social Audio Â· GetStream Powered" â†’ "Social Audio Â· End-to-End Encrypted", the chat "GetStream" badge â†’ "Encrypted", and "Audio via GetStream" â†’ "Audio â€” encrypted". Copy-only.
- 2026-05-29: Web UI circle-back. Aligned `chyme-live-shell` to the `Chyme.tsx` mockup by replacing emoji glyphs with the mockup's lucide-react icons (Radio, Mic/MicOff, Hand, Phone, MessageSquare, Hash, Send, Volume2, Users, Lock, RefreshCw); structure and palette already matched. API wiring unchanged.
- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language (Delivery Phasing section); confirmed implementation is complete across web and Android. Renamed section to "Gaps and Known Technical Debt" (Rule 120 format).
- 2026-04-05: Completed Android parity on the real Chyme API surface, queued Service Credits reclaim dependency on full-account delete, and aligned Chyme docs to `ctf/schema.sql` plus shared Stream wrappers.
- 2026-02-25: Created initial Chyme CTF rewrite inventory and documented governance/parity requirements.


## Build Checklist


### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - Chyme implementation and supporting artifacts stay under `ctf/`.
- [x] Confirm plugin ID and room key stability.
  - Acceptance criteria:
    - Plugin slug remains `chyme`.
    - Default room remains `chyme-main-room` unless an explicit migration plan is approved.
- [x] Confirm profile/deletion contract exists.
  - Acceptance criteria:
    - `ctf/docs/contracts/CHYME_PROFILE_AND_DELETION_CONTRACT.md` exists and maps expected behavior.

### Baseline Prerequisite Gate (Mandatory)

- [x] Confirm baseline sequence completion before Chyme build start.
  - Acceptance criteria:
    - Auth foundation completed.
    - Railway deployment baseline completed.
    - Vercel staging integration completed.
    - Expo baseline completed.

### €” Core Implementation and Contract Alignment

- [x] Implement Chyme room bootstrap route behavior.
  - Acceptance criteria:
    - `GET /api/chyme/room` creates/loads deterministic room and upserts participant profile/member for eligible users.
- [x] Implement Chyme chat list/send route behavior.
  - Acceptance criteria:
    - `GET /api/chyme/messages` returns bounded room history.
    - `POST /api/chyme/messages` trims input, rejects empty text, and persists valid messages.
- [x] Implement Stream join route behavior.
  - Acceptance criteria:
    - `POST /api/chyme/join` returns Stream credentials when server config is present.
    - Route returns `503` when Stream server config is unavailable.
- [x] Implement migration/data model coverage.
  - Acceptance criteria:
    - Core Chyme tables and indexes exist and match route assumptions.
- [x] Confirm command/access/audit contract alignment.
  - Acceptance criteria:
    - Chyme command contract follows Rule 201 template conventions.
    - Chyme access/deny policy contract follows Rule 202 template conventions.
    - Chyme audit contract follows Rule 203 template conventions.

### €” Deletion and Compliance

- [x] Implement service-scoped deletion flow.
  - Acceptance criteria:
    - `DELETE /api/account/chyme-profile` marks service profile deleted and records service deletion event.
- [x] Implement full-account request behavior.
  - Acceptance criteria:
    - `DELETE /api/account/full-account` records account-scope deletion request and enqueues downstream reclaim dependency.
- [x] Align full-account lifecycle statuses with global orchestrator model.
  - Acceptance criteria:
    - Status model (`requested`/`processing`/`completed`/`failed`) is represented consistently in account deletion workflow.

### €” Seed and Deterministic Dev Validation

- [x] Add deterministic Chyme seed script.
  - Acceptance criteria:
    - Seed script under `ctf/scripts/` creates predictable Chyme baseline test data for local/dev validation.
- [x] Capture dev validation evidence. [MANUAL VALIDATION CHECKLIST DEFERRED FOR MVP â€” see Rule 118.]
  - Acceptance criteria:
    - Seed data can be regenerated for local/dev manual validation.

### €” Web/Android Parity

- [x] Confirm web Chyme baseline is implemented.
  - Acceptance criteria:
    - Web UI and API support room, chat, join, and deletion actions.
- [x] Implement Android parity for Chyme plugin flows.
  - Acceptance criteria:
    - Android delivers equivalent room/chat/join/deletion behavior and policy outcomes using the protected Chyme API surface.
- [x] Close platform parity deferment with owner/date (if not delivered in same phase).
  - Acceptance criteria:
    - Parity no longer depends on a deferred follow-up owner/date.

### €” Release Gates and Lifecycle Maintenance

- [x] Keep Chyme inventory/checklist synchronized with accepted changes. [EVIDENCE CAPTURE DEFERRED FOR MVP â€” see Rule 118.]
  - Acceptance criteria:
    - Feature/behavior changes update both Chyme docs in the same PR.
- [x] Record release-gate compliance status.
  - Acceptance criteria:
    - Command/access/audit contracts, migration evidence, and policy/audit checks are linked before release cut.
- [x] Add Stream quota-impact and validation artifacts.
  - Acceptance criteria:
    - Chyme has a dedicated quota-impact note and updated validation instructions aligned to canonical schema flow.

### Change Log

- 2026-02-25: Created initial Chyme rewrite checklist with baseline sections and governance requirements.
- 2026-03-01: Replaced implemented-baseline validation checklist with fresh-start implementation checklist and baseline prerequisite gate.
- 2026-03-01: Completed Phase 0 web/API/migration/policy/audit scope and recorded Android parity deferment owner/date.
- 2026-03-02: Added Chyme closure handoff evidence and second-pass runtime de-scaffolding updates (join call state persistence).
- 2026-04-05: Closed Android deferment, wired Service Credits reclaim dependency queueing for full-account delete, and added release evidence for schema/quota/validation alignment.
