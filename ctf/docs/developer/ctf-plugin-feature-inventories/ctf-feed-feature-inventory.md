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
2. Expiry windows influence visibility (the Commons is a single time-ordered stream — no manual priority ranking).
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
3. Content moderation and rate limiting on post creation. Members are capped at 1,200 characters and 3 links per post (anti-spam in the publicly-readable Commons); admins get a higher cap (4,000 characters, 20 links) so the owner's detailed welcome/help posts are not blocked. The raw-HTML (`<>`) block applies to everyone.
4. The Commons (Survivor Hub home chat) now opens a live Stream connection to this channel's `ctf-feed-community` Stream channel for real-time updates and typing indicators. `POST /api/hub/join` mints the credentials via `getFeedStreamCredentials(userId, displayName, 'community')` — the same channel and Stream identity (`feed-<userId>`) the Questions/Community Stream surfaces use. The post data itself stays in `feed_community_posts` (our database); Stream is the real-time signal only. See the Commons live-layer entry in `ctf-survivor-hub-chat-feature-inventory.md` and the quota note `ctf/docs/quota-impact/2026-06-21-commons-live-stream-layer.md`.

### 1.5 Membership-Aware Personalization

1. Membership changes trigger visibility recalculation.
2. Membership event stream is used for fan-out invalidation/update workflows.
3. Non-member and member experiences remain policy-compliant and auditable.

### 1.6 Interaction and Read-State

1. Mark-read / unread tracking per user and item.
2. Dismiss/hide actions for announcements (every announcement is dismissable — there is no mandatory/non-dismissable flag).
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
3. Targeting rules management.
4. Preview/simulation mode before publish.

### 2.3 Governance and Operational Visibility

1. Change history and actor attribution for admin mutations.
2. Quota-impact awareness for Stream fan-out heavy changes.
3. Feature flag controls.
4. LLM inference monitoring: model ID, confidence, source attribution, quality ratings.

---

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface (Authoritative — Unified `feed.*` Namespace)

All command contracts must conform to templates from:

- `.claude/rules/201-plugin-command-schema-template.mdc`
- `.claude/rules/202-plugin-access-policy-schema-template.mdc`
- `.claude/rules/203-plugin-audit-schema-template.mdc`

**Timeline (unified):**

1. `feed.timeline.fetch` (v2.0.0 — supports channel filter)
2. `feed.item.read.mark`
3. `feed.item.dismiss`

**Announcements:** 4. `feed.announcement.draft.create` 5. `feed.announcement.draft.update` 6. `feed.announcement.publish` 7. `feed.announcement.archive` 8. `feed.announcement.read.mark` 9. `feed.announcement.dismiss` 10. `feed.announcement.render-mode.update` 11. `feed.announcement.targeting.validate`

**Questions (LLM-assisted Q&A):** 12. `feed.question.submit` 13. `feed.question.answer.generate` 14. `feed.question.answer.rate`

**Community Support:** 15. `feed.community.post.create` 16. `feed.community.post.reply` 17. `feed.community.post.reaction.toggle` 18. `feed.community.post.delete` (author-only; delete your own post — there is no in-place edit; **editing is delete + repost**: the composer's **Edit** action deletes the post and reloads its text into the composer so the author fixes it and sends a fresh post, reusing this delete command plus `feed.community.post.create`. A corrected message is therefore a new row with its own moderation and no inherited reactions/replies.)

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
- `POST /api/feed/community/posts` — body accepts an optional `replyToPostId` (the id of the peer post this one quotes, Signal-style). Validated server-side to reference an existing post; rejected with 400 when malformed or unknown.
- `POST /api/feed/community/posts/:postId/reply`
- `POST /api/hub/messages/:postId/reactions` — toggle the requesting member's emoji reaction on a Commons community post. Body `{ emoji }`; the emoji must be in the fixed quick set (👍 ❤️ 😂 🎉 🙏 😢 👋), else 400. A second toggle of the same emoji removes it. Hub access gate + `x-ctf-csrf: '1'`. Returns `{ ok, reacted }`. Reactions are stored in our own database (`feed_community_post_reactions`), not Stream.
- `POST /api/feed/stream` — mint Stream chat credentials for the announcements channel (`ctf-feed-announcements`)
- `POST /api/questions/stream` — mint Stream chat credentials for the questions channel (`ctf-feed-questions`); used by the mobile Questions screen

Public (unauthenticated) routes:

- `GET /api/feed/public/community` — read-only Commons for signed-out visitors. Returns `{ isPublic, posts }` where `posts` are community (peer) posts only — no announcements, AI answers, replies, per-user state, or author user ids. Returns `isPublic: false` (empty) unless `feed_render_config.is_public` is on and the community channel is enabled. Backs the signed-out home panel (community posts are public the way Quora posts are; visitors read but cannot post without signing in). Rate-limited per IP (2026-07-16): 30 requests/minute via the shared in-memory limiter `lib/security/rate-limit.ts`; over-limit callers get `429` with a `Retry-After` header.

Admin routes:

- `GET /api/feed/admin/config`
- `PUT /api/feed/admin/config`
- `POST /api/feed/admin/announcements`
- `PUT /api/feed/admin/announcements/:announcementId`
- `POST /api/feed/admin/announcements/:announcementId/publish`
- `POST /api/feed/admin/announcements/:announcementId/archive`
- `GET`/`POST /api/hub/first-visit-notice` — the one standing notice a member is shown on arrival
  rather than on the rotation. `GET` returns `{ show, title, body }`; `POST` records that they have read
  it (idempotent, `(user_id, notice_key)` primary key). Gated at `any_authenticated`, **deliberately**:
  a signed-in but unverified member can already read and post in the Commons, so they are exactly who
  needs telling first. `POST` checks `checkMutationOrigin(request) !== 'allow'` — that helper returns a
  verdict string, and a truthiness test against it would disable the check entirely. Both directions
  fail **closed**: a read error reports `show: false`, because a database hiccup must not be able to pop
  the notice on every visit, which is how a notice trains people to dismiss it unread.
- `GET /api/feed/admin/moderation/flagged-answers` — admin lists answers members have flagged, ordered
  by flag count then newest (`listFlaggedAnswers`), with `pending` = how many flagged answers are still
  visible (`countPendingFlaggedAnswers`, counted in the database so it is never a page-capped
  undercount). Each row carries the parent question, the answer, whether it came from the assistant or
  a member, and its flag / not-helpful counts. Admin-gated, read-only. **This route is what closed the
  gap**: members could rate an answer `flagged` from the day rating shipped, the count was aggregated by
  `GET /api/feed/admin/questions`, and no screen ever called that route — so every flag reached nobody.
- `GET /api/feed/admin/moderation` — also accepts `?author=<userId>` to show one member's entire Commons
  footprint, and returns an `authors` roster (aggregate counts per member, ordered by volume) so a
  moderator can work by person rather than by post. The roster is omitted when `?author=` is set — it
  is what you use to *pick* someone, so it is dead weight once you have.
- `GET /api/feed/admin/moderation` — admin lists member-authored Commons posts and replies for review,
  newest first, together with the count of rows currently hidden (`listCommonsModerationQueue` +
  `countHiddenCommonsRows` in `lib/feed/moderation.ts`). Hidden rows are included by default so a
  moderator can find what they took down and put it back; `?hidden=1` narrows to only those. Optional
  `?limit=` clamped to 1..200. Admin-gated (`requireFeedAdminAccess`), read-only, no audit row.
- `POST /api/feed/admin/moderation/:target/:id` — admin hides or restores one Commons post or reply.
  Body may also carry `reason`, one of `off_topic` / `suspected_bad_actor` / `spam` / `abusive` /
  `other` (`FEED_MODERATION_REASON`). Validated against that fixed set, never free text — a
  moderator's prose about a member would become a permanent unreviewable note on a survivor's
  account. An unrecognised or absent code falls back to `other` rather than 400: a hide is
  time-sensitive and must not fail over its label. Restoring ignores `reason` and **clears** the
  stored reason/actor/timestamp, so a post that is visible again carries no standing accusation.
  `:target` is `post`, `reply`, `question`, or `answer` (else 400); body `{ hidden: boolean }` is **required** — an absent
  field is a 400 rather than defaulting to restore, so a malformed request can never quietly put
  hidden content back in front of members. Admin-gated + `x-ctf-csrf: '1'`; 404 when the row is gone.
  Sets `moderation_status` to `'hidden'` or `'accepted'` under `FOR UPDATE`, so two moderators acting
  at once cannot both record the same transition. Returns `{ changed: false }` and writes **no** audit
  row when the row is already in the requested state. A real transition writes
  `feed.community.moderation.hide` or `feed.community.moderation.restore` with the previous and new
  status in metadata (never the body — the trail is a record *about* the content, not a second copy of
  it). **There is no admin edit route**: a moderator may take content out of view, never rewrite a
  member's words while leaving the member's name on them.
- `PATCH /api/feed/admin/questions/:questionId` — admin re-labels a feed question's category (`relabelQuestionCategory`). Body `{ category }` validated against the allowed feed question categories (else 400); the question id must be a UUID (else 400); admin-gated (`requireFeedAdminAccess`) + `x-ctf-csrf: '1'`; 404 when the question id is unknown. Writes a `feed.question.category.relabel` audit row.
- `POST /api/feed/membership/events` — records a member join/leave membership event for the feed personalization layer (`emitMembershipEvent`, writing `feed_membership_events` and fanning out to Stream when configured). Body `{ userId, pluginId, eventType: 'join' | 'leave', requestId?, traceId? }` (`eventType` defaults to `join`; `userId` and `pluginId` required, else 400); admin-gated (`requireFeedAdminAccess`) + `x-ctf-csrf: '1'`. Returns `{ ok, streamEmitted }`.

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
7. `announcements` — includes `linked_plugin_slug TEXT NULL`: an optional plugin this announcement points at. When set to a visible, non-admin-only plugin slug, publishing composes the feed item body with a trailing `Open <Plugin>: https://app.chargingthefuture.com/apps/<slug>` line so a reader can go straight to the referenced app from wherever the announcement shows (mobile feed, Commons). Validated against the plugin registry on write (unknown/admin-only → stored null). No `feed_items` column is added — the link rides in the composed body, recomposed from the clean announcement body each publish so re-publishing never stacks duplicate lines.
8. `announcement_revisions`
9. `announcement_delivery_events`
10. `announcement_user_state`
11. `announcement_membership_events`

13. `feed_questions`
14. `feed_answers`
15. `feed_answer_ratings`
16. `llm_inference_log`
17. `feed_community_posts` — includes `reply_to_post_id UUID NULL REFERENCES feed_community_posts(id) ON DELETE SET NULL` for Signal-style quoted replies (a peer post quoting another peer post). When the quoted post is deleted, the reference is set to null and no quote renders. Indexed by `idx_feed_community_posts_reply_to`.
18. `feed_community_replies`
19. `feed_hub_last_seen` — per-member "last seen" marker for the Hub home channel (`user_id TEXT PRIMARY KEY`, `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`). Drives the single "New messages" divider in the Commons chat. Read on entry, updated to now after the member has viewed the chat. Best-effort: a read/write failure never breaks the chat.
20. `feed_community_post_reactions` — emoji reactions on Commons community posts, stored in our own database (not Stream). Columns `id UUID PK DEFAULT gen_random_uuid()`, `post_id UUID NOT NULL REFERENCES feed_community_posts(id) ON DELETE CASCADE`, `user_id TEXT NOT NULL`, `emoji TEXT NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. `idx_feed_community_post_reactions_unique (post_id, user_id, emoji)` makes a reaction a toggle (one of each emoji per member per post); `idx_feed_community_post_reactions_post (post_id)` serves the batched aggregate read. The emoji is constrained to the fixed quick set (`FEED_REACTION_EMOJIS`) at the application layer.
21. `feed_commons_guidance_milestones` — one row per Commons post-count milestone at which the
    automatic guidance notice was published. Columns `id UUID PK DEFAULT gen_random_uuid()`,
    `milestone_count INTEGER NOT NULL UNIQUE`, `announcement_id UUID NULL`,
    `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. **The UNIQUE constraint on `milestone_count` is
    the concurrency control, not just a hygiene index**: two members posting at the same moment across
    the boundary both compute the same count and both try to claim it, and `ON CONFLICT DO NOTHING`
    lets exactly one win, so the notice is never published twice for one milestone. `announcement_id`
    is stamped after the notice is created so an admin can find the exact announcement a milestone
    produced. **Holds no member data** — no user ids, no content — so it is retained on account
    deletion and is not in the deletion registry.
22. `feed_commons_notice_seen` — which standing notices a member has already been shown once, on
    arrival. Columns `user_id TEXT`, `notice_key TEXT`, `seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    primary key `(user_id, notice_key)`. Separate from the cadence table because it answers a different
    question: the cadence table asks whether a period has been served *for the room*, this asks whether
    *this member* has seen it. Holds a user id, so it is deleted with the account (deletion registry).

**Reserved (schema-only, no runtime reader/writer yet):**

21. `feed_timeline_projection` — a denormalized timeline read-model table defined in `schema.sql` (`id` UUID PK, `item_type` TEXT, `source_announcement_id` UUID nullable, `title` TEXT, `body` TEXT, `published_at` TIMESTAMPTZ, `expires_at` TIMESTAMPTZ nullable, `created_at`/`updated_at` TIMESTAMPTZ). Named in the feed audit contract's `dataClassesAccessed` (`ctf/docs/contracts/FEED_PLUGIN_AUDIT_CONTRACTS.yaml`). No runtime code reads or writes it — the live timeline read path queries `feed_items` directly (see §4.3). It is a reserved projection for a future denormalized fan-out, not an active table; documented here so the gate and the next agent account for it without mistaking it for live storage.

### 4.3 Source-of-Truth and Fan-Out

1. PostgreSQL stores canonical feed, announcement, question, and community metadata.
2. Stream receives projected fan-out payloads after DB commit success.
3. Retries/idempotency ensure at-least-once fan-out without duplicate canonical writes.
4. The denormalized `feed_timeline_projection` table (§4.2) is the schema slot reserved for a future materialized timeline read model; the current read path does not use it (it reads `feed_items` live).

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

Delivery: **web + mobile-responsive complete**. **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA).

All three feed channels (announcements, questions, community) are shipped on web (desktop + mobile-responsive).

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
3. ~~Questions and answers cannot be moderated.~~ **Closed 2026-07-30** — both tables gained
   `moderation_status`, the read path honours it, and `/admin/commons` can hide either.
4. ~~Member flags route nowhere.~~ **Closed 2026-07-30** — `GET /api/feed/admin/moderation/flagged-answers`
   plus the Flagged answers tab on `/admin/commons`. `GET /api/feed/admin/questions` is still orphaned and
   is recorded in `ctf/scripts/orphan-route-allowlist.json` as a burn-down entry: its `flagged_count` is
   now superseded by the flag queue, so it should be either wired to a page or deleted.

---

## 11) Change Log

- 2026-07-27: **Commons composer shows how far over the character limit you are — and no longer
  destroys an over-limit message (owner report).** A member's long post silently failed: the composer
  had no character counter and no `maxLength`, and `sendMessage` cleared the input *before* the
  request, restoring only the reply target on failure — so a post over the 1,200-character cap was
  rejected by the API and the member's writing was gone, with a generic "must be a valid community
  post" as the only clue. Three fixes: (1) a live counter under the composer, quiet until the last
  150 characters, then showing characters remaining and, past the limit, **the exact number to
  remove** plus a nudge to split the message; (2) the composer text is restored on any failed send
  (only when the member has not started typing something new, so recovery never overwrites live
  work), and the send button is disabled while over the limit; (3) the API's 400 now names the
  overage instead of a generic message. The counter measures the **whitespace-normalized** text the
  server measures, via a new client-safe `lib/feed/normalize.ts` that `lib/feed/repository.ts` now
  imports — one implementation, so the counter cannot drift from the check. It uses the caller's own
  cap (`FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH` 4,000 for admins, `FEED_MAX_COMMUNITY_POST_LENGTH`
  1,200 for members), so `isAdmin` is now threaded to `ShellChatPanel`. @comic questions are exempt
  (different route, different limit). No schema or contract change. Web + mobile-responsive (Commons
  is web-only). Verified: typecheck, lint, build.
- 2026-07-24: **Added 👋 to the Commons reaction quick set.** The fixed reaction set gains a wave, so it is now 👍 ❤️ 😂 🎉 🙏 😢 👋. Appended at the end of `FEED_REACTION_EMOJIS` (`lib/feed/constants.ts`) so existing reactions keep their order/rank; the set is shared by server and client, so the server accepts 👋 and the picker offers it on both community posts and announcements. Enums + descriptions in `FEED_PLUGIN_COMMAND_CONTRACTS.yaml` (`feed.community.post.reaction.toggle` and `feed.announcement.reaction.toggle`) updated to match. No schema change. Web + mobile-responsive (Commons is web-only). Verified: `@ctf/web` typecheck + eslint clean.
- 2026-07-22: **"Edit" action on a member's own Commons chat post (edit = delete + repost).** Members could already delete their own community post, and the product model is deliberately no-in-place-edit (a corrected post is a fresh row with its own moderation, no inherited reactions/replies), but the only way to fix a typo was to delete then retype — so people posted follow-up corrections like "*done" instead. Added an **Edit** button next to Delete on the author's own message in both Commons channels: the home channel (`shell-chat-panel.tsx` + `use-home-chat.ts`) and the gated #contributors channel (`gated-chat-panel.tsx` + `use-gated-chat.ts`). It loads the post's text back into the composer, deletes the original (existing `feed.community.post.delete` / the contributor-access channel delete), clears any active reply, and focuses the box; sending posts a fresh message via the existing create path — a new row with a new timestamp. No schema, route, or contract change — reuses the existing delete + create. Web + mobile-responsive (Commons is web-only; the RN app has no Commons surface). Verified: `@ctf/web` typecheck + eslint clean, EOF clean.
- 2026-07-17: **"Edit" button for draft announcements in the admin surface.** The admin could create, publish, and archive announcements but had no way to edit a draft before publishing — the `feed.announcement.draft.update` command and its `PUT /api/feed/admin/announcements/:id` route already existed but were never exposed in the UI. Added an "Edit" action on each draft row (`feed-announcements-admin-shell.tsx`) that loads the draft (title, body, linked plugin) into the top form; the form switches to "Edit announcement" with a "Save changes" button (PUT) and a "Cancel" that clears edit mode. Create-draft is unchanged (still POST). Edit is offered on drafts only (the update command already rejects non-draft rows server-side). UI-only — no schema, route, or contract change. Verified: typecheck, lint, production build.
- 2026-07-16: **Preserve paragraph/line breaks in posts and announcements.** A multi-paragraph message posted to the Commons rendered as one jumbled wall of text — `normalizeText` (used on every body) collapses *all* whitespace including newlines (`\s+` → single space), so line breaks were destroyed at save time. Added `normalizeMultilineText` (collapses only horizontal whitespace per line, trims each line, caps blank-line runs at one) and used it for community-post bodies (`createFeedCommunityPost`), replies (`replyToFeedCommunityPost`), and announcement bodies (`create`/`updateAnnouncementDraft`), plus the matching length validators so the measured length equals what is stored. Render side: added `white-space: pre-wrap` to the authenticated `.chatBubble` and the signed-out `.publicChatBody` (the announcement card body and mobile RN `<Text>` already keep newlines). Titles and single-line fields still use the collapsing `normalizeText`. No schema change. Note: messages saved *before* this fix were already flattened in storage, so they stay single-paragraph — re-post them (delete + repost) to get the breaks back. Verified: typecheck, lint, production build.
- 2026-07-16: **Higher community-post limits for admins (owner welcome/help posts were blocked).** A detailed welcome post from the owner (1,965 characters, 6 links) was rejected: community posts are capped at 1,200 characters (`validateFeedCommunityPostInput`) and 3 links (`passesFeedModeration`). Both caps are deliberate anti-spam guards for the publicly-readable Commons, but too tight for the owner. Added admin-only higher caps: `FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH = 4000` and `FEED_ADMIN_MAX_COMMUNITY_POST_URLS = 20` (`constants.ts`); `validateFeedCommunityPostInput(input, maxLength)` and `passesFeedModeration(text, urlCap)` now take the applicable cap, and `createFeedCommunityPost(..., isPrivileged)` passes the admin link cap. `POST /api/hub/messages` derives `isPrivileged` from `gate.auth.isAdmin` and applies the admin length cap. Members keep 1,200 chars / 3 links; the `<>` raw-HTML block still applies to everyone. Server-only validation change; no schema or new route. Verified: typecheck, lint, production build.
- 2026-07-16: **Member self-delete of their own community post (`feed.community.post.delete`).** Added `deleteCommunityPost` (`lib/feed/repository.ts`): author-only hard delete that removes the projected `feed_items` row (cascading its targets/read-state/dismissals) and the `feed_community_posts` row (cascading its replies + reactions), all in one transaction. Exposed as `DELETE /api/hub/messages/:postId` (hub gate + CSRF; 403 non-owner, 404 gone). Command contract `feed.community.post.delete`, an author-only access policy, and an audit event added; `FEED_PROFILE_AND_DELETION_CONTRACT.md` documents the self-delete surface. This is the product's answer to "no edit" — a member corrects a post by deleting and reposting, avoiding the bait-and-switch risk of in-place edits. No schema change. The full UI (web + Android delete affordance) is detailed in the Survivor Hub inventory. Verified: typecheck, lint, production build.
- 2026-07-16: **Retired announcement `priority` and `mandatory` (owner decision).** With the Commons as one time-ordered stream where every announcement flows through the same feed, there is no manual ranking and no non-dismissable flag, so both fields are removed end to end. Dropped `priority`/`mandatory` from `feed_items`, `announcements`, `announcement_revisions`, and `feed_timeline_projection` in `schema.sql` + `schema.demo.sql` (guarded `DROP COLUMN IF EXISTS`; the `feed_items` timeline index was rebuilt without `priority`). `listFeedTimeline` now orders purely by `published_at DESC, id DESC`. Removed the fields from `Announcement` / `AnnouncementDraftInput` / `FeedTimelineItem`, the create/update-draft SQL and validation, the admin form (the "Mandatory" checkbox, the "Priority" number input, and the "mandatory" list badge), and the admin/create + update API parsing. `dismissFeedItem` / `dismissAnnouncement` no longer guard on `mandatory` (every item is dismissable), and the dismiss routes drop the 409 "cannot dismiss mandatory" branch. Contract YAMLs drop the `mandatoryDismissGuard` / `target_*_mandatory` / `mandatoryDismissGuardCheck` clauses and reword the dismiss command descriptions. Seeds (`seedFeedAnnouncements.mjs`, `seedDemo.mjs`) no longer write either column. Owner-review lane (schema + contract change). Verified: typecheck (web + mobile + shared), lint, production build.
- 2026-07-14: **Android pull-to-refresh on the feed surfaces.** The React Native `FeedStream.tsx`, `Announcements.tsx`, and `Community.tsx` screens now support pull-to-refresh: dragging the list down re-pulls the current data (feed timeline + @comic cards, announcements, community posts) in the background without flashing the full-screen loading state. Mobile-client only — no backend, schema, route, or contract change.
- 2026-07-14: **Hardened the mobile Questions Stream-chat lifecycle (GitHub #1502–#1506).** In `ctf/packages/mobile/src/features/questions/Questions.tsx` the connect effect now (1) `await`s `chat.connectUser(...)` before rendering the channel, so the `Chat`/`Channel` components never watch a channel before the WebSocket handshake completes (#1503); (2) catches an error from `connectUser` (not just the credentials fetch) and surfaces it via `setError`, and no longer renders a broken, unconnected client (#1505); (3) holds the connected client in a `useRef` so the effect cleanup always disconnects the real client instead of the stale `null` captured at first render — closing the leaked authenticated WebSocket (#1502); and (4) guards `setError`/`setLoading(false)` behind the `isMounted` flag so an unmounted component is never updated, tearing the client down if it unmounted mid-connect (#1506). Separately, `POST /api/questions/stream` (`ctf/packages/web/app/api/questions/stream/route.ts`) now returns the four `stream*` fields explicitly rather than spreading `credentials`, so the response shape the mobile client reads is guaranteed at the boundary and cannot silently become `undefined` if `getFeedStreamCredentials` changes its keys (#1504). No route, contract, or schema change — the field names are unchanged; behavior-only hardening.
- 2026-07-14: **Fixed published announcements (and questions) never appearing in the Commons.** `listFeedTimeline` filtered feed rows with `f.item_type = ANY($enabledChannels)`, but the enabled-channel names are plural (`announcements`, `questions`, `community`) while `feed_items.item_type` is singular (`announcement`, `question`, `community`). Only `community` matched both spellings, so the plural `announcements`/`questions` channels never matched their singular rows and those two item types were silently excluded from the Hub home channel (`GET /api/hub/messages`) and `GET /api/feed/items` — a published announcement showed in the admin list but never in the Commons. Added `FEED_CHANNEL_TO_ITEM_TYPE` (`lib/feed/constants.ts`) mapping each channel name to its item type, plus a `FeedItemType` type (`lib/feed/types.ts`); `listFeedTimeline` now maps the resolved channels through it before the item_type filter. Behavior-only fix — no schema, route, or contract change. Guarded by `lib/feed/channel-item-type.test.ts`.
- 2026-07-11: **Fixed "Unable to publish announcement" caused by a legacy text `announcements.id` column.** After the create-draft fix, publishing a draft still 503'd. The live `announcements.id` column was `character varying`, but `schema.sql` declares it `UUID`; `publishAnnouncement`, `archiveAnnouncement` and `updateAnnouncementDraft` all run `WHERE id = $1::uuid`, which Postgres rejects on a text column with `operator does not exist: character varying = uuid`. (Create-draft was unaffected because it casts values *into* a uuid column rather than comparing.) Added a guarded, idempotent migration to `schema.sql` and `schema.demo.sql` right after the existing `id` repair: when the column is not already `uuid`, `ALTER COLUMN id TYPE uuid USING id::uuid` and re-set the `gen_random_uuid()` default. Every stored id is a uuid string, so the cast is lossless; there are no foreign keys referencing the column, and the full publish path (announcement update + delivery event + `feed_items` upsert + `feed_item_targets`) was verified to succeed after the conversion in a rolled-back transaction against the live database. Applied the same conversion to the live database directly for immediate relief. No route, contract, or application-code change.
- 2026-07-11: **Fixed "Unable to create announcement draft" on databases carrying a legacy `content` column.** The admin "Create draft" action 503'd on the live database with `null value in column "content" of relation "announcements" violates not-null constraint`. The live `announcements` table still had a pre-v3 `content` column (`NOT NULL`, no default) that the v3 app never writes — it authors into `body` — so every insert failed. `schema.sql` has no `content` column and its `ADD COLUMN IF NOT EXISTS` repairs can only add columns, never drop or relax an existing one, so the leftover was never removed. Added a guarded, idempotent migration to `schema.sql` and `schema.demo.sql` (right after the announcements column backfills): copy any old `content` text into `body` where `body` is empty, then `DROP COLUMN content` — wrapped in an `information_schema` existence check so it is a no-op on fresh databases. Applied the same statement to the live database directly for immediate relief (0 existing announcement rows, so no data affected). No route, contract, or application-code change — behavior-only DB drift repair; verified against Postgres 16 by reproducing the exact failure and confirming the insert succeeds after the drop.
- 2026-07-08: **Attach a plugin to an announcement (link-through) + create-draft fixes.** Added `announcements.linked_plugin_slug TEXT NULL` (`schema.sql`, CREATE + `ALTER … ADD COLUMN IF NOT EXISTS`). The admin "New announcement" form (`components/feed-announcements/feed-announcements-admin-shell.tsx`) gained a "Link a plugin (optional)" picker (options from `/api/plugins`), and the announcement list shows the attached plugin. `AnnouncementDraftInput`/`Announcement` carry `linkedPluginSlug`; `lib/feed/repository.ts` validates it against the visible plugin registry (`getPluginBySlug` + `isAdminOnlyPlugin`; unknown/admin-only → null) on create/update, and `syncFeedItemForAnnouncement` composes the published feed item body with a trailing `Open <Plugin>: https://app.chargingthefuture.com/apps/<slug>` line so the link shows on every reader surface (mobile feed, Commons) with no per-surface change — recomposed from the clean body each publish, so no duplicate lines. The `feed.announcement.draft.create` / `draft.update` contract input schemas gained `linkedPluginSlug`. Also fixed two bugs surfaced while wiring this: (1) creating a draft 503'd on databases whose `announcement_revisions` predated its `targeting`/`status`/`priority`/`mandatory`/`schedule_at`/`expires_at` columns — added the missing `ALTER … ADD COLUMN IF NOT EXISTS` backfills; (2) the admin form erased the typed title/message on a failed submit — it now only resets on success. Android render of a styled tappable button (vs the in-body link line) is a follow-up (see the Android parity note).
- 2026-07-03: **Stable per-member handle for community posts in the signed-in view (attribution).** A signed-in member who has not set a username no longer collapses into the shared "Community member" label — they now render under a stable per-user pseudonym `user-<first 8 of user id>` (matching Chyme's `chymeHandle`), so an unnamed member stays recognizable and accountable across their posts. Added `feedAuthorHandle(username, userId)` to `lib/feed/repository.ts` (used for `GET`/`POST /api/hub/messages` community `displayName` and for quoted-post author labels; the quoted-post read now also selects `author_user_id`). The Commons authenticated chat shows a nudge to set a username when the member has none, and renders the member's own posts under the same handle. The public/signed-out community view keeps its anonymized "Community member" label unchanged (privacy). No schema, contract, or route addition — behavior-only change to how the existing `hub/messages` attribution is computed.
- 2026-06-25: **Documented two admin routes and the timeline projection table** (inventory-debt burn-down — documentation catch-up, no code change). Added `PATCH /api/feed/admin/questions/:questionId` (admin category relabel) and `POST /api/feed/membership/events` (join/leave membership event) to §3.2, and `feed_timeline_projection` to §4.2 (item 21) — recorded as a schema-only reserved read model with no runtime reader/writer, with a matching note in §4.3. Each verified against the route handlers, `schema.sql`, and `FEED_PLUGIN_AUDIT_CONTRACTS.yaml`. Removed these three items from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-21: Commons (Survivor Hub home chat) now opens a live Stream connection to this channel's `ctf-feed-community` Stream channel. `POST /api/hub/join` was changed from returning hardcoded stub Stream credentials to minting real ones via `getFeedStreamCredentials(userId, displayName, 'community')` (the shared community channel + `feed-<userId>` Stream identity), or `{ ok: true, configured: false }` when Stream is not configured. This adds a per-Commons-member live chat connection (a real WATCH/connection cost) — captured in `ctf/docs/quota-impact/2026-06-21-commons-live-stream-layer.md`. Falls back to polling when Stream is unconfigured. No feed schema or contract change; the post data layer (`feed_community_posts`) is unchanged. Full detail is in `ctf-survivor-hub-chat-feature-inventory.md` (task 1 of `STREAM_FEATURE_ADOPTION.md`).
- 2026-06-17: Removed the feed kill switch (owner decision — unapproved agentic addition). Dropped `feed_render_config.kill_switch_enabled` (`schema.sql` + `schema.demo.sql` add a guarded `DROP COLUMN IF EXISTS`), the `killSwitchEnabled` field on `FeedConfig`/`FeedConfigInput`, its validation, the `listFeedTimeline` early-return that blanked the timeline when enabled, the `feed.admin.config.update` contract input, and the read-only display row in the feed admin shell. Part of a product-wide kill-switch removal (also Foundation and Workforce). No replacement control.
- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/feed-announcements` page with `components/feed-announcements/feed-announcements-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, read-only feed-config panel, announcement lifecycle). Bound to the real backend — `getFeedConfig` + `listAnnouncements(true)`. Real actions on existing endpoints (with `x-ctf-csrf: '1'`): create a draft (`POST /api/feed/admin/announcements`), publish a draft (`POST /api/feed/admin/announcements/:id/publish`), and archive a published one (`POST /api/feed/admin/announcements/:id/archive`). There is no desktop or mobile mockup for this admin surface, so it follows the established admin design system over real data (rule 131). No new endpoint, schema, or contract.
- 2026-06-12: The Android community-channel client (`packages/mobile/src/features/community/api.ts`, reading the feed routes with `channel=community`) now uses the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing plain fetch calls against hardcoded development URLs; its Stream chat credential fetcher now calls the real `POST /api/feed/stream` route (the `/api/community/stream` path it pointed at never existed) and maps the response field names. No schema, route, or contract change.
- 2026-06-12: Wired the mobile Questions screen to real Stream chat credentials. It called `POST /api/questions/stream`, a route that did not exist, with a relative URL that never resolves in React Native — so the screen always errored. Added the route (reusing the Feed read-access gate and the shared Stream identity) and generalized `lib/feed/stream.ts` so it can mint credentials for any of the Feed's three channels; Questions now connects to a dedicated `ctf-feed-questions` channel. The mobile client maps the canonical `stream*` response fields and (since the authenticated-fetch migration merged the same day) goes through the shared authenticated fetch helper rather than a hardcoded development URL. Note: this is a live group chat for the Questions channel, which is a parity divergence from the web Questions surface (an LLM-assisted Q&A list, not a chat); flagged for a later product reconciliation. No schema change.
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
    - Commands conform to `.claude/rules/201-plugin-command-schema-template.mdc`.
- [x] Lock Feed access policy contracts.
  - Acceptance criteria:
    - Access policy conforms to `.claude/rules/202-plugin-access-policy-schema-template.mdc` with role/consent/region constraints.
- [x] Lock Feed audit contracts.
  - Acceptance criteria:
    - Audit events conform to `.claude/rules/203-plugin-audit-schema-template.mdc` with allow/deny parity.
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
    - Announcement cards render with expiry handling.
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

- 2026-07-30 (later): **Q&A moderation, and member flags now reach somebody.** Closes the gap flagged in
  the previous pass, and the CI hole that let it survive.
  - **`feed_questions` and `feed_answers` had no `moderation_status` at all.** That is why the flag queue
    could not be built: an admin could read a flagged answer and then do nothing about it. Both tables
    now carry `moderation_status` (default `'accepted'`) plus the same nullable
    `moderation_reason` / `moderated_by_user_id` / `moderated_at` trio as the Commons tables, so one
    admin surface drives all four kinds of content. New index
    `idx_feed_answers_moderation_status (moderation_status, created_at DESC)` serves the queue.
  - **Read path honours it**, which is the load-bearing half: the timeline's question and answer
    queries, and `generateFeedQuestionAnswer` (a hidden question cannot be given a new answer, and
    reports `question_not_found` rather than revealing that it exists).
  - **`exportQuestionsByCategory` excludes hidden questions.** Hiding something is a judgement that it
    does not belong; exporting it into training data would launder it straight back in and the model
    would keep answering in the register of the thing that was removed.
  - `FeedModerationTarget` widened to `post | reply | question | answer`, with a
    `MODERATION_TABLES` map and an `isFeedModerationTarget` guard replacing the old two-way ternary, so
    `POST /api/feed/admin/moderation/:target/:id` covers all four with no new endpoint.
  - New `GET /api/feed/admin/moderation/flagged-answers` and a **Flagged answers** tab on
    `/admin/commons`, with the pending count on the tab label. Ordered by flag count, not date: this is
    triage, and the answer six people objected to matters more than the newest one. Hiding an answer
    leaves the question up, so the member who asked still has their question and can get a better
    answer.
  - **Why no gate caught this**: `check-inventory-drift.mjs` asks whether a route is *documented*, not
    whether it is *called*. Documented-but-dead is the worse failure, because the inventory then asserts
    a capability the product does not have. Fixed by `check-orphan-routes.mjs` (`orphan-route-gate`),
    which fails on any API route with no caller. Its first run found 91 — 3 genuinely external, 88
    recorded as a burn-down baseline. It cannot see unread database columns, which is the other half of
    this failure mode and how `moderation_status` sat dead for months.
  - **Parity:** web + mobile-responsive; Android out of scope (web-only per rule 105).
### Change Log

- 2026-07-30 (later): **Three standing Commons notices, three cadences.** The single notice became a
  registry (`COMMONS_NOTICES` in `lib/feed/commons-guidance.ts`), and the milestone table is now keyed
  `(notice_key, milestone_count)` — that composite UNIQUE is still the whole concurrency story.
  - **What the Commons is for** — every 50 posts. Purpose and moderation.
  - **Where things are public, and where the work happens** — every 75 posts, offset from the first so
    the two rarely land together and a member meets one or the other roughly every 25 posts. They share
    a multiple at 150, which is two announcements in a row — rare enough not to be worth more machinery.
  - **Who I interact with is not a vouch** — every 21 days. Time-shaped, not volume-shaped: it is the
    owner's standing "every few weeks" reminder, and tying it to post count would fire it repeatedly in
    a busy week and never in a quiet one. `dueMilestoneFor` turns a day cadence into a period index
    (days since epoch / interval) so one UNIQUE constraint serves both kinds. A time-cadence notice is
    delivered **by the next post**, not by a clock — nothing publishes into a silent room, which is
    intended rather than a compromise.
  - **Two owner claims were corrected against the code before shipping**, because a notice that is
    wrong about privacy is worse than no notice:
    - The **Chyme** claim in the draft was correct and an intermediate edit of mine broke it, then was
      reverted. Chyme's main room *is* publicly listenable: a signed-out visitor does not get the
      authenticated branch in `app/apps/[pluginSlug]/page.tsx`, they get `ChymePublicShell` from the
      public-visitor registry, which fetches `/api/chyme/public/room` and hands a guest Stream
      credentials via `ChymeGuestListen` ("Free to listen · Sign in to speak"). Both spaces have the
      same shape — a public room anyone can read or listen to, plus a private Weavers room. Reading only
      the authenticated branch makes Chyme look gated; check the public-visitor registry before
      concluding that about any plugin.
    - The draft said the owner would only look at AI Assistant messages to check the assistant is safe.
      True, and now precise: `comic_review_queue` joins the asker's turn, so reviewing an answer does
      show the question it answers. The notice says that rather than promising nobody ever reads them.
  - **Naming:** the signal-vs-noise draft used "TI Skills Economy (TSE)". Corrected to **Skills
    Economy** per the owner's earlier decision and `BRAND_VOICE_LEXICON.md`; "TI" as a label is also
    replaced with "Target".
  - The Commons is publicly readable only while `feed_render_config.is_public` is on (default TRUE). If
    that is ever switched off, the public-rooms notice becomes wrong and must be edited.
  - **Parity:** web + mobile-responsive; Android out of scope (web-only per rule 105).
- 2026-07-30: **The Commons states its own purpose every 50 posts (owner decision).** A newcomer now
  meets the rule without anyone having to say it to them personally, and a regular is reminded without
  being singled out. `FEED_COMMONS_GUIDANCE_INTERVAL = 50`; the copy lives in
  `lib/feed/commons-guidance.ts`. On every community post, `maybePostCommonsGuidance` counts the posts
  and, when the total lands exactly on a multiple of 50, claims the milestone and publishes an
  announcement — which renders inline in the Commons stream, so it appears where the behaviour is.
  Attributed to a reserved actor (`FEED_SYSTEM_ACTOR_ID`), never to a member and specifically not to
  the owner, who should not appear to be personally telling people off every 50 posts.
  - **Inside the post's transaction, on purpose.** The count, the milestone claim, and the notice all
    commit with the post that triggered them. Running it after commit would let a rolled-back post
    leave a claimed milestone behind, silently suppressing that notice forever. It still swallows its
    own errors — a failed reminder must never cost a member their post.
  - Published immediately rather than as a draft: nobody is going to hand-publish this every 50 posts,
    and a draft that never ships is the same as no notice.
  - Counts hidden posts too. The milestone means "the Commons has seen this much traffic"; moderating
    after the fact should not shift where the next notice falls.
  - **Every paragraph of the copy is load-bearing and was corrected by the owner (2026-07-30).** The
    first draft was wrong about what the Commons *is* and had to be rewritten:
    - **It is a support channel, not a marketplace.** Ask in the open, get an answer. It is **not**
      where exchanges are arranged or recorded — skills, trades, housing, rides and calls each live in
      their own plugin, and those are what count toward the economy. The first draft said trades get
      "sorted out" here, which would have taught members to do business in a public thread instead of
      in the app that records it.
    - **Why it is open**: the design reason is that the owner takes no direct messages — her inbox was
      used to harass her. The final copy states only the benefit (answered once where the next person
      finds it, never waiting on the owner alone) and does not explain that history; the owner cut the
      line on 2026-07-30. Keep it cut — the rule stands on the benefit, and the notice does not owe a
      whole community an account of what was done to her.
    - **It must not frighten off real survivors.** This is the constraint that shapes the tone. "No
      storytelling" read alone tells a newly targeted person their experience is unwelcome, which is
      the opposite of true, and would cost the app exactly the members it exists for. So the notice says
      outright that you can describe what is happening to you, and draws the line at the retelling that
      asks for nothing. The Quora contrast is the selling point, not a complaint: there you narrate into
      a void; here you ask and someone answers. The Commons is a first filter, nothing heavier.
    - **The public rule is TOPIC, not character**: content is removed for repeatedly going nowhere,
      never for who somebody is suspected of being. An accusation posted to a whole community cannot be
      retracted, and being wrong about it lands on a survivor. The internal `suspected_bad_actor`
      moderation reason stays admin-only and is never shown to a member — the same split, held on both
      sides.
    - **The exclusion is stated as fact, not feeling**: traffickers are "not allowed", not "not
      tolerated". The owner was explicit that these people kill with impunity and no wording should
      imply they are merely unwelcome. Volume of off-topic chatter is not the problem being solved, and
      a perpetrator's feelings are not a consideration.
    - **Tone is a pitch, not a telling-off** (owner, second pass). The message was right and the delivery
      read as annoyed. It now opens on the Quora contrast — there you write into a void, here you ask and
      someone answers — and the rules follow as consequences of that promise. Same content, same firmness
      on the exclusion; firmness toward traffickers is not the same thing as a scolding tone toward
      everyone else, and a newcomer should finish it wanting to join.
    - **The Weaver perk is the private room, not the Commons.** An earlier draft said Weavers "post
      without restriction", which was false — the topic rule applies to the Commons for everyone. What a
      Weaver earns is the private Weavers room, where none of it applies. Promising members something the
      app does not do is worse than any tone problem, so this wording must not be restored.
  - **Weavers of the Commons post without restriction**, and the notice says so. That is the incentive
    doing the work the rule cannot: the way out of the topic limit is to contribute, not to argue.
  - New table `feed_commons_guidance_milestones` (see §4.2 item 21). **Parity:** web +
    mobile-responsive; Android out of scope (web-only per rule 105).
- 2026-07-29 (later): **Moderation reason + moderating by member (owner: the real problem is volume of
  off-topic Quora discussion, and most of it is a handful of accounts).** Hide/restore alone did not fit
  a repeatable sweep. Added `moderation_reason`, `moderated_by_user_id`, `moderated_at` (all `TEXT`/
  `TIMESTAMPTZ`, **nullable**, null on every pre-existing row) to `feed_community_posts` and
  `feed_community_replies` via `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` in `schema.sql` and
  `schema.demo.sql`. The reason is a short code from `FEED_MODERATION_REASON`, defaulting to
  `off_topic` in the UI because that is the actual day-to-day judgement — one picker for the whole
  list, so a sweep of twenty posts is not twenty identical clicks. It rides on the Hidden pill, so a
  later pass tells an off-topic sweep apart from an abuse removal without opening the audit log.
  `suspected_bad_actor` is worded as *suspected* and carries **no** automatic consequence: it hides the
  post and nothing else — no access revocation, no account flag, no score. A hunch recorded as a fact
  is how a wrong hunch becomes permanent. New `listCommonsAuthors` powers a **By member** tab: aggregate
  counts per author ordered by volume, so an account that has never been on topic looks different from
  a member who wandered off once. Aggregate only — no bodies — because deciding whether to look at
  someone should not require reading everything they wrote. `?author=` then shows that member's whole
  footprint. **No bulk hide**: acting on many posts at once is one click away from clearing a member's
  entire history on a wrong hunch, so each row is still its own decision. **Parity:** web +
  mobile-responsive; Android out of scope (web-only per rule 105).
- 2026-07-29: **Commons moderation — the first one that exists (owner request).** Until now there was
  no moderation surface for member-authored Commons content at all: no admin UI listed posts or
  replies, no route could hide or remove anyone else's, and `DELETE /api/hub/messages/:postId` was
  author-only (an admin hitting it on another member's post got a 403). Removing a post meant direct
  SQL. Worse, `moderation_status` on `feed_community_posts` / `feed_community_replies` looked like the
  mechanism but was **dead**: no query read it and the only value ever written was `'accepted'`, so
  setting a row to anything else left it fully visible.
  - **The read path now honours it.** `listFeedTimeline` (posts, replies, and the quoted-post lookup)
    and `listPublicCommunityPosts` all filter `moderation_status = 'accepted'`. This is the blocking
    change — without it a hide control would be a button that does nothing.
  - `FEED_MODERATION_STATUS` in `lib/feed/constants.ts` defines exactly two states, `accepted` and
    `hidden`. Two on purpose: a third "under review but still visible" state would be a promise the
    code does not keep.
  - New `lib/feed/moderation.ts` — `setCommunityModerationStatus` (locks the row `FOR UPDATE`, returns
    `unchanged` instead of pretending to act), `listCommonsModerationQueue`, `countHiddenCommonsRows`.
  - New routes `GET /api/feed/admin/moderation` and `POST /api/feed/admin/moderation/:target/:id`.
  - New admin surface `/admin/commons` (`components/feed-announcements/commons-moderation-admin-shell.tsx`),
    listed on the admin landing page as **Commons Moderation**. Recent / Hidden-only tabs, hidden
    counters, and a Hide / Put back control per row. Restoring is confirm-gated and hiding is not:
    hiding is reversible, while putting content back in front of members is the direction worth a
    deliberate pause.
  - **Hide, never delete, and never edit.** Deletion is unrecoverable and takes the member's words plus
    the reply thread with them, so a moderator acting fast on a judgement call is not making a
    permanent one. There is no admin edit anywhere in this plugin, and the access-policy contract
    records that as `contentImmutable: required`. Member self-deletion is unchanged.
  - Contracts: `feed.community.moderation.list` / `.hide` / `.restore` added to the command and
    access-policy contracts; `.hide` / `.restore` added to the audit contract with `previousStatus` /
    `newStatus` in `targetContext`.
  - **Not covered:** questions and answers. `feed_questions` and `feed_answers` have no
    `moderation_status` column, so hiding one would need a schema change; and the member-submitted
    `flagged` answer ratings still route nowhere. Recorded in Gaps rather than half-built.
  - **Parity:** web + mobile-responsive; Android out of scope (web-only per rule 105).

- 2026-07-19: **Tap a quoted reply to jump to the original message** (owner report: tapping the "you are replying to" block did nothing). `HubMessage.quotedMessage` / `ChatQuotedMessage` gained `postId` (the quoted community post id), carried from the already-resolved `FeedCommunityDetail.replyToPostId` in `GET /api/hub/messages` and echoed on `POST` for the optimistic copy. In `shell-chat-panel` each peer bubble group now carries `data-post-id={communityPostId}` and the quote block is a button that scrolls the original into view and briefly highlights it (`chatBubbleFlash`); when the quoted post is older than the loaded window the tap is a no-op (the snippet still shows what was said). The same was applied to the gated contributor channel (`gated-chat-panel`, `channel-repository` quoted message gained `postId` from `reply_to_post_id`). No schema, route-surface, or contract change — only a new field on an existing payload plus client rendering. Android carries the optional `postId` on its `HubQuotedMessage` type but the tap-to-jump (needs FlatList `scrollToIndex`) is a tracked parity follow-up.
- 2026-06-21: Emoji reactions on Commons (Survivor Hub home channel) community posts — the first feature of the Stream-adoption initiative, using "approach b" (reactions live in our own database; Stream is not involved). New table `feed_community_post_reactions (id UUID PK, post_id UUID NOT NULL REFERENCES feed_community_posts(id) ON DELETE CASCADE, user_id TEXT NOT NULL, emoji TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())` using the CREATE TABLE IF NOT EXISTS + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` pattern, with `idx_feed_community_post_reactions_unique (post_id, user_id, emoji)` (toggling adds/removes) and `idx_feed_community_post_reactions_post (post_id)`. A fixed quick set `FEED_REACTION_EMOJIS = ['👍','❤️','😂','🎉','🙏','😢']` is exported from `lib/feed/constants` and shared by server and client; the server rejects any emoji outside it (400). `toggleCommunityPostReaction(userId, postId, emoji)` validates the emoji and that the post exists, then `INSERT ... ON CONFLICT DO NOTHING` and removes the existing row when nothing was inserted (toggle). `listFeedTimeline` aggregates reactions for the visible community posts in one batched query (`COUNT(*)` + `BOOL_OR(user_id = $currentUser)`), attaching `FeedCommunityDetail.reactions: FeedReactionSummary[]` (new type — `{ emoji, count, reactedByMe }`), ordered by the fixed-set order, only emojis with at least one reaction; posts with none get `[]`. New route `POST /api/hub/messages/:postId/reactions` (hub access gate + `x-ctf-csrf: '1'`) returns `{ ok, reacted }`. `HubMessage.reactions` carries the aggregate; the Commons chat (`ChatMessage.reactions`, `use-home-chat` `toggleReaction`) optimistically flips the chip and reconciles via the existing 10s poll; `shell-chat-panel` renders a compact reaction row (emoji+count pills, highlighted when reacted, plus an "add reaction" picker over the fixed set) under peer bubbles that have a `communityPostId`. `schema.demo.sql` regenerated; drift gate passes. Android parity deferred.
- 2026-06-21: Commons chat (Survivor Hub home channel) gained two member features. (1) Signal-style quoted reply: added `feed_community_posts.reply_to_post_id UUID NULL REFERENCES feed_community_posts(id) ON DELETE SET NULL` (CREATE column + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`, plus `idx_feed_community_posts_reply_to`). `createFeedCommunityPost` accepts an optional `replyToPostId`, validates it is a well-formed UUID that references an existing post (else `reply_target_invalid` / `reply_target_not_found` → 400), and stores it. `listFeedTimeline` resolves each quoted post's author handle and a ~120-char body snippet server-side into `FeedCommunityDetail.quotedPost` / `replyToPostId` (new `FeedQuotedPost` type), so the chat renders the quote without a second fetch. `GET /api/hub/messages` carries this as `HubMessage.quotedMessage` and now also returns `communityPostId` (the reply target id, distinct from the feed item id). `POST /api/hub/messages` and `POST /api/feed/community/posts` accept `replyToPostId`. (2) Unread divider: new table `feed_hub_last_seen (user_id TEXT PRIMARY KEY, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW())` with `GET`/`POST /api/hub/last-seen` (member endpoint; CSRF on the POST, marker clamped to server NOW() and never moved backwards) backed by `getHubLastSeen` / `updateHubLastSeen`. The Commons chat reads the marker on entry, draws a single "New messages" divider before the first entry newer than it, and marks seen once after viewing — all best-effort so a failure never breaks the chat. `schema.demo.sql` regenerated; drift gate passes. Android parity deferred (Parity Ticket).
- 2026-06-12: The Android feed API clients (`packages/mobile/src/features/feed/api.ts` and `fetchFeedStreamCredentials.ts`) now use the shared authenticated fetch helper — every call carries the signed-in member's Clerk bearer token and the server address comes from runtime config (APP_URL) — replacing plain dev-only fetch against hardcoded development URLs; the read-receipt call now reports failures instead of swallowing them. Removed the unused `feedDemoData.ts` mock re-export.
- 2026-06-09: Deleted the retired Feed user-facing app surface (superseding the earlier same-day `is_visible = FALSE` hide — dead code is removed, not hidden). Removed the whole signed-in app shell under `components/feed/` (`feed-announcements-shell.tsx` and its icon rail, sidebar, header, right panel, compose forms, item card, and live view — all reachable only from the `/apps` route), the `feed-announcements` branch and import in `app/apps/[pluginSlug]/page.tsx`, the `feed-announcements` row from the `ctf_plugin_registry` seed and the code fallback array, and the `feed` / `announcements` aliases. Added an idempotent `DELETE FROM ctf_plugin_registry WHERE plugin_slug = 'feed-announcements'` to `schema.sql` and `schema.demo.sql` so the existing production row is removed on deploy. `/apps/feed-announcements` now 404s. Verified `evaluatePluginAccess` takes only role/approval options (no registry lookup), so the admin page at `/admin/feed-announcements` and the `/api/feed/*` routes are unaffected; `lib/feed/*`, the Stream channel id, the account-deletion entry, and the Hub plugin styling are kept as the live data layer.
- 2026-06-09: Corrected the `ctf_plugin_registry` seed in `schema.sql` (and `schema.demo.sql`) to set `feed-announcements` `is_visible = FALSE`, matching the 2026-05-31 consolidation decision above. The seed had still set it `TRUE`, so the live registry row stayed visible even though the code fallback array was `isVisible: false`; because `getPluginBySlug` reads `is_visible` from the database, a signed-out visitor reaching `/apps/feed-announcements` fell through to the generic public preview card instead of a 404. With the row hidden the app route 404s; Feed remains the Hub's data layer and keeps its admin lifecycle at `/admin/feed-announcements`. No table or column change.
- 2026-06-02: Added `feed_community_posts.author_username` (nullable), captured from the poster's session when a community post is created (`createFeedCommunityPost` takes an `actorUsername`), and surfaced on the timeline as `FeedCommunityDetail.authorUsername`. Lets the Survivor Hub lead a peer post with the author's `@username` for signed-in members. Additive and forward-only — existing posts have a null username.
- 2026-02-24: Created initial Feed rewrite checklist with approved web-first policy, central admin page decision, naming normalization/alias guidance, Postgres+Stream architecture controls, stream quota-impact gate, and schema drift predeployment evidence requirements.
- 2026-03-02: Completed phase-0 implementation for combined feed+announcements stream, including migration, API routes, policy/audit guards, admin surface, seed fixtures, and quota-impact note.
- 2026-04-05: Added Phase 4 (Questions + LLM), Phase 5 (Community Support), Phase 6 (Android Parity — required). Renumbered security/compliance to Phase 7. All commands now use unified `feed.*` namespace per FEED_PLUGIN_COMMAND_CONTRACTS.yaml.
- 2026-04-05: Implemented the unified three-channel web runtime for Feed, including questions, LLM-assisted answers with audit logging, community support posts/replies, and mobile parity shell directories for `feed`, `announcements`, `questions`, and `community`.
- 2026-05-31: Android pixel pass delivered. Feed (`FeedStream.tsx`), Announcements (`Announcements.tsx`), and Community (`Community.tsx`) rewritten from mockups (`MobileFeed.tsx`/states, `FeedAnnouncements.tsx` adapted), binding real `GET /api/feed/items?channel=` API. New `api.ts` modules added for each feature (feed, announcements, community). Read-state mutation via `POST /api/feed/items/:id/read` with `x-ctf-csrf: 1`. Mock files retired (no longer imported). Parity check passes. TSC: only pre-existing expo/tsconfig.base error.
