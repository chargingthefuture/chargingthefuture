# PeerProgramming Profile and Deletion Contract (Draft)

## 1) Plugin Metadata

- Plugin Name: PeerProgramming
- Service Key (lowercase, stable): `peer-programming`
- Owner Team: Collaboration Platform (proposed)
- Rollout Stage: Planning

## 2) Canonical Profile Usage

Rule 114 baseline: PeerProgramming uses one canonical profile and plugin extension by `user_id`.

- Read fields:
  - `user_id`
  - display name
  - avatar URL
  - role/workspace membership
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - session ownership, matching, and permissions

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `peer_programming_user_extension`
- Fields:
  - field name: `user_id`
    - type: uuid
    - nullable/default: non-null, unique, FK to canonical profile
    - purpose: plugin extension ownership key
  - field name: `availability_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: matching windows/timezones
  - field name: `pairing_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: pairing mode and language preferences
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scoped deletion marker

## 4) Domain Data Owned by Plugin

- Table/entity: `peer_programming_sessions`
  - Contains personal data? yes (participant linkage)
  - Retention period: medium-lived
  - Legal/compliance note: collaboration history
- Table/entity: `peer_programming_matches`
  - Contains personal data? yes
  - Retention period: short/medium-lived
  - Legal/compliance note: recommendation traceability
- Table/entity: `peer_programming_session_notes`
  - Contains personal data? yes (user-authored content)
  - Retention period: user-controlled with policy minimums
  - Legal/compliance note: generated/user content controls apply
- Table/entity: `peer_programming_goals`
  - Contains personal data? yes (`owner_user_id`, the goal the member wrote)
  - Retention period: until the member deletes their account or the PeerProgramming data
  - Legal/compliance note: member-authored; deleted with the member (`del` on `owner_user_id` in `lib/account/deletion-registry.ts`), its tasks go by `ON DELETE CASCADE`
- Table/entity: `peer_programming_goal_tasks`
  - Contains personal data? yes (`taken_by_user_id`, the result a helper wrote)
  - Retention period: lives with its goal
  - Legal/compliance note: a task belongs to the goal's owner; when a helper deletes their account their id is pseudonymized (`pseudo` on `taken_by_user_id`) and the result stays with the goal
- Table/entity: `peer_programming_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, timestamps)
  - Retention period: compliance retention window
  - Legal/compliance note: Rule 114 deletion audit trail

## 5) Service-Scoped Deletion Contract

When user deletes PeerProgramming usage only:

- Delete immediately:
  - `peer_programming_user_extension`
  - user availability and pairing preferences
  - removable user session notes
  - the member's own goal-board goals (`peer_programming_goals`), with their tasks
- Anonymize/pseudonymize:
  - historical session participant references where retention is required
  - the helper's id on goal-board tasks they did for other members (`peer_programming_goal_tasks.taken_by_user_id`)
- Retain for compliance/fraud/finance:
  - policy-required collaboration audit traces
  - `peer_programming_deletion_events`
- Never touch (must remain):
  - canonical profile
  - session data owned by other participants
- User-facing confirmation text:
  - “Delete PeerProgramming plugin data only? Your account remains active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining user-linked sessions/matches/notes where policy allows hard delete
- Cross-service dependencies:
  - full-account orchestrator coordinates deletion lifecycle across all plugins
- Final expected state:
  - no recoverable user-scoped PeerProgramming data except policy-required audit evidence

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - new `peer_programming_user_extension` with default preferences
- Data that is not restored:
  - removed notes and hard-deleted session associations
- Re-consent required? (yes/no):
  - yes (matching and visibility preferences)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - `peer_programming_deletion_events`
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and dependency retries

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/peer-programming-profile` (planned)
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account`
- Status model (`requested`, `processing`, `completed`, `failed`):
  - required for plugin and account deletion flows
- User-facing copy reviewed by:
  - Product, Compliance/Privacy

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order rollback for PeerProgramming-only extension/deletion tables
- Backfill required? (yes/no):
  - no

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## Change Log

- 2026-02-25: Created initial draft.
- 2026-09-25: Added the goal board tables. A member's own goals are deleted with their tasks; their id on tasks they did for other members is pseudonymized and the result stays with that goal.
