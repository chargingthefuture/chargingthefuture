# Stream Quota Impact Note — branded chat empty state + Direct Line pending rows

## Summary

- Feature/Change: Two presentation-only changes. (1) The shared `StreamChatPanel` replaces Stream's
  built-in "No chats here yet…" message-list empty state with an on-brand card via a custom
  `EmptyStateIndicator` — a local React component, no Stream call. (2) SocketRelay's Direct Line list
  now also shows the member's own still-open requests as pending placeholders and hides canceled/closed
  lines; a pending row is not chattable and never opens a Stream channel. No message volume, channel
  count, watch, connection, or API call pattern changes.
- PR: show pending requests in Direct Line and hide canceled/closed lines (#1289)
- Owner: farah
- Date: 2026-07-01

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat — presentation only. The gate fires because the
  changed file path `stream-chat-panel.tsx` contains "stream"; no Stream usage, capability, channel, or
  call pattern changes. A chat channel is still opened only for an active fulfillment, exactly as before.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 (empty-state component swap + list composition only)
- Activity Feed API calls estimate: 0
- Video participant-minutes estimate: 0
- AI Moderation credits estimate: 0

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — no change to consumption.
- Peak scenario estimate: No change. Pending rows are built from existing REST responses
  (`my-requests` + `my-fulfillments`) and never connect to Stream; the empty-state card is a static
  component with no runtime cost.

## Fallback and Degradation Plan

- What degrades first: Nothing — there is no new runtime path. If the custom `EmptyStateIndicator`
  failed to render it would simply show blank space; the conversation itself is unaffected.
- User-visible messaging behavior: Unchanged. Chat opens for active fulfillments as before; pending
  rows only display "waiting for a helper" text.
- Kill switch / feature flag: Not applicable (presentation only).

## Observability

- Metrics and alerts added/updated: None.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required (presentation only); web + mobile typecheck, lint, EOF,
  and web/android parity pass.
- Rollback strategy: Revert the change; no runtime or quota impact either way.
