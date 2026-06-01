# Stream Quota Impact Note — app-wide error reporting

## Summary

- Feature/Change: Add `reportError()` (Sentry capture) to the unexpected-failure catch blocks
  across the web app's API routes. Observability only — no behavior change.
- PR: #270
- Owner: chargingthefuture
- Date: 2026-06-01

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **none**. This change only edits API route catch
  blocks to report errors to Sentry. It does not mint Stream credentials, call GetStream, or change
  any Stream usage. This note exists solely because the diff touches route files whose paths contain
  the substring "stream" (the path-based gate check), not because Stream quota is affected.

## Estimated Monthly Impact

- Chat MAU impact estimate: no change.
- Activity Feed API calls estimate: no change.
- Video participant-minutes estimate: no change.
- AI Moderation credits estimate: no change.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green**. No Stream consumption is
  added or changed.
- Peak scenario estimate: no Stream impact under any load; this only adds error reporting.

## Fallback and Degradation Plan

- What degrades first: nothing new. Each affected route keeps its existing response and status; the
  only addition is a Sentry capture in the catch path.
- User-visible messaging behavior: unchanged.
- Kill switch / feature flag: none required; reporting is best-effort and never alters the response.

## Observability

- Metrics and alerts added/updated: this change *is* the observability improvement — caught errors
  across the API layer now reach Sentry, tagged by area/op.

## Validation

- Tests added for degraded mode: none (no behavior change). Typecheck, ESLint, and EOF formatting
  pass.
- Rollback strategy: revert the PR; routes return to swallowing their errors. No Stream consequence.
