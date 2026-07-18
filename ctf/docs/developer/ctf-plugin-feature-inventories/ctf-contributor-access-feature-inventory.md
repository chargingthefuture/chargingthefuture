# Contributor Access Module Feature Inventory (CTF)

## Scope & Boundary

- Module name: `Contributor Access`
- Module slug / service key: `contributor-access`
- All three slices of the trusted-channel / contributor-badge system described in
  `ctf/docs/developer/TRUSTED_CHANNELS_AND_CONTRIBUTOR_BADGE_PROPOSAL.md`: the eligibility engine
  (slice 1), the Directory contributor badge (slice 2), and the single gated channel (slice 3).
  The badge's member-facing name is **"Weavers of the Commons"** (owner-picked, 2026-07-18 —
  replacing the earlier working name "Keeper of the Commons", which may still appear in older doc
  comments).
- Hard boundary: this module **never touches the Trust plugin** — no reads or writes of any
  `trust_*` table, no imports from `ctf/packages/web/lib/trust/`. It reads other plugins' value
  tables to make an access decision and owns its own storage.
- Stream/GetStream usage mirrors the Commons exactly: the app database is the message source of
  truth, Stream is the live layer only, and all credentials come from the shared resolver
  (`lib/integrations/stream-credentials.ts` — demo mode selects the `*_STAGING` app). The gated
  channel uses its own Stream channel type (`ctf-gated`, uploads OFF), created once by
  `ctf/scripts/setupGatedChannelType.mjs`.

## Intent

Compute one categorical decision per member — **eligible** or **not-yet** — from real material
value delivered to real people, and grant exactly two things with it: membership of the single
gated `#contributors` channel and the "Weavers of the Commons" badge on the member's claimed
Directory profile. The score behind the decision is internal only and is never surfaced to
anyone as a number: standing is categorical, with no points, tiers, leaderboard, or ranking on any
surface. Eligibility is additive (the recompute only ever admits) and permanent once earned;
removal is for-cause only via an admin action.

## Target User Features

The member surfaces are the **single gated `#contributors` channel inside the Commons shell** —
"Commons for trusted members", one channel, admin-owned (no topic rooms, no user-created rooms,
no DMs) — and the **"Weavers of the Commons" badge** on Directory.

1. **"Weavers of the Commons" badge on Directory profiles** (web + mobile-responsive). The braid
   emblem (`components/contributor-access/weavers-badge.tsx` — a static copy of the owner-picked
   small braid badge from the owner's emblem repo `chargingthefuture/emblem`) renders next to the
   member's name on the Directory profile detail when the profile is **claimed** and the claimed
   member currently holds the badge (`eligible = TRUE` and `revoked_for_cause = FALSE`).
   Positive-only: nothing at all renders for members without it (no empty slot, no lock, no
   "not yet earned" state), and a community-generated (unclaimed) profile never carries the field.
2. **Click-through dialog** (`components/contributor-access/weavers-badge-control.tsx`): title
   "Weavers of the Commons", honest body copy ("This member is a consistent, broad contributor to
   the community — real help, delivered over time. Anyone can earn this.") and a "How it's earned"
   link. The copy never claims verification or vetting.
3. **"How it's earned" page** at `/apps/directory/weavers-of-the-commons`
   (`components/contributor-access/weavers-earned-page.tsx`; signed-in only — everyone else is
   redirected to `/apps/directory`, same gate as the Directory profile deep link). Plain-language
   explainer: earned by steadily delivering real help to other members across the platform;
   permanent once earned; no application and no way to buy it; no score shown anywhere; the same
   standing opens the members-only channel in the Commons when it launches. Mobile-responsive,
   rendered in the Directory shell tokens.

4. **Eligible members see the gated channel alongside the Commons.** The Hub channel list
   (`GET /api/hub/channels`) adds `#contributors` server-side only when `channel_open` is TRUE and
   the caller's eligibility flag is set (admins/moderators also see it — read access, disclosed).
   Desktop: the existing channel rail. Phone widths: a channel-pill switch row appears in the chat
   section once the member has more than one channel.
5. **No-teaser rule (no shaming).** A non-eligible member sees *nothing*: no locked entry, no
   absence state, no different layout — the channel list simply never contains the channel, and
   the channel API routes answer a bare 404 with no trace that the channel exists. Discovery of
   the perk belongs to the badge slice, never to a locked door.
6. **Channel features (v1, per the proposal):** Signal-style threaded replies (the same quoted
   reply mechanism as the Commons), a richer fixed reaction set (twelve emojis vs the Commons'
   six), and longer messages (4000 characters vs 1200). **No image or file upload** — no
   affordance in the UI, no storage column, and uploads disabled on the Stream channel type.
7. **Moderator disclosure, always visible:** the channel header carries "Moderators can read this
   channel." (also repeated in the composer footnote), so the space can never read as an
   unwatched back-room.
8. **Live layer:** same architecture as the Commons — polling is the source of truth,
   `/api/contributor-access/channel/join` mints Stream credentials for instant refresh + typing
   indicators when Stream is configured, and the channel keeps working when it is not.


## Target Admin Features

1. Eligible-members list (user id, username, first-earned date, revoke flag) with for-cause
   revoke (non-empty reason required, confirm before it lands) and reinstate.
2. Config editor for the owner-tunable eligibility rules: score threshold, minimum account age,
   minimum distinct plugins, minimum distinct counterparties, the eligible-member minimum required
   before the gated channel opens, and per-event weights over the fixed value-event key list. The
   channel-open toggle is live, launch-gated: it stays locked (with an explanatory note) until the
   eligible count reaches the minimum, and the server enforces the same precondition again with a
   409 (`contributor_access_channel_below_minimum`). Flipping it on creates the gated Stream
   channel and runs the first membership sync; closing an open channel is always allowed.
3. Channel status card: eligible count vs `min_eligible_to_open_channel`, an OPEN/CLOSED badge,
   and the synced Stream member count (best-effort; "unavailable" when Stream is not configured).
4. Admin page `/admin/contributor-access` (server-side admin gate; non-admins redirect to
   `/apps`), rendering `components/contributor-access/contributor-access-admin-shell.tsx` with
   loading/empty/error/populated states and the mobile-responsive `MobileScreenHeader` layout.

## API Surface and Route Map

Admin routes (admin-only via `requireContributorAccessAdmin`; every allow **and** deny writes a
`contributor_access_audit_trail` row; mutations additionally require the `x-ctf-csrf: '1'` header):

- `GET /api/contributor-access/admin/config` — the single config row (defaults when never
  written) plus `channelMemberCount` (best-effort synced Stream member count; null when Stream is
  unconfigured or the channel is closed); audits `contributor-access.config.get`.
- `PUT /api/contributor-access/admin/config` — update weights/threshold/minimums/channel_open
  (weight keys are validated against the fixed value-event key list). Launch gate: turning
  `channelOpen` on is refused with 409 `contributor_access_channel_below_minimum` (deny audited)
  while the eligible count is under `minEligibleToOpenChannel`; a successful open creates the
  gated Stream channel and runs the first membership sync (guarded — a Stream failure returns a
  `channelSyncWarning`, never a rollback). Audits `contributor-access.config.update`.
- `GET /api/contributor-access/admin/eligible` — members who earned eligibility (user id, username
  via the `users` table, `first_earned_at`, revoke flag/reason) plus the current eligible count.
  **Never any score.** Audits `contributor-access.eligible.list`.
- `POST /api/contributor-access/admin/revoke` — body `{ userId, reason }`; for-cause only, reason
  must be non-empty; sets `revoked_for_cause` and turns `eligible` off; when the channel is open a
  guarded membership sync removes the member from the Stream channel right away
  (`channelSyncWarning` on failure, never a failed revoke); audits
  `contributor-access.member.revoke`.
- `POST /api/contributor-access/admin/reinstate` — body `{ userId }`; clears the revocation and
  restores `eligible` (it was previously earned — `first_earned_at` is permanent); same guarded
  membership sync re-adds the member; audits `contributor-access.member.reinstate`.

Member channel routes (gate: approved member + `channel_open` + the eligibility flag, or the
admin role; every deny is a bare 404 with no channel trace — the no-shaming rule; mutations
require the `x-ctf-csrf: '1'` header; deliberately not audit-trailed, same posture as the Commons
hub routes):

- `GET /api/contributor-access/channel/messages` — last 50 messages, oldest-first, with
  quoted-reply references and the viewer's reaction state. Contract:
  `contributor-access.channel.messages.list`.
- `POST /api/contributor-access/channel/messages` — body `{ text, replyToPostId? }`; text only,
  max 4000 characters; `replyToPostId` makes it a Signal-style threaded reply. Contract:
  `contributor-access.channel.message.create`.
- `POST /api/contributor-access/channel/messages/[postId]/reactions` — body `{ emoji }`; toggles
  the viewer's reaction; emoji validated against the fixed twelve-emoji gated set. Contract:
  `contributor-access.channel.reaction.toggle`.
- `POST /api/contributor-access/channel/join` — mints Stream live-layer credentials (channel type
  `ctf-gated`, channel `ctf-contributors`) via the shared resolver; `configured: false` when
  Stream is absent and the client stays on polling. Contract: `contributor-access.channel.join`.

Cross-plugin read: `GET /api/hub/channels` (the Hub) reads `contributor_access_config` +
`contributor_access_eligibility` to append the `#contributors` entry server-side for eligible
members and admins only.

Internal (service-to-service, never member/browser callable):

- `POST /api/internal/contributor-access/recompute` — runs `computeEligibility()`; guarded by
  `Authorization: Bearer INTERNAL_SERVICE_SECRET` (501 when unset, 401 on a bad token); returns
  `{ ok, evaluated, eligible }` counts only, plus `channelSyncWarning` when the guarded
  post-recompute membership sync fails (a Stream failure never fails the recompute). Called
  weekly (Mondays 06:30 UTC) by `.github/workflows/contributor-access-recompute.yml`. Contract:
  `contributor-access.eligibility.recompute`.
- `syncGatedChannelMembership()` (`lib/contributor-access/gated-channel.ts`, no route of its own)
  — the ONLY membership path: adds every eligible member to the Stream channel, removes every
  for-cause-revoked member; invoked (guarded, only while open) from the recompute, revoke,
  reinstate, and the config open flip. Contract: `contributor-access.channel.membership.sync`.

Member-facing badge read (no new route in this module): the Directory read routes
(`GET /api/directory/list`, `GET /api/directory/profiles/:id`) call
`getWeaversBadgeHolders(userIds)` in `lib/contributor-access/badge.ts` — one
table-existence-guarded query over `contributor_access_eligibility` returning only the subset of
the given user ids with `eligible = TRUE AND revoked_for_cause = FALSE` (empty set on any error).
The routes set a `hasWeaversBadge` boolean on **claimed** profiles only; no score or any other
contributor-access data ever leaves this module. Recorded in the Directory command contracts
(`directory.list.fetch`, `directory.profile.get` `dataAccess`).

## Data Model and Storage Contracts

Owned tables in `ctf/schema.sql` (all guarded `CREATE TABLE IF NOT EXISTS` + per-column
`ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`; `schema.demo.sql` regenerated):

- `contributor_access_config` — single row (`id` INT fixed to 1 by CHECK): `weights` JSONB
  (per value-event-key overrides of the engine defaults; missing key falls back), `threshold`
  NUMERIC (default 100), `min_account_age_days` INT (default 90), `min_distinct_plugins` INT
  (default 3), `min_counterparties` INT (default 5), `min_eligible_to_open_channel` INT
  (default 10), `channel_open` BOOLEAN (default FALSE — forward-looking, nothing grants access from
  it yet), `updated_at`.
- `contributor_access_eligibility` — one row per evaluated member: `user_id` TEXT PK, `eligible`
  BOOLEAN, `first_earned_at` TIMESTAMPTZ NULL (set once, never cleared), `reason_snapshot` JSONB
  (internal evidence: score, per-event counts, gates — **never exposed to members**),
  `computed_at`, `revoked_for_cause` BOOLEAN, `revoked_reason` TEXT NULL, `revoked_at` NULL,
  `revoked_by` NULL. Index on `(eligible, first_earned_at)`.
- `contributor_access_audit_trail` — same shape as `weekly_performance_audit_trail`: `id`,
  `actor_id`, `command`, `policy_status`, `reason`, `target_type`, `target_id`, `metadata` JSONB,
  `created_at`.
- `contributor_access_channel_posts` — gated-channel messages (the DB is the source of truth,
  mirroring the Commons; Stream is the live layer only): `id` UUID PK, `author_user_id` TEXT,
  `author_username` TEXT NULL (captured at post time), `body` TEXT (max 4000 enforced in code),
  `reply_to_post_id` UUID NULL (Signal-style threaded reply), `created_at`. Index on
  `(created_at DESC)`. Text only — no image/file column, by proposal guardrail.
- `contributor_access_channel_post_reactions` — `(post_id, user_id, emoji)` PK plus `created_at`;
  emoji validated in code against the fixed gated set.

Account deletion: registered in `lib/account/deletion-registry.ts` (entry `contributor-access`) —
channel posts, reactions, and the eligibility row are deleted with the account (deletion resets
the earned barrier, per the proposal), the audit trail is retained.

Stream (external, not a table): channel type `ctf-gated` (threads on, reactions on, uploads OFF,
max message length 4000 — one-time setup via `ctf/scripts/setupGatedChannelType.mjs` per Stream
app, production and staging), channel `ctf-contributors`, member ids `feed-<userId>` (the same
Stream identity the Commons uses).

Upstream reads (engine only, `ctf/packages/web/lib/contributor-access/`): the same tables and
fixed filters as `lib/weekly-performance/live-metrics.ts`, all-time and grouped per the member who
delivered the value — `foundation_call_sessions` (callee), `socket_relay_fulfillments`
(fulfiller), `trust_transport_trips` (provider), `lighthouse_matches` (host),
`service_credits_transfers` (sender; chyme tips and direct sends separately by `origin_plugin`),
`contributions_submissions` (USD sum per contributor), `skills_hunt_submissions` (submitter),
`what_works_products` (suggested_by) / `what_works_endorsements` (user), `level_up_enrollments`
(learner) / `level_up_disbursements` (trainer), `recurring_activities` (both sides of an active
confirmed tie), `peer_programming_messages` (author, once per distinct week), `beacon_events` +
`feed_community_post_reactions` + `feed_community_replies` (distinct broadcasts engaged), and
`login_events` (first login = account-age anchor). Every query is table-existence-guarded and
never throws; a missing table contributes nothing.

Counterparty diversity reads the two-sided events' real counterparty columns:
`service_credits_transfers` (`sender_user_id`/`recipient_user_id`), `trust_transport_trips`
(`requester_user_id`/`provider_user_id`), `socket_relay_fulfillments`
(`requester_user_id`/`fulfiller_user_id`), `lighthouse_matches` (`seeker_user_id`/`host_user_id`),
`recurring_activities` (`owner_user_id`/`counterparty_user_id`). Foundation call sessions are
deliberately excluded from the diversity read to minimize access to the sensitive table (their
counts still feed the score internally).

## Security, Privacy, and Compliance Controls

- **Categorical flag only — no score is ever surfaced**, to members or admins. The internal score
  and per-event counts live only in `reason_snapshot`, which no API returns (the admin eligible
  list carries id/username/date/flags only). Proposal hard guardrail.
- **Badge surfaces are positive-only and claimed-only**: the Directory shows the badge only on a
  claimed profile whose member holds it; nothing renders for anyone else, and unclaimed
  (community-generated) profiles never carry the field. The member-facing read is one boolean per
  user id (`getWeaversBadgeHolders`) — no score, no dates, no reasons. The click-through and
  explainer copy never says "verified", "vetted", or "trusted by the platform".
- **Foundation per-member counts are internal-only** (rule 132 — sensitive wellbeing/payment
  participation): computed as gating fuel, never exposed on any surface.
- **Never touches the Trust plugin** — no `trust_*` table reads/writes, no `lib/trust/` imports.
- Admin-only access (`requiredRoles [admin]`; the `operations` role is not admitted); server-side
  gate on the page (redirect to `/apps`) and on every route; CSRF header + origin check on all
  mutations; every allow/deny audited to `contributor_access_audit_trail`.
- Recompute is internal-secret gated (`INTERNAL_SERVICE_SECRET` bearer), additive only, and
  responds with counts only.
- Revocation is for-cause only (a reviewed harm/abuse action) with a required reason — never for
  inactivity, never on an unreviewed report alone.
- **Channel membership comes ONLY from the eligibility flag** — synced server-side to the Stream
  channel; there is no invite, no self-join for the non-eligible, and no other add path. A
  for-cause revoke removes the member from the channel on the spot (guarded sync).
- **Moderator read access is disclosed in-channel** — "Moderators can read this channel." renders
  in the channel header and the composer footnote. Admins retain read access without the
  eligibility flag; that is the moderation design, not a bypass.
- **No images, anywhere in the channel** — no UI affordance, no storage column, uploads disabled
  on the Stream channel type (`ctf-gated`). Text only.
- **No-shaming denies:** every member channel route answers a bare 404 to the non-eligible (and
  while the channel is closed) — no locked teaser, no absence state, no channel trace in the Hub
  channel list.
- **Launch gate enforced server-side:** `channel_open` cannot turn on below
  `min_eligible_to_open_channel` (409 with a stable code; the deny is audited) — the client
  toggle state is never trusted.
- Stream secrets are reused exactly as the Hub/Feed uses them (`resolveStreamCredentials` — demo
  mode selects `STREAM_API_KEY_STAGING`/`STREAM_API_SECRET_STAGING`); no key was added, renamed,
  or restructured.
- Contracts: `ctf/docs/contracts/CONTRIBUTOR_ACCESS_PLUGIN_COMMAND_CONTRACTS.yaml`,
  `CONTRIBUTOR_ACCESS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`,
  `CONTRIBUTOR_ACCESS_PLUGIN_AUDIT_CONTRACTS.yaml`. Deletion handling lives in the account
  deletion registry (see the data model section); a standalone profile-and-deletion contract
  document is still to be authored.

## Web and Android Delivery Status

- **Web (desktop):** complete — admin (`/admin/contributor-access`), the member gated channel
  inside the Commons shell (channel rail entry, gated panel), the Directory profile badge +
  dialog, and the `/apps/directory/weavers-of-the-commons` explainer page.
- **Web (mobile-responsive):** complete — the admin shell keeps its `MobileScreenHeader` layout;
  the gated channel is reachable at phone widths via the channel-pill switch row (the desktop
  channel rail is hidden there) and the panel reuses the Commons' responsive chat layout; the
  badge, dialog, and explainer page are responsive in the Directory shell.
- **Android (React Native):** **tracked gaps — deliberately not built in these slices.** (1) The
  gated channel: the mobile app has no gated-channel feature directory yet; parity should follow
  the same server-filtered channel list (`/api/hub/channels`) and the same member routes, so no
  client-side eligibility logic is ever needed (issue #1681). (2) The badge: the RN Directory
  profile does not yet render the badge/dialog or the explainer screen — the boolean is already
  on the shared Directory responses, so the work is display-only (issue #1680). PRs for these
  slices carry a `Parity Ticket:` line instead of claiming android complete.

## Seed Coverage Status

No seed script. The engine reads upstream tables that the existing plugin seeds populate
(`seed:demo`); the owned tables — including the channel post/reaction tables — start empty and
fill on the first recompute / config save / member post.

## Gaps & Known Technical Debt

- **One-time manual Stream step (owner):** the `ctf-gated` channel type must exist in each Stream
  app before the channel can be created. Run `ctf/scripts/setupGatedChannelType.mjs` once against
  the production credentials and once against the staging/demo credentials (usage at the top of
  the script). Until it runs, opening the channel stores the config flip and returns a
  `channelSyncWarning`; membership reconciles on the next sync after the type exists.
- Android parity gaps: see the delivery-status section (issues #1680 badge, #1681 channel).
- Gated-channel posts have no content-moderation or rate-limit pass yet (the Commons runs both on
  its feed path). Blast radius is small — members are flag-gated contributors and moderators read
  the channel — but the same guards should follow.
- No message delete/edit in the gated channel yet (the Commons supports author delete); needs a
  small follow-up.
- Default weights need owner tuning: the shipped `DEFAULT_WEIGHTS` are a reasoned starting point
  (rare/large actions weigh more), but the proposal defers the real calibration and threshold to
  the owner; the bar is meant to be deliberately high.
- Clean-standing gate is partial: revoked-for-cause is enforced, but active blocks/safety reports
  are not yet read as an admission gate (needs an owner decision on which signals count).
- No per-member admin drill-down (deliberate for now — it would tempt exposing the internal
  evidence; revisit only with strong cause).
- A standalone `CONTRIBUTOR_ACCESS_PROFILE_AND_DELETION_CONTRACT.md` document is still to be
  authored; the deletion behavior itself is already wired via the account deletion registry.

## Change Log

- 2026-07-18 — Badge slice (slice 2): the contributor badge is member-visible on the Directory.
  Owner decisions: name **"Weavers of the Commons"**; artwork is ONLY the small braid-ring badge
  (rust `#8b3a2f` circle, cream/gold three-strand braid), copied as a static SVG from the owner's
  emblem repo (`chargingthefuture/emblem`) into
  `components/contributor-access/weavers-badge.tsx` — the generative math was not ported and no
  other emblem concept is used. New guarded read `lib/contributor-access/badge.ts`
  (`getWeaversBadgeHolders`: eligible AND not revoked-for-cause, empty set on any error), wired
  into `GET /api/directory/list` and `GET /api/directory/profiles/:id`, which set `hasWeaversBadge`
  on **claimed** profiles only. The Directory profile detail renders the badge next to the name
  (positive-only — nothing renders for members without it) with a click-through dialog
  (`weavers-badge-control.tsx`) and a "How it's earned" link to the new signed-in page
  `/apps/directory/weavers-of-the-commons` (`weavers-earned-page.tsx`). Directory command
  contracts (`directory.list.fetch`, `directory.profile.get`) record the
  `contributor_access_eligibility` read; no new API route, schema change, or contributor-access
  contract command. Web + mobile-responsive; Android badge display is a tracked parity gap.
- 2026-07-18 — First slice: schema (config / eligibility / audit tables), the eligibility engine
  (fifteen per-member all-time value-event counts mirroring Weekly Performance, weighted score,
  age/plugin-spread/counterparty gates, additive-only recompute), internal recompute route + weekly
  workflow, admin routes (config get/update, eligible list, revoke, reinstate), the admin page and
  shell, contracts, and this inventory.
- 2026-07-18 — Gated channel slice: the single `#contributors` channel. Schema (channel posts +
  reactions tables), `lib/contributor-access/gated-channel.ts` (+`gated-channel-shared.ts`,
  `channel-repository.ts`), member routes (messages list/create, reaction toggle, Stream join),
  server-filtered Hub channel-list entry (eligible members and admins only — the no-teaser rule),
  membership sync wired into recompute/revoke/reinstate/config-open (guarded, warning-not-failure),
  the launch-gated `channel_open` toggle (409 below the minimum) with the admin status card
  (open/closed + synced member count), the Commons-shell gated panel (moderator disclosure header,
  threads via quoted replies, twelve-emoji reactions, 4000-char messages, no upload affordance) with
  a phone-width channel switcher, the one-time `setupGatedChannelType.mjs` Stream script (uploads
  off at the channel-type level), the account-deletion registry entry, and contract/test-script
  updates.

## Build Checklist

Ordered, dependency-based task list for this module (each item names what blocks it):

1. Schema tables in `ctf/schema.sql` + demo schema regeneration — no dependencies. **Done.**
2. Eligibility engine (`lib/contributor-access/`) — blocked by 1. **Done.**
3. Internal recompute route + scheduled workflow — blocked by 2. **Done.**
4. Admin routes (config, eligible, revoke, reinstate) with audit coverage — blocked by 1. **Done.**
5. Admin page + shell (`/admin/contributor-access`) — blocked by 4. **Done.**
6. Contracts + inventory + manual test script — blocked by 3, 4, 5. **Done.**
7. Owner pass on weights/threshold/minimums via the config editor — blocked by 5; owner decision.
8. Badge slice (Directory badge, click-through copy, "how it's earned" page) — owner decided the
   name ("Weavers of the Commons") and the braid emblem, 2026-07-18. **Done (web +
   mobile-responsive).** Android badge display remains a tracked parity gap (display-only; the
   shared Directory API already carries the boolean).
9. Channel slice (gated Stream channel type, membership sync from the flag, moderator read-in
   disclosure, launch gate on `min_eligible_to_open_channel`) — blocked by 7; independent of 8.
   **Done** (web + mobile-responsive; the one-time channel-type script is the owner's manual
   step, and Android parity is tracked in Gaps).
10. Clean-standing admission gate (blocks/safety reports) — blocked by an owner decision on which
    signals count; can land any time after 2.
