# Stream Quota Impact Note — verbose error handling sweep

## Summary

- Feature/Change: Repo-wide error-message sweep for rule 137 (verbose error handling). One Stream-named
  file is in the diff — `ctf/packages/web/app/api/beacon/stream-webhook/route.ts` — and the change there
  is one line: the invalid-JSON `catch` now binds the error and returns a `reason` field next to the
  existing message. No Stream call is added, removed, retried, moved, or re-timed anywhere in this
  change.
- PR: opened from branch `fix/verbose-error-handling-across-api-routes`.
- Owner: chargingthefuture
- Date: 2026-08-03

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **none functionally.** The only Stream-adjacent file
  touched is the Beacon Stream webhook receiver, and only its error text. Webhook deliveries are inbound
  from Stream and are not billed as app-side calls.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes / HLS / recording estimate: no change.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** No call-pattern change, so the
  current threshold carries over untouched.
- Peak scenario estimate: unchanged.

## Fallback and Degradation Plan

- What degrades first: unchanged. Stream unconfigured still degrades every Beacon surface to its calm
  idle state.
- User-visible messaging behavior: a malformed webhook body now answers with the parse reason in a
  `reason` field alongside the existing message. This endpoint is machine-to-machine; no member-facing
  copy changed. Secrets are never included — the shared helper echoes only the caught message, truncated.
- Kill switch / feature flag: unchanged. Demo mode still routes to the staging Stream app via
  `resolveStreamCredentials`.

## Observability

- Metrics and alerts added/updated: none added. Across the app, error paths that previously discarded the
  caught value now report it, so failures that were invisible reach stdout and Sentry. Stream's dashboard
  remains the source of truth for usage.

## Validation

- Tests added for degraded mode: none automated (rule 118 defers automated tests during MVP). The new
  gate `ctf/scripts/check-error-verbosity.mjs` is the check: it reports 0 findings across the API routes.
  Lint, typecheck, build, the end-of-file check, and the modularity governance check pass.
- Rollback strategy: revert the branch. Error messages return to their previous fixed text; no schema,
  contract, route, or Stream-call change is involved.
