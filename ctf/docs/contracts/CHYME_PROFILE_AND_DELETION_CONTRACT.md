# Chyme Profile and Deletion Contract

## 1) Plugin Metadata

- Plugin Name: Chyme
- Service Key (lowercase, stable): `chyme`
- Owner Team: Plugin Phase-0 Stream (agent-00-chyme-core)
- Rollout Stage: MVP (internal/private)

## 2) Canonical Profile Usage

Current implementation reads user identity from the provider-neutral server auth context.

- Read fields:
  - canonical handle (`username`) for `@mention`/identity-handle consistency
  - display fallback (`firstName`, `lastName`) when username is unavailable
  - avatar (`imageUrl`)
- Write fields:
  - none currently written to canonical profile by Chyme routes
- Why canonical fields are needed:
  - show consistent participant identity in room roster/chat
  - avoid separate plugin identity records
  - enforce shared handle contract with other plugins per `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`

Chyme handle contract decision:

- Canonical handle is the active auth provider's `username` or equivalent handle field.
- Chyme must not create plugin-local username ownership fields.
- If the canonical provider handle is missing, Chyme must show non-handle display fallback and treat `@mention` targeting as unavailable.

## 3) Plugin Extension Fields

- Storage location (table or json path): `chyme_service_profiles`
- Fields:
  - `user_id`
  - `status` (`active` | `deleted`)
  - `created_at`
  - `updated_at`
  - `deleted_at`
- Purpose:
  - service-scoped activation/deletion lifecycle for Chyme without deleting account-level profile

## 4) Domain Data Owned by Plugin

- Table/entity: `chyme_rooms`
  - Contains personal data? no (room metadata only)
  - Retention period: persistent while feature is active
  - Legal/compliance note: no direct user PII fields
- Table/entity: `chyme_room_members`
  - Contains personal data? yes (`user_id`, `username`, optional avatar URL)
  - Retention period: until service-scoped delete or policy change
  - Legal/compliance note: considered service participation metadata
- Table/entity: `chyme_messages`
  - Contains personal data? yes (`user_id`, message text, `username`)
  - Retention period: currently retained until service-scoped delete by sender
  - Legal/compliance note: high-sensitivity user content; avoid logging payloads
- Table/entity: `chyme_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, service_name, timestamp)
  - Retention period: retained as compliance/audit evidence
  - Legal/compliance note: should be part of deletion accountability trail

## 5) Service-Scoped Deletion Contract

When user deletes Chyme usage only (`DELETE /api/account/chyme-profile`):

- Delete immediately:
  - `chyme_room_members` row for `(room_id = chyme-main-room, user_id)`
  - `chyme_messages` rows for `(room_id = chyme-main-room, user_id)`
  - Stream copy: the member's Stream user `chyme-<user_id>` is hard-deleted with `mark_messages_deleted` (`deleteChymeStreamData`), so the chat messages fanned out to Stream are removed too, not only the Postgres rows. Best-effort after the Postgres delete commits — a Stream outage is logged and never blocks the deletion; the audit event records `streamCleared`.
- Anonymize/pseudonymize:
  - none currently (hard delete for user-owned member/message rows, on Postgres and Stream)
- Retain for compliance/fraud/finance:
  - `chyme_deletion_events` service-scope record
- Never touch (must remain):
  - canonical account identity and non-Chyme services
  - shared room metadata (`chyme_rooms`)
- User-facing confirmation text:
  - “Delete Chyme service data only? Your account will remain active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion (`DELETE /api/account/full-account`):

- Additional records removed vs service-scoped deletion:
  - currently none immediately; request is recorded and downstream reclaim dependency is queued
  - Stream copy: same as service scope — the member's Stream user `chyme-<user_id>` is hard-deleted (`deleteChymeStreamData`), best-effort after the registry-driven Postgres delete, so the Stream copy does not outlive the account. The registry/orchestrator itself is Postgres-only (no external-store hook), so this Stream cleanup is called from the full-account route.
- Cross-service dependencies:
  - requires global account deletion orchestrator across all plugin domains
  - ServiceCredits reclaim/finalization is required before account deletion can be marked `completed`
- Final expected state:
  - account-scope request remains `requested` until global orchestrator transitions to `processing` then terminal state (`completed`/`failed`)

## 7) Rejoin/Re-enable Behavior

If user returns to Chyme after service-scoped deletion:

- Recreated defaults:
  - `chyme_service_profiles.status` set back to `active`
  - room membership row recreated on room/join/message operations
- Data that is not restored:
  - prior deleted chat messages and membership history
- Re-consent required? (yes/no):
  - no (MVP policy), with future consent-policy revision owned by compliance stream

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `service_name`, `requested_at`
- Event table/path:
  - `chyme_deletion_events`
- Who can trigger deletion:
  - authenticated end user for own account
- Alerting/monitoring requirement:
  - route-level audit events are emitted; dashboard aggregation is a post-MVP operational item

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/chyme-profile`
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account` (records request and queues ServiceCredits reclaim dependency)
- Status model (`requested`, `processing`, `completed`, `failed`):
  - currently synchronous `ok` response for service delete
  - full-account currently returns `requested` while async orchestrator states remain external to Chyme
- User-facing copy reviewed by:
  - pending formal product/compliance copy review in post-MVP hardening

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - drop Chyme-only tables/indexes in reverse dependency order if needed:
    - `chyme_messages`
    - `chyme_room_members`
    - `chyme_service_profiles`
    - `chyme_deletion_events`
    - `chyme_rooms`
- Backfill required? (yes/no):
  - no (new tables)

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [x] Web and Android parity confirmed
