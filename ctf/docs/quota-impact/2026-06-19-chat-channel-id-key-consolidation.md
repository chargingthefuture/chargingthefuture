# Stream Quota Impact Note

## Summary

- Feature/Change: Consolidate the chat channel id on one response key (`streamChannelId`) across
  SocketRelay, LightHouse, and TrustTransport chat routes and their web/mobile clients. The routes
  previously returned the channel id under `channelId` while every web client read `streamChannelId`,
  so the web chat tabs fell back to the bare row id (a fulfillment/match/trip UUID), which is not a
  Stream channel — `watch()` failed and the panel showed "Failed to connect to chat." Now the routes
  return only `streamChannelId` and all clients read that one key.
- PR: fix/stream-chat-channel-id-key
- Owner: platform
- Date: 2026-06-19

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only (plugin-paired "Direct Line" threads for
  SocketRelay, LightHouse, TrustTransport). No Activity Feeds, Video, or AI Moderation changes.

## Estimated Monthly Impact

- Chat MAU impact estimate: None on its own. This is a bug fix to a key name in an existing response;
  it does not create users or channels beyond what the already-shipped flows create. The only behavior
  change is that the web chat tabs now connect to the channel they were always meant to connect to
  (it was failing before), so there is no new channel creation — the channels were already created
  server-side; only the client connection was broken.
- Activity Feed API calls estimate: 0 (no feed changes).
- Video participant-minutes estimate: 0 (no video).
- AI Moderation credits estimate: 0 (no moderation changes).

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green. No new Stream object creation;
  the fix lets existing channels be watched instead of erroring.
- Peak scenario estimate: Bounded by existing fulfillment/match/trip volume, which is unchanged by
  this PR.

## Fallback and Degradation Plan

- What degrades first: If `streamChannelId` is ever absent from the response (e.g. Stream
  credentials unconfigured server-side, so `ensureChannel` returns null), the web clients now render
  nothing for the chat body and the surrounding loading/error states still apply — they no longer
  attempt to watch an invalid bare-id channel and surface a misleading "Failed to connect to chat."
- User-visible messaging behavior: When the channel id is present (normal case) chat connects; when
  Stream is unconfigured the route returns the existing "Unable to create chat channel" error path.
- Kill switch / feature flag: Stream remains gated by the presence of server-side Stream credentials
  (`resolveStreamCredentials` returns null when unset); unchanged by this PR.

## Observability

- Metrics and alerts added/updated: None added. Existing `reportError` calls on the chat routes
  (areas `socket-relay`, `lighthouse`, `trusttransport`) are unchanged.
- Dashboard link (if available): n/a.

## Validation

- Tests added for degraded mode: Manual — the web clients now only mount `StreamChatPanel` when both
  `streamApiKey` and `streamChannelId` are present, so a missing channel id no longer reaches
  `watch()`. Typecheck and lint pass.
- Rollback strategy: Revert the PR; the prior `channelId`-only responses are restored. No data or
  schema changes are involved.
