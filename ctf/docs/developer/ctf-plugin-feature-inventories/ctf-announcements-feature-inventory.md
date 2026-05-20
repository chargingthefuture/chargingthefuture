# Announcements Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `Announcements`
- Plugin slug: `feed-announcements` (registry alias: `announcements`)
- Owned surfaces: `/apps/announcements` (web), admin control at `/admin/feed-announcements`, `/api/announcements/*` and `/api/feed/admin/announcements/*` routes, announcement state in the Feed schema.
- Not owned: identity (Clerk), Feed timeline rendering primitives (Feed plugin).

## Intent and Outcome

Announcements provides trusted, policy-compliant broadcast messaging to target survivor audiences and renders into Feed experiences.

Architecture decisions in effect:

1. PostgreSQL is the canonical source-of-truth for announcement lifecycle state.
2. Stream is used for fan-out and delivery projection after canonical persistence.
3. Admin workflow is centralized at `/admin/feed-announcements`.

Approved suggestions incorporated:

1. Standardize naming to **Announcements** in current docs/contracts.
2. Keep legacy typo alias note for compatibility where old naming appears.
3. Use plugin membership event stream to recalculate audience eligibility when membership changes.
4. Allow optional toast rendering mode controlled by Feed configuration, not standalone announcement-only UI mode.

---

## 1) User-Facing Features

### 1.1 Announcement Delivery and Rendering

1. In-feed announcement cards with clear state and metadata.
2. Priority, schedule, and expiry-aware visibility handling.
3. Optional toast presentation through Feed rendering controls.

### 1.2 Audience Targeting Outcomes

1. Role/plugin-membership-targeted visibility.
2. Region and policy-scoped audience constraints.
3. Membership change events trigger recalculation and fan-out updates.

### 1.3 Interaction and Acknowledgement

1. Read/acknowledged status tracking where required.
2. Dismiss behavior for non-mandatory notices.
3. Link actions and safe external navigation policies.

---

## 2) Admin Features

### 2.1 Authoring and Publishing

1. Draft, schedule, publish, archive lifecycle management.
2. Targeting controls (segment, role, plugin membership, region).
3. Priority and expiry configuration.

### 2.2 Governance and Review

1. Role-gated approvals for publish/archive operations.
2. Full audit trail for content and targeting mutations.
3. Preview simulation of resulting audience/visibility.

### 2.3 Unified Feed + Announcements Ops

1. Operated from `/admin/feed-announcements`.
2. Coordinated controls with Feed rendering settings.
3. Shared kill-switch/feature-flag and degradation behavior.

---

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface (Authoritative)

All command contracts must conform to templates from:

- `.github/instructions/201-plugin-command-schema-template.mdc`
- `.github/instructions/202-plugin-access-policy-schema-template.mdc`
- `.github/instructions/203-plugin-audit-schema-template.mdc`

Command groups:

1. `announcements.draft.create`
2. `announcements.draft.update`
3. `announcements.publish`
4. `announcements.archive`
5. `announcements.read.mark`
6. `announcements.dismiss`
7. `announcements.targeting.validate`
8. `announcements.membership.event.emit`

### 3.2 HTTP Projection Routes

User routes:

- `GET /api/announcements`
- `POST /api/announcements/:announcementId/read`
- `POST /api/announcements/:announcementId/dismiss`

Admin routes:

- `POST /api/announcements/admin/drafts`
- `PUT /api/announcements/admin/drafts/:draftId`
- `POST /api/announcements/admin/:announcementId/publish`
- `POST /api/announcements/admin/:announcementId/archive`
- `POST /api/announcements/admin/targeting/validate`

---

## 4) Data Model and Storage Contracts

### 4.1 Canonical Profile and Plugin Extension

Must follow single-profile rule:

1. Reuse canonical user profile fields.
2. Keep plugin extension fields linked by `user_id`.
3. No duplicate full profile table.

Extension entity:

- `announcements_user_extension`
  - `user_id`
  - acknowledgement preferences,
  - delivery preference flags,
  - mute/dismiss policy preferences where permitted.

### 4.2 Domain Entities

Domain tables:

1. `announcements`
2. `announcement_revisions`
3. `announcement_targets`
4. `announcement_delivery_events`
5. `announcement_user_state`
6. `announcement_membership_events`
7. `announcement_admin_audit_trail`

### 4.3 Source-of-Truth and Fan-Out

1. Persist canonical announcement state in PostgreSQL first.
2. Project to Stream fan-out layer only after successful DB transaction.
3. Maintain idempotent projection and replay safety.

---

## 5) Security, Privacy, and Compliance Controls

1. Server-side role and consent checks for all publish/mutate operations.
2. Deny-by-default access for cross-tenant/cross-region reads.
3. CSRF and input validation on state-changing web endpoints.
4. Allow/deny audit events for command execution and admin actions.
5. Redaction policy for sensitive operational logs.
6. Deletion and retention behavior aligned with `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.

---

## 6) Web and Android Delivery Status

`web+android complete`. Announcements command namespace lives under `feed.announcement.*` (see Feed inventory); critical compliance and visibility semantics are consistent across web (`/apps/announcements`) and Android (`packages/mobile/src/features/announcements`).

---

## 7) Quota-Impact and Stream Budget Notes

1. Targeting/fan-out changes require a stream quota-impact note.
2. Quota-impact notes use `ctf/docs/quota-impact/TEMPLATE.md`.
3. Deployment PRs link the quota note when fan-out volume changes.

---

## 8) Seed Coverage Status

`ctf/scripts/seedFeedAnnouncementsPhase0.mjs` seeds deterministic announcement and feed fixtures for dev validation.

---

## 9) Schema Drift and Predeployment Expectations

1. Predeployment requires schema drift checks across migration SQL, application schema, and API contracts.
2. Any accepted drift includes explicit rationale and rollback path.
3. Deployment PR evidence includes migration replay + rollback verification and drift-check output.

---

## 10) Gaps and Known Technical Debt

1. Standalone `announcements.*` command namespace has been unified into `feed.*` as of 2026-04-05. The separate `ANNOUNCEMENTS_PLUGIN_*_CONTRACTS.yaml` files remain for historical reference only and must not be used for new implementation; their continued presence is intentional historical reference and is a known cleanup item.

---

## 11) Change Log

- 2026-05-18: Replaced "Web and Android Delivery Plan (Approved)" with canonical "Web and Android Delivery Status" (`web+android complete`); removed web-first/Android-follow-up language. Renamed "Gaps, Ambiguities, and Known Technical Debt (Current)" to canonical "Gaps and Known Technical Debt" and condensed deprecation note. Updated seed coverage to reference shipping seed script.
- 2026-04-05: Deprecated standalone announcements namespace — all contracts unified under `feed.*`.
- 2026-02-25: Added Rule 120 gaps section.
- 2026-02-24: Created initial CTF rewrite Announcements inventory.
