# Feed Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `Feed`
- Plugin slug: `feed-announcements` (registry alias: `feed`)
- Owned surfaces: `/apps/feed` (web), `packages/mobile/src/features/feed` (Android), `/api/feed/*` routes, feed/announcement/question/community schema tables.
- Admin control location: `/admin/feed-announcements`.
- Three-channel surface: Announcements, Questions (LLM-assisted Q&A), and Community Support.
- Command namespace: unified `feed.*` (no separate `announcements.*` namespace).

## Intent and Outcome

Feed is the survivor-facing timeline and discovery surface combining community activity, announcements, LLM-assisted Q&A, and peer support into a unified three-channel experience.

Architecture decisions in effect:

1. Source-of-truth for persisted feed/announcement/question/community objects is PostgreSQL.
2. Stream (GetStream) is used for fan-out and timeline delivery behavior, not canonical storage.
3. Admin operations for Feed + Announcements are centralized at `/admin/feed-announcements`.
4. LLM-assisted Q&A uses approved data sources only; inference logs are audited.
5. All command contracts use the unified `feed.*` namespace.

---

## 1) User-Facing Features

### 1.1 Feed Timeline Core (Unified)

1. Paginated timeline of feed items across all three channels with deterministic ordering.
2. Channel filter controls: all, announcements, questions, community.
3. Plugin-scoped activity and announcement visibility filters.
4. Empty/error/loading states with accessible fallback messaging.

### 1.2 Channel: Announcements

1. Announcement items render in-feed using shared card contract.
2. Priority and expiry windows influence rank/visibility.
3. Optional toast rendering mode is configurable under Feed display controls.

### 1.3 Channel: Questions (LLM-Assisted Q&A)

1. Users submit natural-language questions (e.g., "Find me housing within 10 miles of 90210").
2. Questions are categorized (housing, services, general, safety, benefits) with optional location context.
3. LLM-generated answers are produced from approved data sources with confidence score and source attribution.
4. Community members can also reply to questions with peer answers.
5. Users can rate answers (helpful, not helpful, flagged) for quality feedback loop.

### 1.4 Channel: Community Support

1. Community support posts for peer-to-peer engagement (general, peer support, resource sharing, events).
2. Threaded replies on community posts.
3. Content moderation and rate limiting on post creation.

### 1.5 Membership-Aware Personalization

1. Membership changes trigger visibility recalculation.
2. Membership event stream is used for fan-out invalidation/update workflows.
3. Non-member and member experiences remain policy-compliant and auditable.

### 1.6 Interaction and Read-State

1. Mark-read / unread tracking per user and item.
2. Dismiss/hide actions for non-mandatory announcements.
3. Link-out behavior with safe redirect and telemetry.

---

## 2) Admin Features

### 2.1 Central Admin Surface

1. Single admin page at `/admin/feed-announcements` for Feed + Announcements controls.
2. Role-gated create/edit/publish/archive actions.
3. Moderation and publish-state controls with auditability.

### 2.2 Feed Rendering Controls

1. Global rendering-mode configuration (card-only, card+toast where allowed).
2. Channel enable/disable controls.
3. Priority and targeting rules management.
4. Preview/simulation mode before publish.

### 2.3 Governance and Operational Visibility

1. Change history and actor attribution for admin mutations.
2. Quota-impact awareness for Stream fan-out heavy changes.
3. Feature flag and kill-switch controls.
4. LLM inference monitoring: model ID, confidence, source attribution, quality ratings.

---

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface (Authoritative — Unified `feed.*` Namespace)

All command contracts must conform to templates from:

- `.github/instructions/201-plugin-command-schema-template.mdc`
- `.github/instructions/202-plugin-access-policy-schema-template.mdc`
- `.github/instructions/203-plugin-audit-schema-template.mdc`

**Timeline (unified):**

1. `feed.timeline.fetch` (v2.0.0 — supports channel filter)
2. `feed.item.read.mark`
3. `feed.item.dismiss`

**Announcements:** 4. `feed.announcement.draft.create` 5. `feed.announcement.draft.update` 6. `feed.announcement.publish` 7. `feed.announcement.archive` 8. `feed.announcement.read.mark` 9. `feed.announcement.dismiss` 10. `feed.announcement.render-mode.update` 11. `feed.announcement.targeting.validate`

**Questions (LLM-assisted Q&A):** 12. `feed.question.submit` 13. `feed.question.answer.generate` 14. `feed.question.answer.rate`

**Community Support:** 15. `feed.community.post.create` 16. `feed.community.post.reply`

**Admin / Governance:** 17. `feed.admin.config.update` 18. `feed.membership.event.emit`

### 3.2 HTTP Projection Routes

User routes:

- `GET /api/feed/items` (supports `?channel=` filter)
- `POST /api/feed/items/:itemId/read`
- `POST /api/feed/items/:itemId/dismiss`
- `GET /api/feed/config`
- `POST /api/feed/questions`
- `POST /api/feed/questions/:questionId/answer`
- `POST /api/feed/answers/:answerId/rate`
- `POST /api/feed/community/posts`
- `POST /api/feed/community/posts/:postId/reply`

Admin routes:

- `GET /api/feed/admin/config`
- `PUT /api/feed/admin/config`
- `POST /api/feed/admin/announcements`
- `PUT /api/feed/admin/announcements/:announcementId`
- `POST /api/feed/admin/announcements/:announcementId/publish`
- `POST /api/feed/admin/announcements/:announcementId/archive`

---

## 4) Data Model and Storage Contracts

### 4.1 Canonical Profile and Plugin Extension

Must follow single-profile rule:

1. Reuse canonical user profile for identity and baseline preferences.
2. Plugin extension data is keyed by `user_id` only.
3. No duplicate full profile table for Feed.

Extension entity:

- `feed_user_extension`
  - `user_id`
  - feed preference flags,
  - read-state settings,
  - toast rendering preference where permitted.

### 4.2 Domain Entities

Domain tables:

**Existing (implemented):**

1. `feed_items`
2. `feed_item_targets`
3. `feed_user_read_state`
4. `feed_user_dismissals`
5. `feed_render_config`
6. `feed_membership_events`
7. `feed_admin_audit_trail`
8. `announcements`
9. `announcement_revisions`
10. `announcement_delivery_events`
11. `announcement_user_state`
12. `announcement_membership_events`

13. `feed_questions`
14. `feed_answers`
15. `feed_answer_ratings`
16. `llm_inference_log`
17. `feed_community_posts`
18. `feed_community_replies`

### 4.3 Source-of-Truth and Fan-Out

1. PostgreSQL stores canonical feed, announcement, question, and community metadata.
2. Stream receives projected fan-out payloads after DB commit success.
3. Retries/idempotency ensure at-least-once fan-out without duplicate canonical writes.

---

## 5) Security, Privacy, and Compliance Controls

1. Server-side authorization on all user/admin commands.
2. Role and consent checks enforced by command access policy contracts.
3. CSRF protection for all state-changing web routes.
4. Audit logging for allow/deny and publish/archive transitions.
5. Sensitive payload redaction in logs and diagnostics.
6. LLM inference inputs are sanitized; outputs are logged with model ID and confidence for audit.
7. Content moderation on question/community post submission (rate limiting + policy violation checks).
8. Plugin-scoped deletion + full-account deletion contracts aligned to template in `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.

---

## 6) Web and Android Delivery Status

`web+android complete`. All three feed channels (announcements, questions, community) are shipped on web (`/apps/feed`) and Android (`packages/mobile/src/features/feed`). Stream credentials, feed item rendering, read/dismiss state, and Q&A interactions behave consistently across platforms.

---

## 7) Quota-Impact and Operational Budget Notes

1. Any change increasing Stream fan-out volume requires a quota-impact note.
2. Quota notes follow `ctf/docs/quota-impact/TEMPLATE.md`.
3. PR checklist evidence includes expected monthly impact and degradation plan.
4. LLM inference costs are tracked separately and budget-gated.

---

## 8) Seed Coverage Status

`ctf/scripts/seedFeedAnnouncementsPhase0.mjs` seeds deterministic feed items, announcements, questions, community posts, replies, and membership/read/dismiss states for dev validation.

---

## 9) Schema Drift and Predeployment Expectations

1. Predeployment requires schema drift checks between migration SQL, ORM/schema definitions, and API contracts.
2. Any drift acceptance is explicit and documented with mitigation.
3. PR evidence includes migration replay/rollback proof and drift-check output.

---

## 10) Gaps and Known Technical Debt

1. LLM inference for question answers runs against a single configured provider; provider failover and confidence-thresholding policy are not yet contractualized.
2. Separate `ANNOUNCEMENTS_PLUGIN_*_CONTRACTS.yaml` files are deprecated; their continued presence is intentional historical reference and is a known cleanup item.

---

## 11) Change Log

- 2026-05-18: Replaced "Web and Android Delivery Plan" with canonical "Web and Android Delivery Status" (`web+android complete`); removed web-first/Android-parity-pending framing. Removed stale Gaps entries that listed Questions/Community/Android as pending — these surfaces are shipped (`/api/feed/questions/*`, `/api/feed/community/*`, mobile FeedStream). Renamed "Gaps, Ambiguities, and Known Technical Debt (Current)" to canonical "Gaps and Known Technical Debt". Updated seed coverage to reference shipping script.
- 2026-02-25: Added Rule 120 gaps section.
- 2026-02-24: Created initial CTF rewrite Feed inventory.
- 2026-04-05: Major revision — unified to `feed.*` namespace; added three-channel architecture (announcements, questions/LLM Q&A, community support); added 18 commands; added Q&A/community data entities; added LLM extension contracts; added feed canonical metrics; marked Android parity as required; deprecated separate announcements contracts.
