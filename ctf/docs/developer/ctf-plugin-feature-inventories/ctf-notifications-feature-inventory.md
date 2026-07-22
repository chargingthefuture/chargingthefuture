# Notifications Center Feature Inventory

## Scope and Boundary

- Name: `Notifications`
- Slug: `notifications`
- A cross-cutting, member-facing notifications center: one feed of notify-worthy events produced by
  other plugins, plus per-member device-push opt-ins.
- Owned surfaces: `/api/notifications/*` routes; the `notifications` and `notification_preferences`
  tables; the 🔔 tab in the Commons chip row (`components/community-shell/notifications-panel.tsx`).
- Not owned: identity (Clerk); the events themselves (each producing plugin decides what is
  notify-worthy and calls `createNotification`); device-push transport (a later delivery step).

## Intent and Outcome

Nine plugins have everyday and emergency use (Foundation, LevelUp, LightHouse, Commons,
PeerProgramming, Recurring Activity, ServiceCredits, SocketRelay, TrustTransport). A hard "no
notifications" line meant a member could miss a reply, an accepted ride, an incoming call, or credits
received. The trauma-informed answer (owner decision, 2026-07-20):

1. Split the **always-on in-app feed** from the **device ping**. The feed is safe by construction (a
   member only sees it after signing in), so it is never gated. The ping is the only sensitive part.
2. **Device push is opt-out by default**, opted in per coarse category, from the 🔔 tab itself (not
   buried in account settings), so the opt-in sits with the feed it governs.
3. **Discreet push by default**: the ping text is generic (no plugin name or content) so a glance at
   a shared or monitored lock screen reveals nothing.
4. **Need-driven, not engagement-driven**: only events a member would act on. No "someone viewed your
   profile", no come-back nudges. Calm unread markers, never a red count.

## 1) User-Facing Features

1. A notifications feed in the Commons, opened by the 🔔 chip (third in the row after `@` and 📣). It
   replaces the message stream while open; the composer hides (you read notifications, you don't post
   into them).
2. Each row: a calm unread dot (never a red count), a short neutral statement of what happened, a
   relative time, and — when there is somewhere to go — an "Open" pill that deep-links to the exact
   thing (same pill pattern as linked announcements). A Commons reply or @mention opens the Commons and
   scrolls to that message, flashing it briefly (`/?post=<id>`); an announcement reply opens that
   announcement (`/?announcement=<id>`); a plugin event opens that plugin's surface. Opening or
   hovering a row marks it read.
3. "Mark all read".
4. "Manage what pings your device": three plain opt-in switches — Safety/rides/calls,
   Your activity and credits, Community — plus a "keep device pings discreet" switch. All push
   switches default off; discreet defaults on. Everything shows in the feed regardless of these.

## 2) Admin Features

None. Notifications are member self-service; there are no admin governance actions on this surface.

## 3) API Surface and Route Map

- `GET /api/notifications` — the member's own feed (newest first) + unread count. `?limit` optional
  (capped at 50). Always available to a signed-in member.
- `POST /api/notifications/:notificationId/read` — mark one own notification read (idempotent; 404
  when no owned row matches). Hub-style CSRF (`x-ctf-csrf: '1'`).
- `POST /api/notifications/read-all` — mark all unread read. CSRF-guarded.
- `GET /api/notifications/preferences` — the member's device-push opt-ins.
- `PUT /api/notifications/preferences` — update opt-ins (missing field keeps its value). CSRF-guarded.
- `GET /api/notifications/push/vapid-public-key` — the public VAPID key the browser needs to create a
  Web Push subscription (not secret; empty string when push is unconfigured).
- `POST /api/notifications/push/subscribe` — save this device's Web Push subscription. CSRF-guarded.
- `POST /api/notifications/push/unsubscribe` — remove this device's subscription. CSRF-guarded.

Producers do not use HTTP — each plugin calls `createNotification` in
`lib/notifications/repository.ts` at its own emit point.

## 4) Data Model and Storage Contracts

- `notifications` — `id` (uuid pk), `user_id` (recipient), `source_plugin`, `notification_type`,
  `category` (`safety` | `activity` | `community`), `summary` (short neutral text), `link_path`
  (in-app deep link or null), `target_ref` (opaque id for dedupe/resolve or null), `read_at`
  (null = unread), `created_at`. Indexes: `(user_id, created_at DESC)`; partial on unread; partial
  unique `(user_id, notification_type, target_ref)` where `target_ref` is not null (dedupe guard).
- `notification_preferences` — `user_id` (pk), `push_safety` / `push_activity` / `push_community`
  (default FALSE), `discreet_push` (default TRUE), `updated_at`.

A row stores only a reference + a short label, never sensitive detail.

## 5) Security, Privacy, and Compliance Controls

- Every command is scoped to the requesting member's own rows, derived from the authenticated session
  (never a client-supplied user id). Mutations require the `x-ctf-csrf: '1'` header.
- In-app feed is never gated by push preferences; only device push is.
- Push defaults: off per category, discreet on (no content on a lock screen).
- Deletion: `notifications` and `notification_preferences` are hard-deleted with the account (see
  `NOTIFICATIONS_PROFILE_AND_DELETION_CONTRACT.md` and the deletion registry, slug `notifications`).
- Audit: not applicable — member self-service reads/marks of one's own rows, no admin governance
  action. (If a future admin-broadcast producer is added, add an audit event then.)

## 6) Web and Android Delivery Status

- Web / mobile-responsive: the 🔔 tab and feed ship here (this PR). The native Android app is
  narrowed to Chyme (rule 105), so there is no native Android notifications surface; the installable
  web app covers phones.

## 7) Seed Coverage Status

No seed yet. A follow-up seed can insert a couple of sample notifications for a demo member.

## 8) Gaps and Known Technical Debt

- @mention notifications ship now. There is still no central username store, so a handle is resolved
  at post time (`lib/identity/resolve-mention-user-ids.ts`): a `@username` is looked up against Clerk
  (the authoritative account store) in one batched call, and the `@user-<token>` pseudonym is reversed
  against our own community-post authors — accepted only when the short token matches exactly one
  author, so an ambiguous prefix never pings a bystander. Any handle that cannot be resolved is
  dropped; resolution is best-effort and never blocks the post.
- Device push is delivered via Web Push (`lib/notifications/push.ts`, shared with Foundation call
  alerts), gated by the member's per-category opt-in and discreet setting. It requires the VAPID
  server keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) in the environment; when they
  are unset every send is a logged no-op, so the in-app feed still works. Platform limits apply:
  Web Push reaches Android/Chrome and installed iOS web apps, not a plain iOS browser tab.
- Emergency real-time (an incoming Foundation call ring) is a separate live mechanism from this
  durable feed and is tracked with the Safety producers.

## Build Checklist

1. **Backbone (this PR):** schema (`notifications`, `notification_preferences`), repository,
   command + access-policy contracts, deletion-registry entry, the five API routes, and the 🔔 tab
   with the always-on feed + the per-category opt-ins. No dependencies.
2. **Commons producer (done):** emit on reply-to-your-post, announcement reply, and `@mention` (each
   member a new community post addresses; resolved at post time — see Gaps for how a handle maps to a
   user id).
3. **Everyday producers (done):** ServiceCredits (credits received on a completed direct transfer),
   LevelUp (milestone credits released to the learner), Recurring Activity (invited / confirmed /
   declined). Emitted from each plugin's route via `notifySafe`, after the underlying write.
4. **Safety producers (done):** LightHouse (host gets a new stay request), SocketRelay (requester's
   request was claimed), TrustTransport (provider's offer was accepted), Foundation (someone started a
   connection). Foundation's live incoming-call **ring stays its own real-time path** — the feed entry
   is the durable complement, not the ring.
5. **Device-push delivery (done):** `notifySafe` sends a Web Push on a genuinely new notification when
   the recipient opted that category in — discreet by default (generic ping, no plugin name or
   content). Notifications-owned subscribe/unsubscribe/vapid-public-key endpoints, and the 🔔 tab
   subscribes this device when a member turns a category on. Reuses the shared push sender + the
   user-global `push_subscriptions` table; no-op until VAPID keys are set.

## Change Log

- 2026-07-22: Deep links now reach messages older than the recent page. The Commons only loaded the
  recent page, so an "Open" to an older message landed without the flash. `GET /api/hub/messages` gained
  `aroundPost` / `aroundAnnouncement` params that return a page centered on the target, and the Commons
  merges that window in alongside the recent page before scrolling to it. See the Survivor Hub / Commons
  inventory for the mechanism.
- 2026-07-21: Deep links on "Open". Commons notifications now link to the exact message instead of the
  Commons home. A reply or @mention links to `/?post=<postId>` and an announcement reply to
  `/?announcement=<announcementId>`; the Commons shell reads that query param on load, scrolls the
  message (or announcement card) into view and flashes it, then clears the param so a refresh does not
  re-jump (it retries briefly while the recent page streams in, then gives up quietly for a post older
  than the loaded window). The earliest Commons rows were written before deep links and stored the
  bare `/`; a reply/mention row is upgraded to its `/?post=<id>` link on read from its `target_ref`, so
  no backfill migration is needed. Plugin-event notifications keep their existing `/apps/<plugin>` link.
- 2026-07-21: @mention notifications. A new Commons community post now notifies each member it
  @-mentions (`commons.mention`, category `community`), deduped per post via `target_ref` so a member
  mentioned twice in one post is notified once, never self-notifying, and skipping the parent author
  on a reply (they already get the reply notification). Handles are pulled from the body by the pure
  `extractMentionHandles` (an email is not a mention; `@comic` is the AI Assistant, not a member) and
  resolved by `lib/identity/resolve-mention-user-ids.ts`: `@username` via a batched Clerk lookup, the
  `@user-<token>` pseudonym reversed against our own community-post authors and accepted only when the
  token is unambiguous. Best-effort throughout — a handle that will not resolve is dropped and the post
  is never blocked.
- 2026-07-20: Device-push delivery. `notifySafe` now sends a Web Push (via the shared
  `sendWebPushToUser`) on a genuinely new notification when the recipient has opted that category in —
  discreet by default (a generic "You have a new update" ping with the in-app path in `data`, no
  plugin name or content on the lock screen); detailed mode sends the neutral summary. Deduped events
  never re-ping. Added notifications-owned `push/subscribe`, `push/unsubscribe`, and
  `push/vapid-public-key` routes (thin wrappers over `lib/notifications/push.ts`, reusing the
  user-global `push_subscriptions` table shared with Foundation), and the 🔔 tab now registers the
  service worker and subscribes this device when a member turns a category on (best-effort; a note
  shows if the browser can't, and the in-app feed is unaffected). Requires the VAPID env keys; a no-op
  without them.
- 2026-07-20: Safety producers (category `safety`), each emitted from its route via `notifySafe`,
  deduped on the underlying row id, never self-notifying: LightHouse notifies the host of a new stay
  request (`lighthouse.match.requested`); SocketRelay notifies the requester when their request is
  claimed (`socket-relay.request.claimed`); TrustTransport notifies the provider when their offer is
  accepted (`trust-transport.offer.accepted`); Foundation notifies the provider when someone starts a
  connection thread (`foundation.connection.started`, deduped on the thread id so getOrCreate reuse
  never re-notifies). Foundation's live incoming-call ring is unchanged — this is the durable feed
  complement, not the ring.
- 2026-07-20: Everyday producers. ServiceCredits notifies the recipient of a completed direct
  member-to-member transfer (`service-credits.received`, emitted from `/api/service-credits/transfers`,
  not from the ledger function — plugin-origin transfers like rides/calls will notify via their own
  domain producers). LevelUp notifies the learner when a milestone's credits are released
  (`level-up.milestone.released`; `releaseMilestoneCredits` now returns `recipientUserId` so the route
  can address it). Recurring Activity notifies the counterparty on a new activity
  (`recurring-activity.invited`) and the owner on confirm/decline
  (`recurring-activity.confirmed` / `.declined`). All best-effort via `notifySafe`, deduped on the
  underlying row id, never self-notifying.
- 2026-07-20: Commons producer — `createFeedCommunityPost` now notifies the parent post's author when
  someone replies (`commons.reply`), and `replyToAnnouncement` notifies the announcement's author
  (`commons.announcement_reply`). Both emit after the transaction commits via `notifySafe` (a new
  best-effort wrapper that logs but never breaks the underlying post), never for a self-reply, with a
  neutral summary (no author name or content) and `target_ref` set to the new row for dedupe.
  `@mention` notifications are deferred (see Gaps).
- 2026-07-20: Created the notifications center backbone — schema, repository, contracts,
  deletion-registry entry, the `/api/notifications/*` routes, and the 🔔 tab in the Commons (always-on
  in-app feed with calm read/unread, an "Open" deep-link pill per row, "mark all read", and the three
  device-push opt-ins defaulting off with discreet-push on). Per-plugin producers and device-push
  delivery are the enumerated follow-ups above.
