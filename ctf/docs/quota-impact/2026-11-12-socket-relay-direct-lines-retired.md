# Stream Quota Impact Note: SocketRelay Direct Lines retired

## Summary

- Feature/Change: SocketRelay's helper conversations move from a Stream channel per fulfillment
  (`socket-relay-fulfillment-<id>`) into the request card's Just us two, stored in Postgres
  (`commons_item_messages`). Earlier Stream messages stay readable, read-only.
- PR: feat/direct-lines-and-weavers-limits
- Owner: System Architect
- Date: 2026-11-12

## Stream Surfaces Affected

- Chat: no new channel is created on a claim. Opening "Earlier messages" on a fulfillment that had
  a Direct Line queries its channel, freezes it once, and mints a member token. Video, Activity
  Feeds and AI Moderation: none.

## Estimated Monthly Impact

- Chat MAU impact estimate: lower. Members reach SocketRelay chat on Stream only when they open
  earlier messages.
- Activity Feed API calls estimate: none.
- Video participant-minutes estimate: none.
- AI Moderation credits estimate: none.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green.
- Peak scenario estimate: one channel query, one freeze and one token per member opening a past
  conversation.

## Fallback and Degradation Plan

- What degrades first: earlier messages. With Stream unavailable the route answers 503 or 500 with
  the reason, and the card conversation keeps working because it does not use Stream.
- User-visible messaging behavior: the reason shows in place of the Earlier messages button.
- Kill switch / feature flag: none needed.

## Observability

- Metrics and alerts added/updated: failures report as `socket-relay` / `fulfillments_id_history`.
- Dashboard link (if available): none.

## Validation

- Tests added for degraded mode: none; the route returns 404 when a channel is missing.
- Rollback strategy: revert the PR; the Stream channels are untouched apart from being frozen.
