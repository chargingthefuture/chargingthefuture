# Directory Profile and Deletion Contract (Draft)

## 1) Plugin Metadata

- Plugin Name: Directory
- Service Key (lowercase, stable): `directory`
- Owner Team: Directory Platform (proposed)
- Rollout Stage: Planning

## 2) Canonical Profile Usage

Rule 114 baseline: Directory extends the canonical profile by `user_id` and avoids separate identity systems.

- Read fields:
  - `user_id`
  - display name
  - avatar URL
  - locale/timezone
  - role/workspace membership
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - profile ownership, visibility, and moderation policy checks

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): `directory_user_extension`
- Fields:
  - field name: `user_id`
    - type: uuid
    - nullable/default: non-null, unique, FK to canonical profile
    - purpose: plugin extension ownership key
  - field name: `profile_visibility`
    - type: enum (`private` | `workspace` | `public`)
    - nullable/default: default `workspace`
    - purpose: visibility controls
  - field name: `contact_preferences`
    - type: jsonb
    - nullable/default: default `{}`
    - purpose: discoverability/contact settings
  - field name: `service_deleted_at`
    - type: timestamptz
    - nullable/default: nullable
    - purpose: plugin-scoped deletion marker

## 4) Domain Data Owned by Plugin

- Table/entity: `directory_profiles`
  - Contains personal data? yes
  - Retention period: long-lived while active
  - Legal/compliance note: authoritative profile projection
- Table/entity: `directory_profile_tags`
  - Contains personal data? yes (profile linkage)
  - Retention period: long-lived
  - Legal/compliance note: search/filter metadata
- Table/entity: `directory_profile_proposed_skills`
  - Contains personal data? yes (member-authored free-text skill labels on their own profile)
  - Retention period: long-lived while the profile is active
  - Legal/compliance note: "skill not listed" entries awaiting admin promotion into the taxonomy; keyed by `profile_id`, cascades with the profile on deletion
- Table/entity: `directory_profile_change_events`
  - Contains personal data? minimal actor linkage
  - Retention period: compliance retention window
  - Legal/compliance note: change accountability
- Table/entity: `directory_admin_audit_trail`
  - Contains personal data? minimal (the acting admin's id, and the id of what was acted on)
  - Retention period: compliance retention window
  - Legal/compliance note: the durable record of every admin action, added 2026-08-28. Append-only and **never** removed by a member's service-scoped or full-account deletion — the record of what an admin did has to outlive the record they did it to, or a takedown erases its own evidence. Holds no member-authored content.
- Table/entity: `directory_deletion_events`
  - Contains personal data? minimal (`user_id`, scope, timestamps)
  - Retention period: compliance retention window
  - Legal/compliance note: Rule 114 deletion audit trail

## 5) Service-Scoped Deletion Contract

When user deletes Directory usage only:

- Delete immediately:
  - `directory_user_extension` and optional discoverability preferences
  - `directory_profile_skills` and `directory_profile_proposed_skills` for the user's profile (profile_id-keyed child rows)
- Anonymize/pseudonymize:
  - directory profile projection where historical records must remain
- Retain for compliance/fraud/finance:
  - `directory_profile_change_events`
  - `directory_deletion_events`
- Never touch (must remain):
  - canonical profile
  - non-Directory plugin data
- User-facing confirmation text:
  - “Delete Directory plugin data only? Your account remains active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining user-linked Directory profile and preference records
- Cross-service dependencies:
  - orchestrator coordinates removal of Directory links referenced by other plugins
- Final expected state:
  - no recoverable user-scoped Directory profile data except policy-required audit artifacts

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - new `directory_user_extension` and empty profile draft state
- Data that is not restored:
  - deleted profile content and historical preferences
- Re-consent required? (yes/no):
  - yes (discoverability and contact preferences)

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - `directory_deletion_events`
- Who can trigger deletion:
  - authenticated user (self)
  - full-account orchestrator/system actor
- Alerting/monitoring requirement:
  - alert on deletion failures and dependency-resolution retries

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/directory-profile` (planned)
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
  - reverse-order rollback for Directory-only extension/deletion tables
- Backfill required? (yes/no):
  - yes (for existing directory rows mapped to canonical `user_id`)

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed

## Change Log

- 2026-02-25: Created initial draft.
- 2026-06-25: Added `directory_profile_proposed_skills` (member-authored "skill not listed" free-text labels on their own profile, pending admin promotion). Profile_id-keyed; cleared with the profile in service-scoped deletion.
- 2026-07-16: Added `directory_suppressed_quora_urls` (the "remove at the person's request" takedown suppression list). Retention: when a community-generated profile is taken down at the person's request, the profile row is deleted but the **normalized Quora URL + reason** are retained here — this is the minimal data needed to honor "do not list me again" and block the URL from being re-added. An admin override lifts the block (stamps the override fields) but the row is retained as an accountability record. This table is not written by ordinary self/admin deletion, and is not cleared by service-scoped deletion (it is a suppression record, not member profile data).
