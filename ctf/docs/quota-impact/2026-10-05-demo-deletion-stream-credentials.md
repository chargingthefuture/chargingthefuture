# Stream Quota Impact Note — A deletion pinned to the demo schema uses the demo Stream app

## Summary

- Feature/Change: `resolveStreamCredentials()` now follows a schema pinned with `runWithForcedPool`
  before it looks at demo-mode targeting. The operator account-delete route
  (`POST /api/internal/account/delete` with `target: "demo"`) pins the deletion to the demo schema
  and has no signed-in caller, so demo mode always read as off and its Stream cleanup ran against the
  production app: it hard-deleted the person's production Chyme, Beacon, Foundation, LightHouse,
  SocketRelay and TrustTransport Stream users and messages, and left the demo copy in place
  (issue #2941). A deletion pinned to `demo` now uses `STREAM_API_KEY_STAGING` /
  `STREAM_API_SECRET_STAGING`; one pinned to `public` (the Clerk webhook, a production operator
  delete) uses the production pair.
- PR: see the pull request that adds this note.
- Owner: chargingthefuture
- Date: 2026-10-05

## Stream Surfaces Affected

- Chat: the account-deletion Stream cleanups in `lib/account/external-cleanup-registry.ts` (Chyme,
  Beacon, Foundation, LightHouse, SocketRelay, TrustTransport), and any other Stream call made inside
  `runWithForcedPool`. Nothing changes for a request with no pinned schema.

## Estimated Monthly Impact

- Chat MAU impact estimate: none. A demo deletion makes the same number of Stream calls as before,
  against the demo app instead of the production one.
- Activity Feed API calls estimate: a few calls fewer on the production app per demo deletion.
- Video participant-minutes estimate: no change.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged, **Green**. The change can
  only move calls off the production app.
- Peak scenario estimate: demo deletions are operator actions run by hand, a handful a month.

## Fallback and Degradation Plan

- What degrades first: inside a deletion pinned to `demo`, a missing staging pair resolves to `null`
  and the cleanup does nothing, which is the existing demo-mode rule: it never falls back to the
  production app.
- User-visible messaging behavior: none; the operator route is called from a workflow, and the
  cleanups are best-effort and logged as they already were.
- Kill switch / feature flag: the route's `target` field chooses the schema, and with it the Stream
  app.

## Observability

- Metrics and alerts added/updated: none. The cleanups already report failures through their own
  logging.

## Validation

- Tests added for degraded mode: `lib/integrations/stream-credentials.test.ts` covers demo mode with
  no pinned schema, a deletion pinned to `demo` with no signed-in caller, work pinned to `public` for
  a demo participant, and the missing staging pair returning `null` rather than production.
- Rollback strategy: revert the two lines in `resolveStreamCredentials` and the read-only
  `getForcedPoolTarget` export in `lib/db/postgres.ts`.
