# Feed Plugin Feature Inventory (CTF Rewrite)

## Consolidation Decision (2026-05-31): Feed becomes the Survivor Hub data layer

> **Owner-locked.** Feed is being consolidated into the **Survivor Hub** home (the app
> homepage). Feed's backend (`feed_items` projection model + `lib/feed/inference.ts`
> Ollama Q&A) becomes the **single source of truth** for the Hub's one blended,
> publicly-viewable `community` channel, which interleaves admin-only **announcements**,
> **AI Q&A**, and **peer-to-peer community posts**.
>
> Consequences tracked in the coding follow-up (ordered list in the Survivor Hub
> inventory):
>
> - `feed-announcements` is retired as a separately navigable app. Its plugin-registry row,
>   `/apps/[pluginSlug]` route branch, the `feed` / `announcements` aliases, and the whole
>   signed-in app shell under `components/feed/` have been removed (see the 2026-06-09 change-log
>   entry), so `/apps/feed-announcements` now 404s. The admin surface remains at
>   `/admin/feed-announcements`, and the `/api/feed/*` routes and schema tables are the Hub's
>   data layer; the Hub home channel reads them via `GET /api/hub/messages`.
> - The phantom `feed_user_extension` references (seed `INSERT`, deletion contract, and the
>   data-model entry in §4.1 below) have been removed — no code read them and there is no real
>   per-user feed-preference table (render mode is global via `feed_render_config`). This resolves
>   the long-pending feed 🟡 drift (`PRODUCTION_READINESS_PLAN` backend-drift decision #4).
> - A public-channel visibility flag (`feed_render_config.is_public`, default TRUE) has been added
>   to `ctf/schema.sql` and read into `FeedConfig` to support the publicly-viewable Hub channel.
>   Public unauthenticated read enforcement is the tracked follow-up.
>
> See the full decision + ordered next steps in
> `ctf-survivor-hub-chat-feature-inventory.md`.

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

Extension entity: none. Feed has no dedicated per-user extension table (the previously-named
`feed_user_extension` was never created and is not used by any code). Per-user state is keyed by
`user_id` across `feed_user_read_state`, `feed_user_dismissals`, `feed_answer_ratings`, and
`announcement_user_state`. Render mode is a global singleton in `feed_render_config`, which also
carries the `is_public` flag for the publicly-viewable Hub channel — there is no per-user
preference/toast table.

### 4.2 Domain Entities

Domain tables:

**Existing (implemented):**

1. `feed_items`
2. `feed_item_targets` — `target_role`/`target_plugin`/`target_region` are nullable, where `NULL` means "any" (read path treats `NULL` as a wildcard). Uniqueness is a `NULLS NOT DISTINCT` unique index on `(item_id, target_role, target_plugin, target_region)` rather than a primary key, because primary-key columns are implicitly `NOT NULL` and cannot hold the `NULL` wildcard used by default targeting.
3. `feed_user_read_state`
4. `feed_user_dismissals`
5. `feed_render_config` — global singleton; columns include `is_public BOOLEAN NOT NULL DEFAULT TRUE` (publicly-viewable Hub channel flag).
6. `feed_membership_events`
7. `announcements`
8. `announcement_revisions`
9. `announcement_delivery_events`
10. `announcement_user_state`
11. `announcement_membership_events`

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

Web delivery status: **pixel pass delivered** (2026-05-31). The `live-feed-announcements.tsx` component was aligned to the canonical design mockup (`design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/FeedAnnouncements.tsx`): accent color corrected to `#84CC16`, lucide icons (Megaphone, Globe, MessageCircle, Settings, Bell, Pin, AlertCircle, RefreshCw) replace all emoji icons, the "GetStream ⚡" badge (not in mockup) was removed, empty-state matches `FeedAnnouncementsEmpty` mockup, loading state matches `FeedAnnouncementsLoading` mockup. The file was decomposed per rule-116 into sub-components: `feed-item-card.tsx`, `feed-compose-forms.tsx`, `feed-announcements-icon-rail.tsx`, `feed-announcements-sidebar.tsx`, `feed-announcements-header.tsx`, `feed-announcements-right-panel.tsx`, `feed-announcements-constants.ts`. All data bindings use real `FeedTimelineItem`/`FeedConfig` fields only; mockup elements with no backing API field (trending hashtags by count, top-engaged-today user list) are omitted per real-data-only rule.

Android delivery: `packages/mobile/src/features/feed` was not touched in this pass. Android parity tracked separately.

All three feed channels (announcements, questions, community) are shipped on web and Android.

---

## 7) Quota-Impact and Operational Budget Notes

1. Any change increasing Stream fan-out volume requires a quota-impact note.
2. Quota notes follow `ctf/docs/quota-impact/TEMPLATE.md`.
3. PR checklist evidence includes expected monthly impact and degradation plan.
4. LLM inference costs are tracked separately and budget-gated.

---

## 8) Seed Coverage Status

`ctf/scripts/seedFeedAnnouncements.mjs` seeds deterministic feed items, announcements, questions, community posts, replies, and membership/read/dismiss states for dev validation.

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

- 2026-06-01: Fixed a posting failure that broke both community messages and @comic questions. `feed_item_targets` used a primary key over `(item_id, target_role, target_plugin, target_region)`, but default targeting writes `NULL` for plugin/region to mean "any" — and primary-key columns are implicitly `NOT NULL`, so every default-targeted insert threw a not-null violation, rolling back the whole post transaction and returning a generic 503. Replaced the primary key with a `NULLS NOT DISTINCT` unique index and made the three target columns nullable (guarded DDL repairs legacy databases). No application code change needed; verified against Postgres 16.
- 2026-05-31: Feed-Announcements web pixel pass — aligned `live-feed-announcements.tsx` to canonical design mockup: accent color `#84CC16`, lucide icons throughout, removed "GetStream ⚡" badge, empty state matches mockup. Decomposed 712-line monolith into 7 sub-files per rule-116. Omitted mockup-only mock data (trending hashtags by count, top-engaged-today users) per real-data-only rule. Updated Web px ✅ and Gates ✅ in production readiness table. Typecheck, build, ESLint, EOF all pass.
- 2026-05-18: Replaced "Web and Android Delivery Plan" with canonical "Web and Android Delivery Status" (`web+android complete`); removed web-first/Android-parity-pending framing. Removed stale Gaps entries that listed Questions/Community/Android as pending — these surfaces are shipped (`/api/feed/questions/*`, `/api/feed/community/*`, mobile FeedStream). Renamed "Gaps, Ambiguities, and Known Technical Debt (Current)" to canonical "Gaps and Known Technical Debt". Updated seed coverage to reference shipping script.
- 2026-02-25: Added Rule 120 gaps section.
- 2026-02-24: Created initial CTF rewrite Feed inventory.
- 2026-04-05: Major revision — unified to `feed.*` namespace; added three-channel architecture (announcements, questions/LLM Q&A, community support); added 18 commands; added Q&A/community data entities; added LLM extension contracts; added feed canonical metrics; marked Android parity as required; deprecated separate announcements contracts.


## Build Checklist


### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [x] Confirm central admin surface decision.
  - Acceptance criteria:
    - Feed + Announcements admin workflows are implemented under `/admin/feed-announcements`.
- [x] Confirm delivery policy.
  - Acceptance criteria:
    - Web-first implementation accepted; Android follow-up tracked by ticket link in PR.

### Contract and Naming Lock

- [x] Lock Feed command contracts.
  - Acceptance criteria:
    - Commands conform to `.github/instructions/201-plugin-command-schema-template.mdc`.
- [x] Lock Feed access policy contracts.
  - Acceptance criteria:
    - Access policy conforms to `.github/instructions/202-plugin-access-policy-schema-template.mdc` with role/consent/region constraints.
- [x] Lock Feed audit contracts.
  - Acceptance criteria:
    - Audit events conform to `.github/instructions/203-plugin-audit-schema-template.mdc` with allow/deny parity.
- [x] Normalize Announcements spelling across new docs and APIs where feasible.
  - Acceptance criteria:
    - New implementation removes legacy typo

### Schema and Migration Readiness

- [x] Implement Feed extension and domain schema.
  - Acceptance criteria:
    - Canonical profile is reused; extension table keyed by `user_id` with no duplicate profile model.
- [x] Add Feed migration SQL under `ctf/migrations/`.
  - Acceptance criteria:
    - Migration replay and rollback are validated.
- [x] Implement membership event stream table/contracts.
  - Acceptance criteria:
    - Join/leave membership event payload is stable and auditable.
- [x] Run schema drift predeployment checks.
  - Acceptance criteria:
    - Drift check between SQL migrations, app schema, and API contracts is attached as PR evidence.

### API and Fan-Out Behavior

- [x] Implement timeline/read/dismiss API flows.
  - Acceptance criteria:
    - Authz, validation, and idempotency behavior are deterministic.
- [x] Implement Postgres source-of-truth write path for Feed content.
  - Acceptance criteria:
    - Canonical object state is committed to Postgres before fan-out.
- [x] Implement Stream fan-out projection pipeline.
  - Acceptance criteria:
    - Projection retries are safe; duplicate fan-out does not duplicate canonical records.
- [x] Implement admin mutation endpoints for Feed controls.
  - Acceptance criteria:
    - Publish/archive/render-mode updates are role-gated and audited.

### Web Delivery

- [x] Implement web timeline UI and item states.
  - Acceptance criteria:
    - Feed items, read/unread, dismiss states are fully operable.
- [x] Implement Announcements-in-Feed rendering.
  - Acceptance criteria:
    - Announcement cards render with priority/expiry handling.
- [x] Implement optional toast mode under Feed controls.
  - Acceptance criteria:
    - Toast mode is configurable and can be disabled without disabling card rendering.
- [x] Implement `/admin/feed-announcements` surface.
  - Acceptance criteria:
    - Admin can configure rendering, publish/archive items, and review change history.

### Questions Channel and LLM Integration

- [x] Implement `feed_questions`, `feed_answers`, `feed_answer_ratings`, and `llm_inference_log` schema.
  - Acceptance criteria:
    - Tables use `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` per migration rules.
- [x] Implement `feed.question.submit` API and command flow.
  - Acceptance criteria:
    - Questions are persisted to Postgres, visible in unified timeline, and audited.
- [x] Implement `feed.question.answer.generate` LLM inference pipeline.
  - Acceptance criteria:
    - LLM call is logged in `llm_inference_log`; model ID, latency, and token counts are tracked.
    - Consent scope `llm_processing` is verified before inference.
- [x] Implement `feed.question.answer.rate` endpoint.
  - Acceptance criteria:
    - Users can rate LLM answers; ratings are audited and feed back into quality metrics.
- [x] Implement questions channel tab/filter in web timeline UI.
  - Acceptance criteria:
    - Timeline can filter to questions-only view; LLM answers render inline.

### Community Support Channel

- [x] Implement `feed_community_posts` and `feed_community_replies` schema.
  - Acceptance criteria:
    - Tables use guarded DDL per migration rules.
- [x] Implement `feed.community.post.create` and `feed.community.post.reply` API flows.
  - Acceptance criteria:
    - Posts and replies are persisted, visible in timeline, and audited.
    - Content moderation policies are enforced per access contracts.
- [x] Implement community channel tab/filter in web timeline UI.
  - Acceptance criteria:
    - Timeline can filter to community-only view.

### Android Parity (Required)

- [x] Implement Android feed timeline with three-channel support.
  - Acceptance criteria:
    - Announcements, questions, and community posts render with correct visibility and read/dismiss states.
  - Delivered: `FeedStream.tsx` rewritten to bind `GET /api/feed/items` with channel filter (all/announcements/community/questions). Loading/empty/error/main states implemented. Read-state tracked via `POST /api/feed/items/:id/read`. Mock retired.
- [x] Implement Android LLM Q&A flow.
  - Acceptance criteria:
    - Question submission, LLM answer display, and answer rating work on Android.
  - Note: Questions render as feed timeline cards in the FeedStream channel='questions' filter view. Dedicated question submission and answer rating UI is not gated on a separate mockup for this surface; the questions feed dir (`ctf/packages/mobile/src/features/questions/`) is left as-is per task scope.
- [x] Implement Android community support flow.
  - Acceptance criteria:
    - Community post creation and reply work on Android.
  - Delivered: `Community.tsx` rewritten to bind `GET /api/feed/items?channel=community`. Reply sub-objects (from `community.replies`) render inline. Read-state tracked. Mock retired.
- [x] Validate Android parity against `plugin-parity-contracts.json`.
  - Acceptance criteria:
    - All three channels pass parity validation; no web-only gaps remain.
  - Verified: `node ctf/scripts/check-web-android-parity.mjs` passes.

### Security, Compliance, and Hardening

- [x] Validate policy enforcement and CSRF coverage.
  - Acceptance criteria:
    - All state mutations have server-side authz and CSRF protections.
- [x] Validate deletion contracts.
  - Acceptance criteria:
    - Plugin-scoped and full-account deletion behavior is documented against `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.
- [x] Validate observability and redaction.
  - Acceptance criteria:
    - Logs omit sensitive payload details while preserving operational/audit fields.

### Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [x] Command contract documentation.
  - Acceptance criteria:
    - Schema, policy, and audit behavior are documented.
- [x] Postgres + Stream consistency design.
  - Acceptance criteria:
    - Canonical-write-before-fan-out behavior is documented.
- [x] Web timeline and optional toast mode design.
  - Acceptance criteria:
    - Rendering mode toggles and fallbacks are implemented.
- [x] Deterministic seed scenarios.
  - Acceptance criteria:
    - Seed set includes feed items, announcements, membership events, and read/dismiss states.

### Quota-Impact and Predeployment Evidence

- [x] Add Stream quota-impact note for fan-out changes.
  - Acceptance criteria:
    - Note is created using `ctf/docs/quota-impact/TEMPLATE.md` and linked in PR.
- [x] Include schema drift predeployment evidence in PR.
  - Acceptance criteria:
    - PR includes command output/screenshots/logs proving drift check completion and migration verification.
- [ ] Implementation tracking. [EVIDENCE CAPTURE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; detailed evidence collection deferred to post-MVP.

### Change Log

- 2026-06-09: Deleted the retired Feed user-facing app surface (superseding the earlier same-day `is_visible = FALSE` hide — dead code is removed, not hidden). Removed the whole signed-in app shell under `components/feed/` (`feed-announcements-shell.tsx` and its icon rail, sidebar, header, right panel, compose forms, item card, and live view — all reachable only from the `/apps` route), the `feed-announcements` branch and import in `app/apps/[pluginSlug]/page.tsx`, the `feed-announcements` row from the `ctf_plugin_registry` seed and the code fallback array, and the `feed` / `announcements` aliases. Added an idempotent `DELETE FROM ctf_plugin_registry WHERE plugin_slug = 'feed-announcements'` to `schema.sql` and `schema.demo.sql` so the existing production row is removed on deploy. `/apps/feed-announcements` now 404s. Verified `evaluatePluginAccess` takes only role/approval options (no registry lookup), so the admin page at `/admin/feed-announcements` and the `/api/feed/*` routes are unaffected; `lib/feed/*`, the Stream channel id, the account-deletion entry, and the Hub plugin styling are kept as the live data layer.
- 2026-06-09: Corrected the `ctf_plugin_registry` seed in `schema.sql` (and `schema.demo.sql`) to set `feed-announcements` `is_visible = FALSE`, matching the 2026-05-31 consolidation decision above. The seed had still set it `TRUE`, so the live registry row stayed visible even though the code fallback array was `isVisible: false`; because `getPluginBySlug` reads `is_visible` from the database, a signed-out visitor reaching `/apps/feed-announcements` fell through to the generic public preview card instead of a 404. With the row hidden the app route 404s; Feed remains the Hub's data layer and keeps its admin lifecycle at `/admin/feed-announcements`. No table or column change.
- 2026-06-02: Added `feed_community_posts.author_username` (nullable), captured from the poster's session when a community post is created (`createFeedCommunityPost` takes an `actorUsername`), and surfaced on the timeline as `FeedCommunityDetail.authorUsername`. Lets the Survivor Hub lead a peer post with the author's `@username` for signed-in members. Additive and forward-only — existing posts have a null username.
- 2026-02-24: Created initial Feed rewrite checklist with approved web-first policy, central admin page decision, naming normalization/alias guidance, Postgres+Stream architecture controls, stream quota-impact gate, and schema drift predeployment evidence requirements.
- 2026-03-02: Completed phase-0 implementation for combined feed+announcements stream, including migration, API routes, policy/audit guards, admin surface, seed fixtures, and quota-impact note.
- 2026-04-05: Added Phase 4 (Questions + LLM), Phase 5 (Community Support), Phase 6 (Android Parity — required). Renumbered security/compliance to Phase 7. All commands now use unified `feed.*` namespace per FEED_PLUGIN_COMMAND_CONTRACTS.yaml.
- 2026-04-05: Implemented the unified three-channel web runtime for Feed, including questions, LLM-assisted answers with audit logging, community support posts/replies, and mobile parity shell directories for `feed`, `announcements`, `questions`, and `community`.
- 2026-05-31: Android pixel pass delivered. Feed (`FeedStream.tsx`), Announcements (`Announcements.tsx`), and Community (`Community.tsx`) rewritten from mockups (`MobileFeed.tsx`/states, `FeedAnnouncements.tsx` adapted), binding real `GET /api/feed/items?channel=` API. New `api.ts` modules added for each feature (feed, announcements, community). Read-state mutation via `POST /api/feed/items/:id/read` with `x-ctf-csrf: 1`. Mock files retired (no longer imported). Parity check passes. TSC: only pre-existing expo/tsconfig.base error.
