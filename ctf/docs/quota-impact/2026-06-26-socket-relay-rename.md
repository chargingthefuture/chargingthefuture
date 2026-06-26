# Stream Quota Impact Note — SocketRelay plugin rename (socketrelay → socket-relay)

## Summary

- Feature/Change: Pure rename of the `socketrelay` plugin to `socket-relay` (kebab-case slug/folder/route/command/contract names; snake_case `socket_relay_*` DB table names). No change to any Stream (GetStream) usage, channel model, token minting, or message/feed behavior.
- PR: socket-relay rename (this PR)
- Owner: chargingthefuture
- Date: 2026-06-26

This note exists only because the quota gate matches changed file paths containing "stream" — here that is the renamed files `SocketRelayStreamTab.tsx`, `fetchSocketRelayStreamCredentials.ts`, and `lib/socket-relay/stream.ts`. The rename touches their path and identifiers, not their Stream behavior.

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **None functionally.** SocketRelay's per-fulfillment Stream chat is unchanged — same channel type, same token path (`fetchSocketRelayStreamCredentials`), same membership and lifecycle. Only the surrounding file paths, the plugin slug, and the backing table names changed.

## Estimated Monthly Impact

- Chat MAU impact estimate: **0** — no new channels, members, or chat surfaces; existing usage is identical.
- Activity Feed API calls estimate: **0** — no feed surface added or altered.
- Video participant-minutes estimate: **0** — no video surface added or altered.
- AI Moderation credits estimate: **0** — no moderation surface added or altered.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green (unchanged)** — quota consumption is identical before and after the rename.
- Peak scenario estimate: Unchanged from current SocketRelay usage; the rename adds no load.

## Fallback and Degradation Plan

- What degrades first: Nothing new. The existing SocketRelay Stream-chat degradation behavior is unchanged (a Stream-unavailable error still surfaces the existing `*_STREAM_UNAVAILABLE` code).
- User-visible messaging behavior: Unchanged.
- Kill switch / feature flag: None added; none needed — no behavior change.

## Observability

- Metrics and alerts added/updated: None. The observability `area` tag emitted by the renamed code changes from `socketrelay` to `socket-relay`; no new metrics or alerts.
- Dashboard link (if available): n/a — no dashboard change.

## Validation

- Tests added for degraded mode: None required — no behavior change. Verified by web + mobile typecheck and lint, the EOF check, and the inventory-drift gate (every renamed table and route still documented).
- Rollback strategy: Revert the rename PR. Because it is a hard cutover with no aliases, a rollback must redeploy web + mobile together (same as the forward cutover); the `ALTER TABLE … RENAME` is reversible.
