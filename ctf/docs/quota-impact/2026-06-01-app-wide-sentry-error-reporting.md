# Stream Quota Impact Note

## Summary
- Feature/Change: App-wide verbose server-side error reporting to Sentry. Adds `reportError(...)` calls inside existing catch blocks across `ctf/packages/web/app/api/**/route.ts`. This note exists because one touched route path (`app/api/feed/stream/route.ts`) matches the Stream-change detector; the change itself adds no Stream usage.
- PR: #273
- Owner: platform-observability
- Date: 2026-06-01

## Stream Surfaces Affected
- Chat / Activity Feeds / Video / AI Moderation: None. No Stream (getstream.io) API call is added, removed, or altered. The change only reports already-caught server errors to Sentry; request/response behavior, status codes, and Stream interactions are unchanged.

## Estimated Monthly Impact
- Chat MAU impact estimate: none.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none.
- AI Moderation credits estimate: none.

## Budget Threshold Risk
- Expected threshold after rollout (Green/Yellow/Orange/Red): Green. No change to Stream consumption.
- Peak scenario estimate: unchanged from current baseline; this change cannot increase Stream calls.

## Fallback and Degradation Plan
- What degrades first: nothing Stream-related. If Sentry is unreachable, `reportError` is a best-effort no-op and the original friendly error response is still returned to the user.
- User-visible messaging behavior: unchanged — the same friendly error messages as before.
- Kill switch / feature flag: governed by the existing `OBSERVABILITY_PROVIDER` setting; setting it away from `sentry` disables capture without code changes.

## Observability
- Metrics and alerts added/updated: caught 5xx/persistence failures across all API routes now reach Sentry, tagged with `area` (plugin slug) and `op` (snake_case operation), with non-sensitive context (userId and route ids only).
- Dashboard link (if available): existing Sentry web project.

## Validation
- Tests added for degraded mode: none required; no behavior change. Verified with web-package `tsc --noEmit`, `eslint` on all changed files, and `check-eof-format.sh`.
- Rollback strategy: revert the PR, or set `OBSERVABILITY_PROVIDER` away from `sentry`; either is config/code-only with no Stream impact.
