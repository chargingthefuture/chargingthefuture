# Stream Quota Impact Note — Mobile Questions chat + TrustTransport trip video

## Summary

- Feature/Change: Wire three mobile screens to real server data. Two of them use Stream: the mobile
  Questions screen now connects to a dedicated Stream Chat channel (`ctf-feed-questions`), and the
  TrustTransport trip "stream" tab now receives a video `callId` so its 1:1 video room works. The
  third change (DirectoryProfile) does not touch Stream.
- PR: #444
- Owner: charging-the-future
- Date: 2026-06-12

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat** (a new Questions chat channel reusing the
  existing Feed Stream identity) and **Video** (the TrustTransport per-trip 1:1 call, which already
  existed as a tab but never received a call id, so video never actually started until now).
  No change to Activity Feeds or AI Moderation.

## Estimated Monthly Impact

- Chat MAU impact estimate: ~0 net new monthly active chat users. The Questions screen reuses the same
  Stream user identity (`feed-<userId>`) the Feed already creates, so a member who opens Questions is
  already counted as a Stream chat MAU through the Feed. Only the channel they join is new
  (`ctf-feed-questions` instead of `ctf-feed-announcements`); channels are not billed per-MAU.
- Activity Feed API calls estimate: none (this change does not use Activity Feeds).
- Video participant-minutes estimate: small and bounded by real trips. Video is 1:1 (the two trip
  participants) and only runs while a trip is active. This change does not create new trips — it only
  lets the already-shipped video tab connect, so the ceiling is (active trips that open the video tab)
  × 2 participants × trip duration. At current trip volumes this is a low, naturally rate-limited
  number, not a fan-out multiplier.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green**. Chat reuses existing identities
  (no MAU growth) and video is 1:1, gated by real trips.
- Peak scenario estimate: even if every active trip opened video simultaneously, participant-minutes
  stay proportional to live trips (2 participants each), which is far below any fan-out-driven spike.
  The Questions channel adds messages, not billed MAUs.

## Fallback and Degradation Plan

- What degrades first: if Stream is unconfigured or unreachable, `getFeedStreamCredentials` /
  `createTrustTransportParticipantToken` return null and the routes respond `503` ("Stream service is
  not configured.") or `500`. The mobile screens already surface that as an inline error and render
  nothing else — no crash, no retry storm.
- User-visible messaging behavior: the Questions screen and the trip stream tab show their error text;
  the rest of each app is unaffected.
- Kill switch / feature flag: removing the `ctf-feed-questions` route or the `callId` field degrades
  these surfaces back to "unavailable" without affecting the Feed announcements chat or trip text chat.
  Video only initializes when the server returns a `callId`, so omitting it cleanly disables video
  while leaving text chat working.

## Observability

- Metrics and alerts added/updated: none new. Both routes call the existing `reportError` path
  (`area: 'feed', op: 'questions_stream'` and `area: 'trusttransport', op: 'trips_tripid_chat'`), so
  failures surface in the existing error reporting.
- Dashboard link (if available): existing Stream usage dashboard (no change).

## Validation

- Tests added for degraded mode: covered by the existing null-credentials path (routes return 503/500
  and the mobile clients throw a handled error). Typecheck and the web build pass; the new
  `/api/questions/stream` route is present in the build output.
- Rollback strategy: revert PR #444. No schema or data migration is involved, so revert is clean; the
  Questions screen and trip video tab return to their prior (non-functional) state and nothing else
  changes.
