# Stream Quota Impact Note — Stream credential check probe user id

## Summary

- Feature/Change: The manual "Check — Stream Credentials" diagnostic (`ctf/packages/web/scripts/check-stream-env.mjs`) now uses a fresh `randomUUID()` for its throwaway probe user id each run instead of a fixed id, so a previously hard-deleted id no longer blocks the check. This is a diagnostic-only script run on manual workflow dispatch; it is not part of any member-facing flow.
- PR: chargingthefuture/chargingthefuture#1750
- Owner: chargingthefuture
- Date: 2026-07-20

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **None of the product surfaces.** The script makes one lightweight authenticated `upsertUser` + best-effort `deleteUser` call per configured credential pair, purely to verify the key/secret authenticate. No chat channel, feed, video, or moderation surface is touched.

## Estimated Monthly Impact

- Chat MAU impact estimate: **None (net neutral).** The check still creates and deletes exactly one throwaway probe user per credential pair per run, identical to before — only the user id string changed. The workflow runs on manual dispatch, so there is no scheduled recurring load.
- Activity Feed API calls estimate: No change (surface not used).
- Video participant-minutes estimate: No change (surface not used).
- AI Moderation credits estimate: No change (surface not used).

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green** — unchanged. The check's Stream footprint is one upsert/delete per pair per manual run.
- Peak scenario estimate: No increase over prior behavior; the number of Stream calls per run is unchanged.

## Fallback and Degradation Plan

- What degrades first: Nothing member-facing — this is an operator diagnostic. If Stream is unreachable the script reports FAIL and exits non-zero, exactly as before.
- User-visible messaging behavior: None; there is no user-facing surface. The script prints PASS/FAIL to the workflow log and never prints the key or secret.
- Kill switch / feature flag: Not applicable — the workflow only runs when an operator dispatches it.

## Observability

- Metrics and alerts added/updated: None. The workflow's pass/fail is the signal; the CI-health check tracks it.
- Dashboard link (if available): Existing Stream usage dashboard; no new panel required.

## Validation

- Tests added for degraded mode: No automated tests (this is a manually-dispatched diagnostic). `node --check` passes on the script; the all-package typecheck and EOF gate pass. The fix removes the deleted-probe-user collision the workflow log showed.
- Rollback strategy: Revert the PR. The change is a one-line probe-id change in a diagnostic script with no product, schema, or contract surface, so a revert is immediate and safe.
