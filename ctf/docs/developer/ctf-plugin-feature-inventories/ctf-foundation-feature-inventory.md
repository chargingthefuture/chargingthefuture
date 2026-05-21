# Foundation Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target: `ctf/`
- Plugin slug: `foundation`
- Foundation delivers trauma-informed survivor-provider 1:1 connection workflows (text, voice, video) with policy-controlled access, audit trails, and GetStream-backed scalability.
- Legacy `platform/` is reference-only; not modified.

## Intent and Outcome

Foundation provides trauma-informed survivors with deterministic access to vetted providers for 1:1 text/voice/video connection, quote requests, and continuity history. Connections are policy-controlled, auditable, and scoped to Stream Maker-tier quotas with quota-aware degradation.

## Target User Features

1. Provider discovery and search by service type, location, language, and trauma-informed criteria.
2. Survivor-provider 1:1 text messaging with delivery/read/seen semantics and file attachment support.
3. Voice and video session initiation and join for approved 1:1 participants.
4. Quote request lifecycle (requested â†’ provider_responded â†’ closed) with immutable timeline view.
5. Connection and quote history lists scoped by actor ownership.
6. In-app notifications for messages, quote state changes, and missed calls.
7. Notification preferences and quiet-hour controls.

## Target Admin Features

1. Capacity policy control under Stream Maker-tier limits with threshold handling (green/yellow/orange/red).
2. Kill-switch and degrade controls for non-critical behavior under quota pressure.
3. Operational review of denied command decisions and reason-code trends.
4. Policy diagnostics for consent, region, and role-driven denials.
5. Rate-limit tuning by command family.
6. Quota threshold transition alerts and recovery controls.

## API Surface and Route Map

User routes:

- `GET /api/foundation/providers/search`
- `POST /api/foundation/connections/threads`
- `POST /api/foundation/connections/threads/:threadId/messages`
- `POST /api/foundation/connections/threads/:threadId/calls`
- `POST /api/foundation/quotes`
- `POST /api/foundation/quotes/:quoteRequestId/state`
- `GET /api/foundation/quotes/history`
- `GET /api/foundation/connections/history`
- `PUT /api/foundation/notifications/preferences`
- `POST /api/foundation/notifications/:notificationEventId/ack`

Admin routes:

- `POST /api/foundation/admin/rate-limits/evaluate`
- `PUT /api/foundation/admin/capacity-policy`
- `GET /api/foundation/admin/audit-events`

## Data Model and Storage Contracts

Foundation-owned domain entities:

1. `foundation_user_extension` â€” User Foundation plugin extension data.
2. `foundation_connection_threads` â€” 1:1 survivor-provider threads.
3. `foundation_thread_participants` â€” Thread participant roster.
4. `foundation_message_metadata` â€” Message history with delivery/read state.
5. `foundation_call_sessions` â€” Voice/video call session records.
6. `foundation_quote_requests` â€” Quote request lifecycle records.
7. `foundation_quote_status_events` â€” Quote state transition log.
8. `foundation_notification_preferences` â€” User notification opt-in/opt-out settings.
9. `foundation_notification_events` â€” Notification delivery history.
10. `foundation_rate_limit_counters` â€” Per-command rate limiting state.
11. `foundation_quota_threshold_states` â€” Current quota threshold level (green/yellow/orange/red).
12. `foundation_capacity_policies` â€” Admin-configured capacity limits and thresholds.
13. `foundation_admin_audit_trail` â€” Admin action audit log.

Cross-plugin read dependencies (read-only):

- `directory_profiles` â€” Provider discovery eligibility checks (Foundation MUST NOT write to Directory).

## Security, Privacy, and Compliance Controls

1. Server-side policy enforcement for roles, consent, region restrictions, and deny conditions.
2. Deny-by-default for cross-tenant and unauthorized cross-region access.
3. Audit logging for all commands with allow/deny outcomes and decision evidence.
4. Data minimization for history and notification payloads.
5. Redaction/tokenization for sensitive communication metadata in logs.
6. Plugin-scoped deletion and full-account deletion handling distinct per Rule 114.
7. Stream integration via shared wrappers in `packages/shared` (no direct Stream API calls).
8. Rate limiting and command-level throttling for high-frequency actions.
9. Quota-aware degradation: preserve core send/receive/active thread reliability under red quota threshold.

## Web and Android Delivery Status

Parity status: **web+android complete**.

## Seed Coverage Status

Deterministic Foundation seed script: `ctf/scripts/seedFoundationPhase0.mjs`.

Seeded content:
- Sample survivors and providers with deterministic states.
- Sample connection threads and messages.
- Sample quote requests in various lifecycle states.

## Gaps and Known Technical Debt

1. Final quote payload schema by service category requires explicit product + compliance documentation (currently implementation-driven).
2. Voice/video fallback interaction copy finalization pending survivor-advisory review.
3. Notification channel rollout order and region targeting remain operational decisions.
4. Capacity policy defaults based on monthly demand assumptions need ongoing validation.

## Change Log

- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language (Delivery Phasing sections), Planned section headers, and planning ambiguities. Confirmed web+android complete delivery status. Clarified technical debt (quote schema, fallback copy, notification strategy, capacity assumptions) as known limitations, not unimplemented features.
- 2026-02-24: Created initial Foundation CTF rewrite inventory with full-v1 scope for search, 1:1 text/voice/video, quote lifecycle, history, notifications, rate limiting, and scalability.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation changes are required in `platform/`.
- [ ] Confirm plugin ID and command namespace.
  - Acceptance criteria:
    - All contracts/routes use stable slug `foundation`.
- [ ] Confirm Directory boundary contract.
  - Acceptance criteria:
    - Foundation reads Directory data through read-only projections only.
    - No Foundation command can mutate Directory behavior/data.

### €” Contract and Policy Lock

- [ ] Lock Foundation command contracts for full-v1.
  - Acceptance criteria:
    - Every command includes `pluginId`, `command`, `version`, `purpose`, `retentionClass`, and `idempotency`.
- [ ] Lock Foundation access policy contracts.
  - Acceptance criteria:
    - Every command policy includes `consentRequirements`, `regionRestrictions`, `highRiskFlags`, and `denyConditions`.
- [ ] Lock Foundation audit contracts.
  - Acceptance criteria:
    - Every command has audit shape covering allow/deny decisions and policy evidence checks.
- [ ] Confirm Stream Maker-tier governance alignment.
  - Acceptance criteria:
    - Contracts and inventory align with `.github/instructions/110-stream-maker-tier-rules.mdc` threshold model and fallback rules.

### €” Schema, Migrations, and Retention

- [ ] Define Foundation extension/domain schema and migrations under `ctf/migrations/`.
  - Acceptance criteria:
    - Schema includes thread/message/call/quote/notification/rate-limit/audit entities.
- [ ] Define quote lifecycle state model (`requested`, `provider_responded`, `closed`).
  - Acceptance criteria:
    - Invalid transitions are blocked and auditable.
- [ ] Define retention classes for communication, transactional, and audit entities.
  - Acceptance criteria:
    - Retention tags are documented and mapped in contracts and schema notes.
- [ ] Prepare rollback and replay notes.
  - Acceptance criteria:
    - Migration replay and rollback steps are captured for PR evidence.

### €” Core Service and Command Execution

- [ ] Implement provider search service using Directory read-only projections.
  - Acceptance criteria:
    - Search/filter/ranking does not write to Directory domain.
- [ ] Implement 1:1 text thread create/send flows.
  - Acceptance criteria:
    - Thread membership is strictly survivor-provider pair only.
- [ ] Implement 1:1 voice/video session creation and policy checks.
  - Acceptance criteria:
    - Participant cap, duration cap, and region pinning checks are enforced.
- [ ] Implement quote create and state-transition commands.
  - Acceptance criteria:
    - Lifecycle transitions are deterministic and fully auditable.
- [ ] Implement history and notification command family.
  - Acceptance criteria:
    - Actor ownership checks prevent cross-user history access.

### €” Rate Limiting, Quotas, and Scalability

- [ ] Implement command-level rate limiting for high-frequency actions.
  - Acceptance criteria:
    - Messaging/search/notification and quote updates enforce bounded request rates.
- [ ] Implement Stream usage meters and threshold states.
  - Acceptance criteria:
    - Green/yellow/orange/red transitions are observable and trigger expected degrade behavior.
- [ ] Implement graceful degradation strategy.
  - Acceptance criteria:
    - At orange/red states, non-critical behaviors degrade while core 1:1 messaging reliability is preserved.
- [ ] Add quota impact documentation for Stream-consuming surfaces.
  - Acceptance criteria:
    - PR includes required note under `ctf/docs/quota-impact/` with fallback and observability sections.

### €” Web Full-v1 Delivery

- [ ] Deliver web provider search and profile preview flows.
  - Acceptance criteria:
    - Survivors can discover and select providers with accessibility-aware filters.
- [ ] Deliver web 1:1 messaging and voice/video flows.
  - Acceptance criteria:
    - Survivors/providers can complete text, voice, and video interactions end-to-end.
- [ ] Deliver web quote lifecycle flows.
  - Acceptance criteria:
    - Users can create, update, and review quote requests across 3-state lifecycle.
- [ ] Deliver web history and notification settings.
  - Acceptance criteria:
    - Users can review interaction history and control notification channels/quiet hours.

### €” Android Parity Follow-up Tracking

- [ ] Create parity tracking table for all web-delivered Foundation capabilities.
  - Acceptance criteria:
    - Each capability includes owner, target sprint/date, risk, and parity validation status.
- [ ] Implement Android parity for provider search and selection.
  - Acceptance criteria:
    - Android outcomes match web command semantics and policy decisions.
- [ ] Implement Android parity for 1:1 text/voice/video.
  - Acceptance criteria:
    - Android interactions match web command outcomes and audit events.
- [ ] Implement Android parity for quote lifecycle, history, and notifications.
  - Acceptance criteria:
    - Android supports requested/provider_responded/closed lifecycle and equivalent history/notification behavior.
- [ ] Close parity deferments.
  - Acceptance criteria:
    - Any deferred item includes approved risk note and final completion date.

### €” Trauma-Informed and Accessibility Validation

- [ ] Validate trauma-informed UX constraints.
  - Acceptance criteria:
    - Language and interaction pacing avoid coercive urgency or harm-amplifying patterns.
- [ ] Validate accessibility constraints on web and Android.
  - Acceptance criteria:
    - Screen-reader, keyboard navigation, contrast, and caption/call accessibility criteria pass.
- [ ] Validate safety and reporting affordances.
  - Acceptance criteria:
    - Critical safety pathways are discoverable, clear, and policy-compliant.

### €” Security, Compliance, and Deletion

- [ ] Verify authz, consent, region, and deny-condition enforcement.
  - Acceptance criteria:
    - Enforcement exists server-side for all command families.
- [ ] Verify audit integrity (allow + deny).
  - Acceptance criteria:
    - Audit records are append-only, redacted/tokenized, and correlation IDs are present.
- [ ] Verify Foundation profile/deletion contract behavior.
  - Acceptance criteria:
    - Plugin-scoped deletion preserves canonical profile and Directory data.
    - Full-account flow removes Foundation user-scoped data per orchestrator policy.

### Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED â€” see Rule 118.]

- [ ] Command schema design documentation.
  - Acceptance criteria:
    - Unknown fields, type errors, bounds violations, and invalid enum values handling is documented.
- [ ] Access policy enforcement design documentation.
  - Acceptance criteria:
    - Missing consent, wrong role, region restrictions, cross-tenant access, and deny conditions are documented.
- [ ] Audit contract design documentation.
  - Acceptance criteria:
    - Allow and deny outcomes expected evidence fields and request/trace correlations are documented.
- [ ] Quote lifecycle and history design documentation.
  - Acceptance criteria:
    - Requested/provider_responded/closed transitions and read permissions behavior is documented.
- [ ] Stream degradation behavior documentation.
  - Acceptance criteria:
    - Yellow/orange/red threshold behavior aligns with Maker-tier rules.
- [ ] Web + Android parity design scope. [MANUAL PARITY COVERAGE DEFERRED FOR MVP â€” see Rule 118.]
  - Acceptance criteria:
    - Parity-required flows are documented for post-MVP testing.

### Documentation and Inventory Lifecycle

- [ ] Keep `ctf-foundation-feature-inventory.md` updated with each accepted feature change.
  - Acceptance criteria:
    - Add/remove/behavior changes are reflected in same PR as implementation.
- [ ] Keep Foundation contracts updated with version and compatibility notes.
  - Acceptance criteria:
    - Command/policy/audit changes include migration impact notes when relevant.
- [ ] Implementation tracking. [EVIDENCE CAPTURE DEFERRED FOR MVP â€” see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; evidence collection deferred to post-MVP.

### Change Log

- 2026-02-24: Created initial Foundation rewrite checklist with full-v1 gates for search, 1:1 text/voice/video, quote lifecycle, history, notifications, rate limiting/scalability, trauma-informed accessibility, and web-first to Android parity follow-up tracking.
