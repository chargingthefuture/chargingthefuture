# Stream Quota Impact Note — Chyme moderation through the Stream server SDK

## Summary

- Feature/Change: Moderation controls for Chyme (owner decision, 2026-09-19): an admin can mute a
  member, remove a member (kept out until let back in), let a member speak or move them back to
  listening in the new hand-raise mode, and switch a room between open mic and hand-raise mode.
  The database is the record (`chyme_room_removals`, `chyme_rooms.speak_mode`,
  `chyme_admin_audit_trail`); the Stream call is where it takes effect, through
  `@stream-io/node-sdk` (new web dependency) in `ctf/packages/web/lib/chyme/stream-moderation.ts`:
  `muteUsers`, `blockUser`, `unblockUser`, `updateCallMembers`.
- PR: `feat/chyme-moderation-controls`
- Owner: chargingthefuture
- Date: 2026-09-19

## Stream Surfaces Affected

- **Video**: server-side call operations on the existing Chyme calls (`default` call type, ids
  `chyme-main-room` / `chyme-contributors-room`). No new call is created; no participant is added.
  Each admin action is one API call (the speak-mode switch is one `muteUsers` for everyone present
  plus one `updateCallMembers` per demoted member). A removal blocks the member from the call,
  which ends their participant-minutes at once rather than at the presence window.
- **Chat**: none. The server client is created per action and holds no socket.
- Activity Feeds, AI Moderation: no change.

## Estimated Monthly Impact

- Chat MAU impact estimate: none. No user is upserted by these calls; the admin's Stream user
  already exists.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: **down or unchanged.** A muted member still counts as a
  participant (minutes are per connected participant, speaking or not); a removed member stops
  counting the moment they are blocked. Hand-raise mode changes who publishes, not who is
  connected. The server calls themselves are not metered as participant-minutes.
- AI Moderation credits estimate: none — this is human moderation, not Stream's moderation product.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** Admin actions are rare,
  one call each, and never retried in a loop.
- Peak scenario estimate: an admin switching a full room (50 members) to hand-raise mode makes one
  `muteUsers` call and up to 50 `updateCallMembers` calls in sequence — bounded by the room cap and
  by the number of admins (one).

## Fallback and Degradation Plan

- What degrades first: with Stream unreachable, or the call ended, each function answers
  `{ ok: false, reason }` (an 8-second bound on the server client) and the route still records the
  decision and enforces it in this app — a removal keeps the member out of join and heartbeat, a
  role change is on the presence row — and answers `ok: true` with `streamNotice` carrying Stream's
  reason. Nothing is turned into a 500 that undoes the decision.
- User-visible messaging behavior: the admin sees one amber line under the control, "Recorded, but
  Stream did not apply it in the call: …". A removed member sees "An admin removed you from this
  room. You can come back once an admin lets you back in." in place of the stage. A listener in
  hand-raise mode sees "Listening — raise your hand to ask to speak" in place of the microphone
  control.
- Kill switch / feature flag: none needed — a room nobody switches stays in open mic, which is the
  room exactly as it shipped. Hand-raise mode's call-side enforcement rides on
  `CHYME_GUEST_STREAM_ROLE` (already configured); unset, the apps enforce the mode alone. Demo mode
  routes the server client to the staging Stream app through `resolveStreamCredentials`, unchanged.

## Observability

- Metrics and alerts added/updated: every action writes `chyme_admin_audit_trail` with
  `streamApplied` in its metadata, so a run of Stream failures is visible in the trail; failures are
  also reported through `reportError` (ops `moderation_mute`, `moderation_block`,
  `moderation_unblock`, `moderation_role`, `moderation_mute_all`).
- Dashboard link (if available): `/admin/chyme` (Removed members). The minute meter is unchanged.

## Validation

- Tests added for degraded mode: none automated on the Stream side (the server SDK is not mocked
  in this repo). The degraded path is the `{ ok: false, reason }` branch of every function in
  `stream-moderation.ts`, exercised by the manual test script CH-23 step 7 (Stream unreachable).
  Typecheck and lint pass on web and mobile.
- Rollback strategy: revert the PR. The schema is additive (`speak_mode` defaults to `open`; the
  two new tables can stay). The dependency is removed with the revert.
