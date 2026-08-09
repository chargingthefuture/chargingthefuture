# Stream Quota Impact Note — verbose error handling outside route handlers

## Summary

- Feature/Change: Rule 137 applied to the code that is neither a route handler nor a screen — the web
  server libraries, the operational scripts, the shared packages, and the native app's modules. Several
  Stream-named files are in the diff (`lib/chyme/stream.ts`, `lib/foundation/stream.ts`,
  `lib/lighthouse/stream.ts`, `lib/trust-transport/stream.ts`, `lib/beacon/stream.ts`,
  `lib/shared/stream-video.ts`, `lib/hub/live-stream.ts`, and the native `StreamChatSearch` /
  `StreamVideoPanel`), and in every one the change is error handling only: a stated `no-trace:` reason on
  a deliberate silence, or a `reportError` call added where a failure was being swallowed. No Stream call
  is added, removed, retried, moved, or re-timed.
- PR: opened from branch `fix/verbose-errors-outside-route-handlers`.
- Owner: chargingthefuture
- Date: 2026-08-03

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **none functionally.** The four `channel.create()` →
  `channel.watch()` fallbacks keep exactly the same two calls in the same order; they only now say in the
  code why the failed create is expected. `lib/hub/live-stream.ts` reports the reason when a Stream Chat
  connection fails and still falls back to polling as before. The native panels only gained error
  reporting.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: no change.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** No call-pattern change, so the
  current threshold carries over.
- Peak scenario estimate: unchanged.

## Fallback and Degradation Plan

- What degrades first: unchanged. A failed Stream Chat connect still leaves the Hub on polling; a failed
  channel create still watches the existing channel; an unconfigured Stream still degrades every
  Stream-backed surface to its calm state.
- User-visible messaging behavior: unchanged on member surfaces. The only added user-visible text is on
  the native admin Unlock screen, which now names the reason in its own error line.
- Kill switch / feature flag: unchanged. Demo mode still routes to the staging Stream app via
  `resolveStreamCredentials`.

## Observability

- Metrics and alerts added/updated: no new metrics, but a real gain in coverage. The native app had **no
  error reporting for caught failures at all**; `ctf/packages/mobile/src/observability/report.ts` adds it
  (a log line always, Sentry when a DSN is configured), and the Chyme back-channel join failure and the
  Stream chat search failure now report instead of vanishing. On the web, a failed Stream Chat connect in
  `lib/hub/live-stream.ts` now reports rather than silently falling back to polling.

## Validation

- Tests added for degraded mode: none automated (rule 118 defers automated tests during MVP). The gate
  `ctf/scripts/check-error-verbosity.mjs` reports 0 findings across all three surfaces. Web typecheck,
  web lint, web build, mobile typecheck, mobile lint, the end-of-file check, the modularity governance
  check, and the web/Android parity check all pass.
- Rollback strategy: revert the branch. Error handling returns to its previous state; no schema,
  contract, route, or Stream-call change is involved.
