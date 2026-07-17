# Stream Quota Impact Note — Mobile SocketRelay Direct Line chat

## Summary

- Feature/Change: Add the requester <-> helper live chat to the mobile (Android) SocketRelay "Direct
  Lines" tab (issue #1596). The web already renders a real Stream chat for each fulfillment
  (`sr-chat.tsx` / `StreamChatPanel`); the mobile tab previously listed fulfillments with resolve
  buttons only. This change adds an "Open chat" affordance per Direct Line card that mints Stream
  credentials from the **existing** route `POST /api/socket-relay/fulfillments/:id/chat` and connects
  the shared mobile `StreamChatView` to the **same** per-fulfillment channel the web opens
  (`socket-relay-fulfillment-<id>`). No new channel type is created; the route and its
  channel-ensuring behavior are unchanged.
- PR: Mobile SocketRelay Direct Line chat (branch `feat/mobile-socket-relay-direct-line-chat`; no PR opened)
- Owner: charging-the-future
- Date: 2026-07-17

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: **Chat only.** Mobile reuses the same per-fulfillment
  Stream channel the web already opens — no new channel-creation pattern, just a second client
  (the mobile app) connecting to it. No Activity Feeds, Video, or AI Moderation usage.

## Estimated Monthly Impact

- Chat MAU impact estimate: bounded by SocketRelay members who open a Direct Line on Android. These are
  the same members already part of a fulfillment; a member counts toward Chat MAU when they connect to
  a channel, so the only incremental effect is a member who talks on Android instead of (or in addition
  to) web. No new channels are created, so no per-channel growth.
- Activity Feed API calls estimate: 0 — no Activity Feeds usage.
- Video participant-minutes estimate: 0 — no video.
- AI Moderation credits estimate: 0 — no moderation calls added.
- Incremental Chat API calls: one `connectUser` + one `channel.watch` per opened Direct Line on
  mobile, plus the normal send/receive volume for messages members choose to send. Message volume was
  always possible on these channels (the web surface already exists); this only gives Android members
  the surface to use it.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): **Green** — incremental consumption is
  bounded by active SocketRelay fulfillments, a small population, and no new channels are created.
- Peak scenario estimate: every member with an active Direct Line opens it on Android and exchanges
  messages. Bounded by the count of active fulfillments and by manual member interaction; it stays well
  within normal Chat metering.

## Fallback and Degradation Plan

- What degrades first: if the chat route or the Stream connection fails, the mobile Direct Line chat
  shows its error state ("Could not open this Direct Line chat.") and the rest of the Direct Lines tab
  (cards + resolve actions) keeps working. If Stream is unconfigured the route already returns 500/503
  and the client surfaces the error.
- User-visible messaging behavior: additive — the fulfillment list and resolve actions are unchanged;
  the chat is the new surface.
- Kill switch / feature flag: not applicable. Removing the "Open chat" button reverts the surface with
  no data impact; the channels this connects to already exist and are unchanged.

## Observability

- Metrics and alerts added/updated: none new. The route already calls the existing `reportError` path
  (`area: 'socket-relay', op: 'fulfillments_id_chat'`), so failures surface in the existing reporting.
- Dashboard link (if available): existing Stream usage dashboard (no change).

## Validation

- Tests added for degraded mode: covered by the existing null-credentials/error path (the route returns
  an error and the mobile client throws a handled error rendered as the chat error state). Mobile
  typecheck, ESLint (max-warnings 0), and EOF formatting pass on the touched files.
- Rollback strategy: revert the mobile UI wiring and the api client method; no schema or data impact
  either way — the channels this surfaces already exist.
