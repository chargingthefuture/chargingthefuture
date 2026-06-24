# SkillsHunt Profile and Deletion Contract (Draft)

This draft uses `PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.

## 1) Plugin Metadata

- Plugin Name: SkillsHunt
- Service Key (lowercase, stable): `skills-hunt`
- Owner Team: Community Growth Platform (proposed), Trust & Safety Moderation (proposed)
- Rollout Stage: Planning (pre-runtime)

## 2) Canonical Profile Usage

SkillsHunt uses canonical profile fields for account identity, role checks, and user-scoped reward/notification ownership.

- Read fields:
  - `user_id`
  - display name reference
  - role memberships for contributor/moderator/admin policy checks
  - region/workspace context
- Write fields:
  - none to canonical profile
- Why canonical fields are needed:
  - keep user identity and authorization centralized
  - avoid duplicate profile storage in plugin tables

## Identity Handle Baseline

- Canonical handle source: the active auth provider's canonical `username` or equivalent handle field (see `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`).
- Plugin must not create plugin-local username ownership models.
- If the canonical provider handle is missing, use non-handle display fallback and treat `@mention` targeting as unavailable.
- Any persisted username snapshot fields must be derived from the canonical provider handle at write time.

## 3) Plugin Extension Fields

- Storage location (table or json path): plugin-owned domain tables (`skills_hunt_achievements`, `skills_hunt_notifications`, submission ownership columns)
- Fields:
  - field name: `submitter_user_id`
    - type: text/uuid-compatible identifier
    - nullable/default: non-null
    - purpose: contributor ownership for submissions
  - field name: `user_id` (achievements/notifications)
    - type: text/uuid-compatible identifier
    - nullable/default: non-null
    - purpose: reward and notification ownership

## 4) Domain Data Owned by Plugin

- Table/entity: `skills_hunt_rounds`
  - Contains personal data? minimal (creator/updater identity)
  - Retention period: long-lived planning/audit history
  - Legal/compliance note: campaign governance metadata
- Table/entity: `skills_hunt_submissions`
  - Contains personal data? yes (submitter linkage + submitted profile content)
  - Retention period: transactional long-lived per moderation policy
  - Legal/compliance note: moderation and anti-abuse evidence required
- Table/entity: `skills_hunt_leaderboard`
  - Contains personal data? limited display identifiers
  - Retention period: medium/long-lived per season history policy
  - Legal/compliance note: public ranking projection, minimize sensitive fields
- Table/entity: `skills_hunt_achievements`
  - Contains personal data? yes (user linkage)
  - Retention period: long-lived reward history
  - Legal/compliance note: user reward evidence
- Table/entity: `skills_hunt_notifications`
  - Contains personal data? yes (user linkage)
  - Retention period: medium-lived operational
  - Legal/compliance note: avoid sensitive free-text in payloads
- Table/entity: `skills_hunt_directory_profiles`
  - Contains personal data? yes (community-sourced profile projection)
  - Retention period: long-lived until claim or policy removal
  - Legal/compliance note: must remain unclaimed projection until Directory ownership flow completes
- Table/entity: `skills_hunt_audit_log`
  - Contains personal data? minimal actor linkage
  - Retention period: compliance retention window
  - Legal/compliance note: append-only audit evidence

## 5) Service-Scoped Deletion Contract

When user deletes SkillsHunt plugin usage only:

- Delete immediately:
  - user-scoped notification records in `skills_hunt_notifications`
  - user-scoped achievement projection rows where policy permits removal
- Anonymize/pseudonymize:
  - historical submission ownership fields where retention requires record preservation
- Retain for compliance/fraud/finance:
  - moderation decisions and audit records in `skills_hunt_audit_log`
  - anti-abuse evidence associated with reviewed submissions per retention policy
- Never touch (must remain):
  - canonical profile identity
  - Directory authoritative ownership records
  - non-user-scoped round governance records
- User-facing confirmation text:
  - “Delete SkillsHunt plugin data only? Your account and other services remain active.”

## 6) Full-Account Deletion Contract

When user requests full account deletion:

- Additional records removed vs service-scoped deletion:
  - remaining user-linked SkillsHunt notifications and achievements
  - user ownership links in plugin tables where hard delete is policy-allowed
- Cross-service dependencies:
  - full-account orchestrator must coordinate canonical identity and plugin deletions
  - Directory profile ownership/claim logic remains Directory-governed
- Final expected state:
  - no recoverable user-scoped SkillsHunt data linked to deleted account except policy-required compliance artifacts

## 7) Rejoin/Re-enable Behavior

If user returns after service-scoped deletion:

- Recreated defaults:
  - empty notification state and fresh plugin participation state
- Data that is not restored:
  - deleted user-scoped notification state and removable reward state
- Re-consent required? (yes/no):
  - yes, for plugin notification preferences and any optional profile-sharing surfaces

## 8) Audit and Events

- Deletion event schema fields:
  - `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`
- Event table/path:
  - centralized account deletion events + `skills_hunt_audit_log` for plugin traces
- Who can trigger deletion:
  - authenticated end user (self scope), authorized orchestrator/system actor (full account)
- Alerting/monitoring requirement:
  - alert on deletion failures, repeat retries, and unusual volume spikes

## 9) API and UX Surface

- Service delete endpoint:
  - `DELETE /api/account/skills-hunt-profile` (planned)
- Full account delete endpoint (or orchestrator):
  - `DELETE /api/account/full-account` (platform orchestrator)
- Status model (`requested`, `processing`, `completed`, `failed`):
  - required for plugin and full-account flows
- User-facing copy reviewed by:
  - Product, Compliance/Privacy, Trust & Safety

## 10) Migration and Rollback

- Migration file(s):
  - All schema changes are made directly in `ctf/schema.sql` (canonical source of truth).
- Rollback approach:
  - reverse-order plugin table rollback with retention safeguards
- Backfill required? (yes/no):
  - yes (for round, leaderboard, and reward seed data as needed)

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [ ] Observability added (without sensitive payloads)
- [ ] Web and Android parity confirmed
