# Stream Quota Impact Note — StreamChatPanel connection ref-count

## Summary

- Feature/Change: Ref-count the shared Stream Chat client connection in `StreamChatPanel` (code-review fix #1414). `StreamChat.getInstance(apiKey)` returns one shared client per API key; previously each panel called `connectUser` on mount and `disconnectUser` on unmount, so with two panels on screen the first to unmount dropped the shared connection for the others, and a quick re-mount could `connectUser` twice. Now the connection is acquired/released with a reference count: connect once for the first panel, disconnect only when the last panel unmounts, and skip `connectUser` when the client is already connected as that user.
- PR: #1421
- Owner: farahbrunache
- Date: 2026-07-10

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat only.** Client-side WebSocket connection lifecycle (`connectUser` / `disconnectUser`) for the shared chat client. No Activity Feed, Video, or AI Moderation surface is touched. No new channel, watch, message, or credential-minting call is added.

## Estimated Monthly Impact

- Chat MAU impact estimate: **None (neutral to slightly negative — fewer connections).** No new members and no new channels are reached. The change only affects how many times an already-signed-in member's single shared client connects: it removes redundant `connectUser` calls (StrictMode double-invoke, token refresh, and a second concurrent panel), so the number of connection handshakes goes down, not up. Concurrent connection count per member is now at most one shared client per API key instead of one-per-panel racing to connect/disconnect.
- Activity Feed API calls estimate: 0 (surface not used here).
- Video participant-minutes estimate: 0 (surface not used here).
- AI Moderation credits estimate: 0 (surface not used here).

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green.** The change reduces or holds connection volume; it cannot increase MAU, channels watched, or messages sent.
- Peak scenario estimate: With N `StreamChatPanel`s mounted at once for the same member, connection handshakes drop from up to N (plus StrictMode/token-refresh churn) to 1. Peak is strictly lower than before.

## Fallback and Degradation Plan

- What degrades first: If the shared connection fails to open, the affected panel(s) show the existing "Failed to connect to chat." state (unchanged). Watch/connect errors are caught per panel.
- User-visible messaging behavior: Unchanged — same loading / error / unavailable states as before.
- Kill switch / feature flag: None added or changed. When Stream is unconfigured, the upstream credential path already returns unconfigured and the panels are not rendered; this change does not alter that.

## Observability

- Metrics and alerts added/updated: None added. Connection counts are visible in the GetStream dashboard as before; this change can only lower them.
- Dashboard link (if available): GetStream app dashboard (existing).

## Validation

- Tests added for degraded mode: No automated test added (the connection lifecycle needs the live Stream client). Verified by `pnpm --filter @ctf/web lint` / `typecheck` / `build`. The ref-count worst case is a connection kept alive slightly too long (benign until page unload), never one dropped while a panel is still using it.
- Rollback strategy: Revert PR #1421. No schema, contract, or data change; nothing to migrate.
