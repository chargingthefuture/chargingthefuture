# Stream Quota Impact Note — Stream credential validator script

## Summary

- Feature/Change: New operator diagnostic `ctf/packages/web/scripts/check-stream-env.mjs` (npm script `check:stream-env`). It validates that the Stream (GetStream) API key/secret pairs — the production pair and the demo/staging pair — actually authenticate, by making one lightweight authenticated server call per pair (`upsertUser` on a throwaway probe user, best-effort hard-deleted afterward). It never prints the key or secret. Run manually via Infisical; it is NOT in the request path and NOT wired into CI.
- PR: chargingthefuture/chargingthefuture#TBD
- Owner: chargingthefuture
- Date: 2026-07-16

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat (auth only).** The script uses the server-side chat client to make an `upsertUser` (and a best-effort `deleteUser`) purely to confirm the credentials authenticate. No channel, message, feed, video, or moderation surface is exercised.

## Estimated Monthly Impact

- Chat MAU impact estimate: **Negligible.** One throwaway probe user is upserted and then hard-deleted per manual run of the script. It is run by an operator on demand (typically when debugging a demo/staging Stream failure), not on any schedule, per request, or in CI. Expected runs per month: a handful.
- Activity Feed API calls estimate: None.
- Video participant-minutes estimate: None.
- AI Moderation credits estimate: None.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green** — unchanged. A manual diagnostic with a single upsert/delete per run does not move any budget threshold.
- Peak scenario estimate: Even run repeatedly during a debugging session, the load is a few upsert/delete calls — far below any monitored threshold.

## Fallback and Degradation Plan

- What degrades first: Nothing in the product. This is a standalone script; it does not change any user-facing Stream behavior.
- User-visible messaging behavior: None — the script only prints PASS/FAIL to the operator's terminal.
- Kill switch / feature flag: Not applicable. If a credential pair is unset the script reports it as a warning and exits 0; if a pair is set but Stream rejects it, the script exits non-zero.

## Observability

- Metrics and alerts added/updated: None. The script's whole purpose is observability — it surfaces whether the configured Stream credentials authenticate, complementing the runtime `reportError` logging added for the Foundation quote path.
- Dashboard link (if available): Existing Stream usage dashboard; no new panel.

## Validation

- Tests added for degraded mode: Ran the script with dummy credentials to confirm it constructs the client, makes the authenticated call, catches the rejection, reports FAIL without leaking the secret, and exits non-zero; and with an unset pair to confirm it reports "not set" and does not fail. ESLint passes.
- Rollback strategy: Delete the script and its `check:stream-env` package entry. It is standalone tooling with no product dependency, so removal has no runtime effect.
