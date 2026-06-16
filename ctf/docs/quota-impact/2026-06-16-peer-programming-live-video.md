# Stream Quota Impact Note — Peer Programming live video Session

## Summary

- Feature/Change: Wire real GetStream video into the Peer Programming Session tab. A new
  `POST /api/peer-programming/session/join` mints per-cohort video call credentials, and the web
  Session tab joins a live call instead of showing a static placeholder.
- PR: #556
- Owner: chargingthefuture
- Date: 2026-06-16

## Stream Surfaces Affected

- Video. Each cohort gets one Stream video call (call type `default`, call id `pp-<cohortId>`). No new
  Chat, Activity Feed, or AI Moderation usage — the cohort text room is the existing Postgres-backed
  message store, not Stream Chat.

## Estimated Monthly Impact

- Chat MAU impact estimate: none (no Stream Chat used by this feature).
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: bounded by cohorts. Cohorts are at most 5 members and sessions
  are opt-in (a member must press "Join Session"). Worst case per active cohort ≈ 5 members ×
  session length. For an early-stage member base this is on the order of a few hundred to low
  thousands of participant-minutes per month, well under the Maker-tier video allowance. Scales
  linearly with the number of cohorts that actually start a call, not with total membership.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout: Green. Video is opt-in, per-cohort, and capped by the 5-member
  cohort size, so it cannot fan out to the whole member base at once.
- Peak scenario estimate: every cohort holding a simultaneous call. Even then, concurrency is
  (number of cohorts × ≤5), which remains small relative to the Maker-tier video ceiling at current
  scale. Re-evaluate if cohort count grows by an order of magnitude.

## Fallback and Degradation Plan

- What degrades first: if Stream is not configured (no API key/secret), `session/join` returns 503
  and the join button surfaces "Live video is not configured." The async text room and all other
  Peer Programming features keep working — video is additive.
- User-visible messaging behavior: a member with no cohort sees "Join a cohort to access live
  sessions" (404 from the route); a connect failure shows the Stream error in place with a Back
  control.
- Kill switch / feature flag: demo mode already routes Stream to the staging app
  (`resolveStreamCredentials`), so recording sessions never consume production quota. Removing the
  production `STREAM_API_KEY`/`STREAM_API_SECRET` disables the feature gracefully (503 path above).

## Observability

- Metrics and alerts added/updated: join attempts and failures are reported to Sentry via
  `reportError` (`area: 'peer-programming'`, `op: 'session_join'` server-side and
  `session_join_client` in the browser). Allow/deny decisions are written to the
  `peer_programming_admin_audit_trail` (`peer-programming.session.join`).
- Dashboard link (if available): existing Stream usage dashboard (Maker-tier video usage).

## Validation

- Tests added for degraded mode: covered by the route's explicit 404 (no cohort) and 503 (Stream not
  configured) branches; the client renders the error/back state without crashing. No automated test
  harness for live Stream calls (consistent with the existing Chyme/Lighthouse video surfaces).
- Rollback strategy: revert the PR, or unset the production Stream credentials to disable the join
  path while leaving the rest of Peer Programming intact.
