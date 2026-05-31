# Foundation Profile and Deletion Contract (Draft)

This draft uses `PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.

## 1) Plugin Metadata

- Plugin Name: The Foundation
- Service Key (lowercase, stable): `foundation`
- Owner Team: Survivor Connection Platform (proposed), Trust & Safety Engineering (proposed)
- Rollout Stage: Full-v1 planning (web-first, Android parity follow-up tracked)

## 2) Canonical Profile Usage

Foundation uses canonical profile for identity continuity, safety defaults, and consent context across survivor-provider interactions.

- Read fields:
  - `user_id`, display name, avatar reference
  - locale/language preference
  - accessibility preferences
  - consent and communication preference pointers
  - region membership and policy-region attributes
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - preserve a single account identity across plugin boundaries
  - apply trauma-informed and accessibility defaults consistently
  - enforce regional and consent policy checks without duplicating identity data

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `foundation_user_extension`
- Fields:
  - field name: `user_id`
    - type: uuid
    - nullable/default: non-null, FK to canonical profile
    - purpose: bind Foundation extension data to canonical identity
  - field name: `notification_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: in-app/push/email and quiet-hour preferences for Foundation events
  - field name: `accessibility_runtime_prefs`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: plugin-scoped accessibility accommodations (text scaling, captions defaults, reduced cognitive load modes)
  - field name: `trauma_informed_defaults`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: survivor-controlled defaults (content sensitivity mode, escalation hints, contact pacing)
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable, default `null`
    - purpose: plugin-scoped deletion lifecycle marker

## 4) Domain Data Owned by Plugin

- Table/entity: `foundation_connection_threads`
  - Contains personal data? yes (participant linkage and thread metadata)
  - Retention period: medium-lived while account is active, then plugin/full-account deletion policy applies
  - Legal/compliance note: stores context metadata only; payload content remains in scoped communication stores
- Table/entity: `foundation_message_metadata`
  - Contains personal data? yes (message IDs, sender linkage, moderation summary)
  - Retention period: medium-lived based on communication retention policy
  - Legal/compliance note: high-sensitivity communication metadata; raw payload logging prohibited
- Table/entity: `foundation_call_sessions`
  - Contains personal data? yes (participant linkage, call modality, duration)
  - Retention period: short-lived operational + medium-lived summary window for continuity/history
  - Legal/compliance note: trauma-informed handling and region-pinning required for real-time media
- Table/entity: `foundation_quote_requests`
  - Contains personal data? yes (service details and lifecycle state)
  - Retention period: long-lived transactional history
  - Legal/compliance note: financial/service-intent records retained for accountability and dispute resolution
- Table/entity: `foundation_quote_status_events`
  - Contains personal data? minimal (actor linkage and lifecycle transition metadata)
  - Retention period: long-lived append-only event history
  - Legal/compliance note: required for immutable quote lifecycle evidence (requested/provider_responded/closed)
- Table/entity: `foundation_notification_events`
  - Contains personal data? yes (delivery target linkage and event category)
  - Retention period: short-lived for delivery operations and acknowledgments
  - Legal/compliance note: no sensitive content body in event table; metadata only
- Table/entity: `foundation_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, timestamps, result metadata)
  - Retention period: compliance retention window
  - Legal/compliance note: required audit trail for plugin/full-account deletion accountability

Directory interaction rule:

- Foundation reads Directory-projected provider data in read-only mode and MUST NOT mutate Directory behavior, records, workflows, or schema.

### Transaction-scoped messaging retention

Per platform rule 100 ("Messaging Scope and Lifecycle"), the 1:1 text/voice/video channel (`foundation_connection_threads`, `foundation_message_metadata`, `foundation_call_sessions`) is bound to an active connection/quote between exactly the two parties and has no existence outside it. When the connection/quote reaches a terminal state (closed, declined, or ended) the chat closes: no new messages may be sent, both parties retain read-only access for a limited window, and message/call records are retained server-side for moderation and abuse evidence. On service-scoped or full-account deletion, message bodies are hard-deleted or pseudonymized per the scopes below, while minimal moderation/abuse-evidence and Rule 114 audit metadata may be retained where policy or law requires (consistent with the retain-for-compliance scope).

## 5) Service-Scoped Deletion Contract

When user deletes Foundation plugin usage only:

- Delete immediately:
  - `foundation_user_extension` row for requesting user
  - participant links and plugin-owned thread linkage rows for the requester
  - plugin-scoped notification preference and pending delivery records owned by requester
- Anonymize/pseudonymize:
  - `foundation_message_metadata` and `foundation_call_sessions` user linkage for retained continuity records where hard delete is not required by policy
  - quote history actor identifiers where retention obligation allows pseudonymization
- Retain for compliance/fraud/finance:
  - immutable quote lifecycle events required for service/dispute accountability
  - `foundation_deletion_events` for deletion evidence
- Never touch (must remain):
  - canonical profile identity
  - Directory records and Directory behavior/data
  - other plugin extension/domain records
- User-facing confirmation text:
  - “Delete The Foundation plugin data only? Your account and all non-Foundation services will remain active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining Foundation thread/message/call/quote/notification linkage tied to deleted account
  - Foundation pseudonymized remnants removed where policy allows hard delete
- Cross-service dependencies:
  - full-account orchestrator must sequence canonical identity deletion with all plugin contracts
  - Service Credits reclaim/finalization is required before account deletion can be marked `completed`
  - Foundation must consume orchestrator status transitions and emit deletion audit events
- Final expected state:
  - no recoverable Foundation user-scoped data linked to deleted identity
  - retained compliance artifacts contain no direct re-identifying user linkage unless legally mandated

## 7) Rejoin/Re-enable Behavior

If user returns to Foundation after service-scoped deletion:

- Recreated defaults:
  - new `foundation_user_extension` with default notification/accessibility/trauma-informed preferences
  - fresh 1:1 connection initialization state
- Data that is not restored:
  - deleted prior message/call/quote personal history that was hard-deleted or pseudonymized
- Re-consent required? (yes/no):
  - yes, for survivor-provider contact consent, real-time voice/video consent, and notification scope consent

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `reason_code`, `request_id`, `trace_id`
- Event table/path:
  - `foundation_deletion_events` (plugin) + centralized account deletion event stream (platform canonical)
- Who can trigger deletion:
  - authenticated end user for own plugin-scope deletion
  - authorized system actor/orchestrator for full-account deletion
- Alerting/monitoring requirement:
  - alert on deletion failure, retries exceeding policy thresholds, and unusual deletion-volume spikes

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/foundation-profile` (planned)
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account` (platform orchestrator)
- Status model (`requested`, `processing`, `completed`, `failed`):
  - required for plugin-scoped and full-account flows; plugin flow may begin synchronous but must report final state transitions
- User-facing copy reviewed by:
  - Product, Compliance/Privacy, Trust & Safety, Survivor Advisory

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order rollback for Foundation-only tables with explicit retention checks before destructive actions
- Backfill required? (yes/no):
  - yes (for initial import of eligible read-only Directory provider projections and baseline notification defaults)

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## Change Log

- 2026-02-24: Created initial Foundation profile/deletion contract with explicit Directory read-only boundary, plugin-vs-account deletion behavior, and re-consent requirements.
- 2026-05-31: Added transaction-scoped messaging retention (per rule 100): 1:1 text/voice/video channel closes on connection/quote terminal state (read-only window), retained server-side for moderation/abuse evidence; bodies hard-deleted/pseudonymized on deletion with minimal evidence/audit metadata retained per policy.
