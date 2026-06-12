# Stream Quota Impact Note — Mobile Questions chat + TrustTransport trip chat

## Summary

- Feature/Change: Wire three mobile screens to real server data. Two of them use Stream chat: the
  mobile Questions screen now connects to a dedicated Stream Chat channel (`ctf-feed-questions`), and
  the TrustTransport trip thread tab is now text chat only (its out-of-scope video room was removed)
  and connects to the real trip channel. The third change (DirectoryProfile) does not touch Stream.
- PR: #444
- Owner: charging-the-future
- Date: 2026-06-12

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat only.** A new Questions chat channel reusing
  the existing Feed Stream identity, and a correctness fix so the TrustTransport trip chat tab connects
  to the real channel. **Video is removed** — the TrustTransport tab no longer creates a Stream Video
  room (it was unreferenced scaffold with no web parity and no product scope). No change to Activity
  Feeds or AI Moderation.

## Estimated Monthly Impact

- Chat MAU impact estimate: ~0 net new monthly active chat users. The Questions screen reuses the same
  Stream user identity (`feed-<userId>`) the Feed already creates, so a member who opens Questions is
  already counted as a Stream chat MAU through the Feed. Only the channel they join is new
  (`ctf-feed-questions`); channels are not billed per-MAU. The TrustTransport trip chat already used
  the same per-user Stream identity; this only corrects which channel it connects to.
- Activity Feed API calls estimate: none (this change does not use Activity Feeds).
- Video participant-minutes estimate: **net reduction.** Removing the TrustTransport video room means
  no video participant-minutes are spent there; the previous scaffold would have started video calls
  once it received a call id.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green**. Chat reuses existing
  identities (no MAU growth) and the change removes a potential video cost rather than adding one.
- Peak scenario estimate: the Questions channel adds messages, not billed MAUs; there is no new video
  surface, so there is no fan-out- or video-driven spike to model.

## Fallback and Degradation Plan

- What degrades first: if Stream is unconfigured or unreachable, `getFeedStreamCredentials` /
  `createTrustTransportParticipantToken` return null and the routes respond `503` ("Stream service is
  not configured.") or `500`. The mobile screens surface that as an inline error and render nothing
  else — no crash, no retry storm.
- User-visible messaging behavior: the Questions screen and the trip chat tab show their error text;
  the rest of each app is unaffected.
- Kill switch / feature flag: removing the `ctf-feed-questions` route degrades Questions back to
  "unavailable" without affecting the Feed announcements chat or the trip chat.

## Observability

- Metrics and alerts added/updated: none new. Both routes call the existing `reportError` path
  (`area: 'feed', op: 'questions_stream'` and `area: 'trusttransport', op: 'trips_tripid_chat'`), so
  failures surface in the existing error reporting.
- Dashboard link (if available): existing Stream usage dashboard (no change).

## Validation

- Tests added for degraded mode: covered by the existing null-credentials path (routes return 503/500
  and the mobile clients throw a handled error). Typecheck and the web build pass; the new
  `/api/questions/stream` route is present in the build output.
- Rollback strategy: revert PR #444. No schema or data migration is involved, so revert is clean.
