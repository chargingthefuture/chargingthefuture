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
   relative time, and — when there is somewhere to go — an "Open" pill that deep-links into the
   plugin (same pill pattern as linked announcements). Opening or hovering a row marks it read.
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

- No producers yet — the feed is empty until each plugin's emit points land (see Build Checklist).
- No device-push delivery yet — preferences are recorded but nothing sends a ping. Web push has
  platform limits (Android/Chrome and installed iOS web apps only), to be handled in the delivery
  step.
- Emergency real-time (an incoming Foundation call ring) is a separate live mechanism from this
  durable feed and is tracked with the Safety producers.

## Build Checklist

1. **Backbone (this PR):** schema (`notifications`, `notification_preferences`), repository,
   command + access-policy contracts, deletion-registry entry, the five API routes, and the 🔔 tab
   with the always-on feed + the per-category opt-ins. No dependencies.
2. **Commons producer:** emit on reply-to-your-post, `@mention`, and announcement reply. Blocked by 1.
3. **Everyday producers:** ServiceCredits (credits received), LevelUp, Recurring Activity. Blocked by 1.
4. **Safety producers:** LightHouse, SocketRelay, TrustTransport, Foundation — with the emergency
   real-time ring called out as its own live path (the feed is the durable record, not the ring).
   Blocked by 1.
5. **Device-push delivery:** content-safe/discreet payload, category-gated by preferences, web-push
   with the PWA/native platform caveats. Blocked by 1; benefits from 2–4 existing so there is
   something to ping about.

## Change Log

- 2026-07-20: Created the notifications center backbone — schema, repository, contracts,
  deletion-registry entry, the `/api/notifications/*` routes, and the 🔔 tab in the Commons (always-on
  in-app feed with calm read/unread, an "Open" deep-link pill per row, "mark all read", and the three
  device-push opt-ins defaulting off with discreet-push on). Per-plugin producers and device-push
  delivery are the enumerated follow-ups above.
