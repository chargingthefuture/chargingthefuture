# Stream Quota Impact Note — Demo-mode staging routing

## Summary

- Feature/Change: Route Stream credentials through `resolveStreamCredentials()` so demo mode uses a
  separate Stream app (`STREAM_API_KEY_STAGING` / `STREAM_API_SECRET_STAGING`) instead of production.
- PR: #87 (production-readiness progress channel)
- Owner: chargingthefuture
- Date: 2026-05-26

## Stream Surfaces Affected

- Chat: all plugin chat surfaces that mint Stream credentials — chyme, feed, foundation, lighthouse,
  socketrelay, trusttransport. Behavior is unchanged in production; only the credential source changes
  when `demo-mode` is ON.

## Estimated Monthly Impact

- Chat MAU impact estimate: net **reduction** of production MAU/API usage. Demo/recording traffic that
  previously counted against the production Maker-tier app now lands on the separate demo Stream app.
- Activity Feed API calls estimate: same — demo traffic moves off the production app.
- Video participant-minutes estimate: no change to production path; demo video (if any) moves to the
  demo app.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): unchanged → **Green**. This change can
  only lower production consumption.
- Peak scenario estimate: a long recording session no longer risks pushing the production app toward
  Yellow/Orange, because that traffic is isolated to the demo app's own (separate) quota.

## Fallback and Degradation Plan

- What degrades first: in demo mode, if `STREAM_API_KEY_STAGING` / `STREAM_API_SECRET_STAGING` are not
  configured, `resolveStreamCredentials()` returns `null` and Stream-backed features no-op (the
  existing null-config behavior). It never falls back to the production app.
- User-visible messaging behavior: chat surfaces render their existing "unavailable" empty state when
  credentials resolve to `null`, identical to today's unconfigured behavior.
- Kill switch / feature flag: `demo-mode` (system flag) is itself the switch; production is the default
  (flag OFF).

## Observability

- Metrics and alerts added/updated: none in this change. Existing Maker-tier metering is unchanged for
  the production app and now excludes demo traffic, which improves the accuracy of production dashboards.

## Validation

- Tests added for degraded mode: covered by the existing null-config paths in each plugin's Stream
  reader (credentials `null` → feature no-ops). Manual validation: with `demo-mode` ON and staging keys
  set, chat traffic appears on the demo Stream app; with staging keys unset, chat degrades and the
  production app receives nothing.
- Rollback strategy: revert the resolver wiring; each reader falls back to reading
  `STREAM_API_KEY` / `STREAM_API_SECRET` directly.
