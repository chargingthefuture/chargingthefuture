# Stream Quota Impact Note — Mobile PeerProgramming live video Session

## Summary

- Feature/Change: Android (React Native) parity for the PeerProgramming Session tab's live video
  call. The mobile Session tab now has a "Join Session" button that calls the existing
  `POST /api/peer-programming/session/join` (through the shared authenticated fetch helper) and joins
  the same per-cohort GetStream video call the web Session tab already joins, using
  `@stream-io/video-react-native-sdk`. This does not create a new call — it brings mobile members into
  the same per-cohort call as web.
- PR: feat/mobile-peer-programming-session-video (no PR opened per task instruction)
- Owner: chargingthefuture
- Date: 2026-06-23

## Stream Surfaces Affected

- Video. No new call type or call id: the call type is `default` and the call id is `pp-<cohortId>`,
  derived server-side from the caller's cohort by the unchanged join route and
  `lib/peer-programming/stream.ts`. No new Chat, Activity Feed, or AI Moderation usage — the cohort
  text room is the existing Postgres-backed message store, not Stream Chat.

## Estimated Monthly Impact

- Chat MAU impact estimate: none (no Stream Chat used by this feature).
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: no new call and no new ceiling — this only lets a member already
  in a cohort join their cohort's existing call from the phone app instead of (or in addition to) the
  browser. Usage stays bounded by cohort size (at most ~5 members) and by how often a cohort actually
  holds a session (opt-in: a member must press "Join Session"). Worst case per active cohort ≈ 5
  members × session length. For an early-stage member base this is on the order of a few hundred to low
  thousands of participant-minutes per month, well under the Maker-tier video allowance, and scales
  with the number of cohorts that start a call, not with total membership. If a member joins from both
  web and phone at once, the participant de-duplication keeps one tile per user but the SDK would still
  count two participant sessions — an expected, small, member-driven edge, not a fan-out risk.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green. Video is opt-in, per-cohort, and
  capped by the ~5-member cohort size, so it cannot fan out to the whole member base at once. Mobile
  parity adds reach (a member can join from the phone) but not a new call.
- Peak scenario estimate: every cohort holding a simultaneous call with all members on a phone. Even
  then, concurrency is (number of cohorts × ≤5), which remains small relative to the Maker-tier video
  ceiling at current scale. Re-evaluate if cohort count grows by an order of magnitude.

## Fallback and Degradation Plan

- What degrades first: if Stream is not configured (no API key/secret), `session/join` returns 503 and
  the mobile Session tab shows "Live video is unavailable right now. The cohort text room still works."
  The async text room and all other PeerProgramming features keep working — video is additive.
- User-visible messaging behavior: a member with no cohort sees "You're not in a cohort yet. Join a
  cohort to access live sessions." (404 from the route); a connect failure shows the Stream error in
  place with a retry; a read-only listener (viewing another cohort) is told to open their own cohort's
  Session tab rather than being offered a join.
- Kill switch / feature flag: demo mode already routes Stream to the staging app
  (`resolveStreamCredentials`), so recording sessions never consume production quota. Removing the
  production `STREAM_API_KEY`/`STREAM_API_SECRET` disables the feature gracefully (the 503 path above)
  on both web and mobile.

## Observability

- Metrics and alerts added/updated: no new client metric on mobile. The server route is unchanged, so
  server-side join attempts/failures still report to Sentry via `reportError`
  (`area: 'peer-programming'`, `op: 'session_join'`), and allow/deny decisions are still written to the
  `peer_programming_admin_audit_trail` (`peer-programming.session.join`). The mobile call surfaces a
  failed join inline rather than to a separate metric, consistent with the Chyme/Lighthouse mobile
  video surfaces.
- Dashboard link (if available): existing Stream usage dashboard (Maker-tier video usage).

## Validation

- Tests added for degraded mode: covered by the route's existing 404 (no cohort) and 503 (Stream not
  configured) branches, now mapped to explicit mobile states (`no-cohort`, `stream-disabled`, `error`)
  in `joinSession()`; the call component renders the error/back state without crashing. No automated
  test harness for live Stream calls (consistent with the existing Chyme/Lighthouse video surfaces) —
  the live join is verified manually on a device.
- Rollback strategy: revert the branch, or unset the production Stream credentials to disable the join
  path while leaving the rest of PeerProgramming intact.
