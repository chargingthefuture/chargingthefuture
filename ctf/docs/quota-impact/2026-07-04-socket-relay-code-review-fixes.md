# Stream Quota Impact Note — socket-relay code-review fixes

## Summary

- Feature/Change: A batch of small code-review fixes for the `socket-relay` plugin. The only
  Stream-adjacent part is the **removal** of two unreferenced mobile files —
  `SocketRelayStreamTab.tsx` and `fetchSocketRelayStreamCredentials.ts` — that were dead code (nothing
  imported them; the live Direct Line is `SocketRelayDirectLines`). The rest of the change is a
  403-vs-404 fix, an audit event + command contract for a ServiceCredits transfer, an admin
  delete-confirm dialog, an audit-evidence enrichment, and a mobile expired-post fallback — none of
  which touch Stream.
- PR: resolve socket-relay code-review findings
- Owner: farah
- Date: 2026-07-04

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat/Video — the deleted files referenced the mobile
  Stream chat/video panels but were never rendered (no importer), so removing them changes no live
  Stream usage. The gate fires only because the deleted file paths contain "Stream". No channel,
  connection, watch, token, or call pattern changes.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 (dead-code removal)
- Activity Feed API calls estimate: 0
- Video participant-minutes estimate: 0 (the removed panel was never mounted)
- AI Moderation credits estimate: 0

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — consumption can only stay the
  same or drop, never rise. The removed code was unreachable.
- Peak scenario estimate: No change; the live Direct Line (`SocketRelayDirectLines`) is unchanged.

## Fallback and Degradation Plan

- What degrades first: Nothing — the removed files had no live callers.
- User-visible messaging behavior: Unchanged. The Direct Line chat continues to work through
  `SocketRelayDirectLines` and the shared chat panel.
- Kill switch / feature flag: Not applicable.

## Observability

- Metrics and alerts added/updated: None. (The ServiceCredits transfer now emits a plugin audit row,
  but that is the ServiceCredits ledger, not a Stream surface.)
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required. Web + mobile typecheck, lint, EOF, inventory-drift,
  and test-script-drift all pass.
- Rollback strategy: Revert the change; no runtime or quota impact either way.
