# Stream Quota Impact Note — TrustTransport plugin rename (trusttransport → trust-transport)

## Summary

- Feature/Change: Pure rename of the `trusttransport` plugin to `trust-transport` (kebab-case slug/folder/route/command/contract names; snake_case `trust_transport_*` DB table names). No change to any Stream (GetStream) usage, channel model, call type, token minting, or message/feed/video behavior.
- PR: #966
- Owner: chargingthefuture
- Date: 2026-06-26

This note exists only because the quota gate matches changed file paths containing "stream" — here that is the renamed files `TrustTransportStreamTab.tsx` and `fetchTrustTransportStreamCredentials.ts`. The rename touches their path and identifiers, not their Stream behavior.

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **None functionally.** TrustTransport's per-trip Stream chat is unchanged — same channel type, same token path (`fetchTrustTransportStreamCredentials`), same membership and lifecycle. Only the surrounding file paths, the plugin slug, and the backing table names changed.

## Estimated Monthly Impact

- Chat MAU impact estimate: **0** — no new channels, members, or chat surfaces; existing usage is identical.
- Activity Feed API calls estimate: **0** — no feed surface added or altered.
- Video participant-minutes estimate: **0** — no video surface added or altered.
- AI Moderation credits estimate: **0** — no moderation surface added or altered.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green (unchanged)** — quota consumption is identical before and after the rename.
- Peak scenario estimate: Unchanged from current TrustTransport usage; the rename adds no load.

## Fallback and Degradation Plan

- What degrades first: Nothing new. The existing TrustTransport Stream-chat degradation behavior is unchanged (a Stream-unavailable error still surfaces the existing `*_STREAM_UNAVAILABLE` code).
- User-visible messaging behavior: Unchanged.
- Kill switch / feature flag: None added; none needed — no behavior change.

## Observability

- Metrics and alerts added/updated: None. The observability `area` tag emitted by the renamed code changes from `trusttransport` to `trust-transport`; no new metrics or alerts.
- Dashboard link (if available): n/a — no dashboard change.

## Validation

- Tests added for degraded mode: None required — no behavior change. Verified by web + mobile typecheck and lint, the EOF check, and the inventory-drift gate (every renamed table and route still documented).
- Rollback strategy: Revert the rename PR. Because it is a hard cutover with no aliases, a rollback must redeploy web + mobile together (same as the forward cutover); the `ALTER TABLE … RENAME` is reversible.
