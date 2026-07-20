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
2. Schedule and expiry-aware visibility handling.
3. Optional toast presentation through Feed rendering controls.

### 1.2 Audience Targeting Outcomes

1. Role/plugin-membership-targeted visibility.
2. Region and policy-scoped audience constraints.
3. Membership change events trigger recalculation and fan-out updates.

### 1.3 Interaction and Acknowledgement

1. Read/acknowledged status tracking where required.
2. Dismiss behavior for notices (all notices are dismissable — no mandatory flag).
3. Link actions and safe external navigation policies.
4. **Reactions** — members can react to an official announcement with the same fixed emoji quick
   set as a peer post (`FEED_REACTION_EMOJIS`). One reaction per (announcement, member, emoji);
   tapping the same emoji again removes it. Rendered as chips under the announcement card. A member
   may only react to content they did **not** author: reacting to your own announcement/post is
   rejected server-side (`cannot_react_to_own_post`), and the client hides the affordance on own
   content (the count of others' reactions still shows, read-only).
5. **Replies** — members can reply to an official announcement. Replies group under the
   announcement as a thread (loaded on demand when the thread is opened) with a "N replies"
   affordance and an inline composer. Reactions and replies are distinct from the Signal-style
   peer-post quote reply — they are self-contained to the announcement.

---

## 2) Admin Features

### 2.1 Authoring and Publishing

1. Draft, schedule, publish, archive lifecycle management.
2. Targeting controls (segment, role, plugin membership, region).
3. Expiry configuration.

### 2.2 Governance and Review

1. Role-gated approvals for publish/archive operations.
2. Full audit trail for content and targeting mutations.
3. Preview simulation of resulting audience/visibility.

### 2.3 Unified Feed + Announcements Ops

1. Operated from `/admin/feed-announcements`.
2. Coordinated controls with Feed rendering settings.
3. Shared feature-flag and degradation behavior.

---

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface (Authoritative)

All command contracts must conform to templates from:

- `.claude/rules/201-plugin-command-schema-template.mdc`
- `.claude/rules/202-plugin-access-policy-schema-template.mdc`
- `.claude/rules/203-plugin-audit-schema-template.mdc`

Command groups:

1. `announcements.draft.create`
2. `announcements.draft.update`
3. `announcements.publish`
4. `announcements.archive`
5. `announcements.read.mark`
6. `announcements.dismiss`
7. `announcements.targeting.validate`
8. `announcements.membership.event.emit`
9. `feed.announcement.reaction.toggle`
10. `feed.announcement.reply.create`
11. `feed.announcement.reply.list`

### 3.2 HTTP Projection Routes

User routes:

- `GET /api/announcements`
- `POST /api/announcements/:announcementId/read`
- `POST /api/announcements/:announcementId/dismiss`
- `POST /api/announcements/:announcementId/reactions` — toggles the signed-in member's emoji reaction on an official announcement; feed-read gated (`requireFeedReadAccess`) + CSRF (`x-ctf-csrf: '1'`). Body `{ emoji }` (must be in `FEED_REACTION_EMOJIS`, else 400). Backed by `toggleAnnouncementReaction` against `announcement_reactions`; a second tap of the same emoji removes it. Returns `{ ok, reacted }`. Audit: `feed.announcement.reaction.toggle`.
- `GET /api/announcements/:announcementId/replies` — lists the accepted replies on an announcement (oldest-first), each author resolved to a display handle with an `isMine` flag; feed-read gated. Returns `{ ok, announcementId, replies }`.
- `POST /api/announcements/:announcementId/replies` — adds the signed-in member's reply to an announcement; feed-read gated + CSRF. Body `{ body }` (1–`FEED_MAX_COMMUNITY_REPLY_LENGTH` chars, same moderation as a community post, per-member rate limit 20/30min). Backed by `replyToAnnouncement` against `announcement_replies`. Returns `{ ok, reply }`. Audit: `feed.announcement.reply.create`.

Admin routes:

- `POST /api/announcements/admin/drafts`
- `PUT /api/announcements/admin/drafts/:draftId`
- `POST /api/announcements/admin/:announcementId/publish`
- `POST /api/announcements/admin/:announcementId/archive`
- `POST /api/announcements/admin/targeting/validate`
- `POST /api/announcements/membership/events` — records a member join/leave membership event so announcement audience eligibility can be recalculated; admin-gated (`requireFeedAdminAccess`) + CSRF (`x-ctf-csrf: '1'`). Body `{ userId, pluginId, eventType: 'join' | 'leave', requestId?, traceId? }` (`eventType` must be exactly `join` or `leave`, else 400; `userId` and `pluginId` required, else 400). Shares the feed membership-events handler (`emitMembershipEvent`, contracts unified under `feed.*`) and returns `{ ok, streamEmitted }` — the announcements-namespaced twin of `POST /api/feed/membership/events`.

---

## 4) Data Model and Storage Contracts

### 4.1 Canonical Profile and Plugin Extension

Must follow single-profile rule:

1. Reuse canonical user profile fields.
2. Keep plugin extension fields linked by `user_id`.
3. No duplicate full profile table.

Per-user state entity:

- `announcement_user_state` (the real table; there is no separate
  `announcements_user_extension` — that name was a planning-draft phantom)
  - `user_id`
  - `announcement_id`
  - `read_at`, `acknowledged_at`, `dismissed_at` (per-user read/ack/dismiss state)
  - `updated_at`

### 4.2 Domain Entities

Domain tables (as they exist in `ctf/schema.sql`):

1. `announcements` — includes `linked_plugin_slugs JSONB NOT NULL DEFAULT '[]'` (ordered list of 0–3 linked plugin slugs) plus the legacy single-link `linked_plugin_slug TEXT`, kept for back-compat and mirrored to the first entry of the array.
2. `announcement_revisions`
3. `announcement_delivery_events`
4. `announcement_user_state`
5. `announcement_membership_events`
6. `announcement_reactions` — one row per (announcement, member, emoji); unique index
   `idx_announcement_reactions_unique(announcement_id, user_id, emoji)` makes a reaction a toggle.
   `announcement_id` FK → `announcements(id)` `ON DELETE CASCADE`. Mirrors
   `feed_community_post_reactions`. Columns: `id`, `announcement_id`, `user_id`, `emoji`,
   `created_at`.
7. `announcement_replies` — member replies grouped under an announcement as a thread.
   `announcement_id` FK → `announcements(id)` `ON DELETE CASCADE`; indexed
   `idx_announcement_replies_announcement(announcement_id, created_at)`. Mirrors
   `feed_community_replies`, adding `author_username` (captured at reply time for handle display).
   Columns: `id`, `announcement_id`, `author_user_id`, `author_username`, `body`,
   `moderation_status`, `created_at`, `updated_at`.

Targeting reuses the shared `feed_item_targets` table (feed and announcements
are coupled), not a separate `announcement_targets` table. The previously
listed `announcement_targets` and `announcement_admin_audit_trail` were
planning-draft phantoms — they were never created in `schema.sql` and no code
references them, so they are removed here to match the real data model.

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

`ctf/scripts/seedFeedAnnouncements.mjs` seeds deterministic announcement and feed fixtures for dev validation.

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

- 2026-07-20: **Restricted reactions to non-authored content.** A member may no longer react to a post/announcement they authored. Enforced authoritatively in `toggleCommunityPostReaction` and `toggleAnnouncementReaction` (`cannot_react_to_own_post` → HTTP 403); the client also hides the reaction affordance on the member's own content (the `ChatReactionRow` `readOnly` mode still shows others' reaction counts). Contract `denyConditions` / `attributePolicies` updated for `feed.community.post.reaction.toggle` and `feed.announcement.reaction.toggle`.
- 2026-07-20: **Added reactions and replies to official announcements.** Members can now react to an announcement with the fixed emoji quick set and reply to it (previously announcements were one-way). New tables `announcement_reactions` (mirrors `feed_community_post_reactions`) and `announcement_replies` (mirrors `feed_community_replies`, plus `author_username`), both FK → `announcements(id)` `ON DELETE CASCADE` (§4.2). New routes `POST /api/announcements/:announcementId/reactions` (toggle), `GET`/`POST /api/announcements/:announcementId/replies` (§3.2), backed by `toggleAnnouncementReaction`, `replyToAnnouncement`, and `listAnnouncementReplies` in `lib/feed/repository.ts`. The Commons timeline (`listFeedTimeline`) now attaches a per-announcement reaction + reply-count aggregate, carried on the hub message (`announcementId`, `reactions`, `replyCount`) and rendered on the official card (`announcement-card.tsx`); the reaction row was extracted to `chat-reaction-row.tsx` for reuse. New `feed.announcement.reaction.toggle` / `feed.announcement.reply.create` / `feed.announcement.reply.list` command contracts (§3.1). Android parity deferred (the downloadable app is Chyme-only; Commons is served by the mobile-responsive web app).
- 2026-06-25: **Documented the membership-events route** (inventory-debt burn-down — documentation catch-up, no code change). Added `POST /api/announcements/membership/events` (admin-gated join/leave membership event for audience recalculation; the announcements-namespaced twin of the feed membership-events handler) to §3.2 Admin routes. Verified against the route handler. Removed it from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-05-18: Replaced "Web and Android Delivery Plan (Approved)" with canonical "Web and Android Delivery Status" (`web+android complete`); removed web-first/Android-follow-up language. Renamed "Gaps, Ambiguities, and Known Technical Debt (Current)" to canonical "Gaps and Known Technical Debt" and condensed deprecation note. Updated seed coverage to reference shipping seed script.
- 2026-04-05: Deprecated standalone announcements namespace — all contracts unified under `feed.*`.
- 2026-02-25: Added Rule 120 gaps section.
- 2026-02-24: Created initial CTF rewrite Announcements inventory.


## Build Checklist


> **DEPRECATED (2026-04-05):** The standalone Announcements checklist has been merged into the unified **Feed Rewrite Checklist** (`ctf-feed-feature-inventory.md`). All announcement commands now use the `feed.announcement.*` namespace. Authoritative contracts are in `FEED_PLUGIN_COMMAND_CONTRACTS.yaml`, `FEED_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`, and `FEED_PLUGIN_AUDIT_CONTRACTS.yaml`. This file is retained for historical reference only.

### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation requirement is placed on `platform/` code.
- [x] Confirm centralized admin surface.
  - Acceptance criteria:
    - Announcements admin operations are implemented in `/admin/feed-announcements`.
- [x] Confirm web-first policy with deferred Android tracking.
  - Acceptance criteria:
    - Android follow-up ticket exists with owner and due date.

### �� Contracts and Naming Lock

- [x] Define Announcements command contracts.
  - Acceptance criteria:
    - Commands comply with `.claude/rules/201-plugin-command-schema-template.mdc`.
- [x] Define Announcements access policy contracts.
  - Acceptance criteria:
    - Policies comply with `.claude/rules/202-plugin-access-policy-schema-template.mdc`.
- [x] Define Announcements audit contracts.
  - Acceptance criteria:
    - Audit events comply with `.claude/rules/203-plugin-audit-schema-template.mdc` for allow/deny parity.
- [x] Lock naming normalization and legacy alias handling.
  - Acceptance criteria:
    - New docs/contracts use **Announcements** spelling; legacy typo alias note is documented for compatibility.

### �� Schema and Migration Readiness

- [x] Implement Announcements domain schema.
  - Acceptance criteria:
    - Announcement lifecycle, targeting, user-state, and audit entities are present with constraints.
- [x] Add migration SQL under `ctf/migrations/`.
  - Acceptance criteria:
    - Replay and rollback behavior is validated.
- [x] Implement membership event stream entities/contracts.
  - Acceptance criteria:
    - Membership changes can trigger audience recalculation in a deterministic way.
- [x] Run schema drift predeployment checks.
  - Acceptance criteria:
    - Drift status across migration SQL, app schema, and API contracts is attached to PR.

### �� API and Projection Pipeline

- [x] Implement draft/create/update/publish/archive API and command flows.
  - Acceptance criteria:
    - Validation, authz, and audit behavior is deterministic and complete.
- [x] Enforce Postgres canonical write-first flow.
  - Acceptance criteria:
    - Announcement state is committed before Stream projection.
- [x] Implement Stream fan-out projection and replay safety.
  - Acceptance criteria:
    - Projection is idempotent and safe under retries.
- [x] Implement read/dismiss/acknowledge user-state endpoints.
  - Acceptance criteria:
    - User-state transitions are policy-compliant and auditable.

### �� Web Delivery

- [x] Implement authoring and publish UX on `/admin/feed-announcements`.
  - Acceptance criteria:
    - Draft/schedule/publish/archive and targeting controls are operable.
- [x] Implement announcement rendering in Feed.
  - Acceptance criteria:
    - Expiry behavior and visibility targeting are correct.
- [x] Integrate optional toast mode under Feed controls.
  - Acceptance criteria:
    - Toast mode is optional and managed via Feed configuration.

### �� Android Follow-Up (Required — see Feed Checklist Phase 6)

- [ ] All Android parity items are now tracked in `ctf-feed-feature-inventory.md` Phase 6.
  - Acceptance criteria:
    - See unified feed checklist for acceptance criteria.

### �� Security, Compliance, and Hardening

- [x] Document policy and CSRF handling.
  - Acceptance criteria:
    - State-changing routes document authz + CSRF handling.
- [x] Document deletion and retention contracts.
  - Acceptance criteria:
    - Plugin deletion/full-account deletion mapping is documented against `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.
- [x] Document log redaction and audit completeness.
  - Acceptance criteria:
    - Operational logs are safe; required audit fields are documented.

### Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [x] Seed scenarios and data setup.
  - Acceptance criteria:
    - Seeds include lifecycle variants, targeting variants, and user-state variants.
- [x] Implementation documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Command, targeting, and membership event behavior are documented.

### Quota-Impact and Predeployment Evidence

- [x] Add stream quota-impact note for fan-out or targeting scale changes.
  - Acceptance criteria:
    - Note is created with `ctf/docs/quota-impact/TEMPLATE.md` and linked in PR.
- [x] Include schema drift predeployment evidence.
  - Acceptance criteria:
    - PR includes drift-check output and migration verification artifacts.
- [ ] Implementation tracking. [EVIDENCE CAPTURE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; detailed evidence collection deferred to post-MVP.

### Change Log

- 2026-02-24: Created initial Announcements rewrite checklist with approved central admin page, web-first policy + Android follow-up tracking, naming normalization/legacy alias guidance, Postgres+Stream architecture constraints, stream quota-impact gate, and schema drift predeployment evidence requirements.
- 2026-03-02: Completed phase-0 implementation with combined feed stream coupling, admin lifecycle routes, membership-event visibility recalculation, and deterministic seed coverage.
- 2026-04-05: Deprecated — merged into unified Feed Rewrite Checklist. All commands now under `feed.announcement.*` namespace.
- 2026-06-12: The Android announcements API client (`packages/mobile/src/features/announcements/api.ts`, reading the feed `announcements` channel) now uses the shared authenticated fetch helper — every call carries the signed-in member's Clerk bearer token and the server address comes from runtime config (APP_URL) — replacing plain dev-only fetch against hardcoded development URLs. Removed the unused `fetchAnnouncementsStreamCredentials.ts`, which pointed at a route that does not exist (`/api/announcements/stream`).
- 2026-07-17: Removed the retired `priority` and `mandatory` fields from the Android `AnnouncementItem` type — the web `/api/feed/items` timeline stopped returning them when priority/mandatory were retired, so they were always undefined on Android. Dropped the leftover "URGENT" badge and "Required reading" pill from the Android announcement card (both keyed off those dead fields), matching the web retirement of the urgent styling. Added an in-flight guard to the Android announcements load so a pull-to-refresh cannot race a background load and overwrite newer data with an older response (code-review finding).
- 2026-07-17: Brought the `/api/announcements/**` route handlers into line with their declared command and audit contracts (code-review findings). The read and dismiss routes now return the contract-declared `readAt` / `dismissedAt` timestamps. Draft create/update and the membership-event emit route now write `logFeedAudit` entries (`feed.announcement.draft.create` / `feed.announcement.draft.update` / `feed.membership.event.emit`) on both success and failure paths. Draft input validation now rejects an absent or non-object `targeting` (the contract marks it required) instead of silently coercing it to `{}`, and the membership-event route rejects an `eventType` that is not exactly `join` or `leave` instead of defaulting it to `join`.
- 2026-07-18: Reshaped the admin lifecycle route responses to match their declared command output schemas (code-review findings). Publish now returns `{ announcementId, status, publishedAt }`, archive returns `{ announcementId, status, archivedAt }` (the archive timestamp is the row's `updated_at`, since there is no separate `archived_at` column), and draft create/update return `{ announcementId, status, createdAt }` / `{ announcementId, status, updatedAt }` — replacing the raw `{ announcement }` object each previously returned. Added clarifying comments on the publish/archive failure-path audit calls noting that `status: 'allow'` is the policy-gate decision (the actor was an authorized admin), while `result: 'failure'` carries the operation outcome.
- 2026-07-18: Fixed a regression: the earlier "targeting required" check in `validateAnnouncementDraftInput` broke the shipped admin Create-draft flow, which failed with "Invalid announcement draft payload" for every draft. The admin authoring UI has no targeting control and posts drafts without a `targeting` field (meaning broadcast to everyone, `normalizeTargeting` → `{}`), so targeting is now optional again. A supplied `targeting` must still be a plain object — an array or other non-object value is rejected.
- 2026-07-18: An announcement can now link **up to 3 plugins** (owner directive: more than 3 is information overload). Added `announcements.linked_plugin_slugs JSONB NOT NULL DEFAULT '[]'` (schema.sql, with a guarded backfill from the legacy single-link `linked_plugin_slug`, which is kept and mirrored to the first entry for back-compat). The command input on `feed.announcement.draft.create` / `feed.announcement.draft.update` changed from `linkedPluginSlug` (string) to `linkedPluginSlugs` (array, capped at 3); `validateAnnouncementLinkedPluginSlugs` trims/dedupes/drops unknown or admin-only slugs and caps at 3. `createAnnouncementDraft` / `updateAnnouncementDraft` store the array (absent keeps existing on update; empty clears); the published feed body appends one `Open <Plugin>: <url>` line per link. The admin authoring UI (`feed-announcements-admin-shell.tsx`) now picks up to 3 plugins as removable chips plus an "add" dropdown that disables at 3. Also fixed a latent gap where the admin PUT route never applied a changed link (its `parseBody` omitted the field). `Announcement.linkedPluginSlugs` replaces `linkedPluginSlug` throughout. Rendering is web / mobile-responsive only — the native Android Hub was removed upstream (Chyme is now the mobile home surface).
