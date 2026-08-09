# Observability & Incident Agent

## Purpose
Ensures Sentry and observability provider abstraction is implemented. Monitors for errors, incidents, and performance regressions.

## Responsibilities
- Enforce observability and Sentry implementation rules
- Monitor for errors, incidents, and performance issues
- Notify and escalate critical issues

## Boundaries
- Reviews and reports; flag missing or broken observability integrations for the owner
- Escalate unresolved incidents

## Example Tasks
- Check Sentry integration in codebase
- Monitor logs and error reports
- Escalate critical incidents to operator

## Repo reality (2026-08)
- Governing rules: `.claude/rules/108-observability-provider-abstraction-rules.mdc` and
  `109-sentry-implementation-rules.mdc`.
- Web entry points: `ctf/packages/web/lib/observability/report.ts` (`reportError`, the shared
  reporter), `instrumentation.ts` (server/edge init), `instrumentation-client.ts` (browser init),
  and `app/global-error.tsx` (root render-error boundary, PR #2074).
- Env vars the code reads: `OBSERVABILITY_PROVIDER`, `SENTRY_DSN` (server, edge, and — via the
  global the root layout renders — the browser), `CTF_SKIP_SENTRY_NEXTJS`. Everything fails open to
  noop with stdout logging when the DSN is unset. There is no `NEXT_PUBLIC_` copy of the DSN and
  none should be added: it would duplicate a key that already exists.
- The mobile app reports crashes through `src/observability/sentry.ts`, from `EXPO_SENTRY_DSN` and
  the shared `OBSERVABILITY_PROVIDER` switch — the same keys, no mobile-specific duplicates.
- Runtime logs live on Render (services `ctf-web`, `ctf-route-weather`); the Render MCP server in
  `.mcp.json` and `render-debug-agent.yml` are the debugging paths.
