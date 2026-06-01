# App-wide error reporting rollout (2026-06-01)

This note records a cross-cutting change for the schema-drift / versioning gate. It is not a schema
change.

## What changed

Added `reportError(error, { area, op })` (a thin `Sentry.captureException` wrapper at
`ctf/packages/web/lib/observability/report.ts`) to the unexpected-failure (5xx) catch blocks across
the web app's API routes, so caught server errors reach Sentry tagged by area/op instead of being
swallowed behind a generic response.

## Why it touches the gate

No database schema, contract, seed, or command/policy definition changed. The schema-drift gate's
path heuristic flags this PR only because some route paths contain the substrings `audit` (e.g.
`.../admin/audit-events/route.ts`) and `command`, which the gate treats as possible contract changes.
This note is the required versioning evidence; there is no contract or schema drift.

## Scope and safety

- No behavior change: every route keeps its existing response, status code, and audit logging.
- Expected client errors (validation, JSON parse, auth, rate limit, not-found) are intentionally not
  reported.
- Rollback: revert the PR; routes return to their prior catch behavior.
