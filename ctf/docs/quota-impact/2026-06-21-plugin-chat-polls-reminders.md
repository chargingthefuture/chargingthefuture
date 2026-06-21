# Stream Quota Impact Note — plugin chat polls and message reminders

## Summary

- Feature/Change: Turns on two Stream Chat capabilities in the shared plugin-chat panel
  (`StreamChatPanel`, used by the Direct Line chats: TrustTransport, SocketRelay, LightHouse,
  Foundation). The change is presentation/feature-enable only in one client component plus a small CSS
  addition. The two features:
  - Polls (create + vote): in stream-chat-react 12.16 this is entirely the library default once the
    channel type permits polls (the owner enabled polls on the `messaging` channel type). The
    composer's attachment menu shows a "Create poll" entry when the member holds the send-poll
    capability, and the message list renders Stream's default poll card with live voting. The panel
    only confirms the defaults run and adds CSS to tint the poll card to the plugin accent. No new
    message volume beyond the poll message and vote events members create by hand.
  - Message reminders ("Remind me about this"): the installed stream-chat 8.60 does not yet ship
    Stream's server-backed per-message reminder API (that arrived in stream-chat 9.x /
    stream-chat-react 13.x). Until that upgrade, the panel surfaces the same member-facing capability
    locally: a message-action menu entry that schedules an in-browser nudge (a desktop notification
    when the member has granted permission, otherwise an in-panel toast). It is gated on the channel's
    `reminders` config flag. This local reminder makes no Stream API calls at all.
- PR: plugin chat polls and message reminders (branch only; no PR opened)
- Owner: farah
- Date: 2026-06-21

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only — presentation and feature-enable. The
  gate fires because the changed file paths contain "stream". The reminder action is implemented
  client-side and calls no Stream endpoint; polls reuse Stream's existing poll feature on the already
  enabled `messaging` channel type.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 — the same members already use these chats; no new active users.
- Activity Feed API calls estimate: 0 — no Activity Feeds usage.
- Video participant-minutes estimate: 0 — no video.
- AI Moderation credits estimate: 0 — no moderation calls added.
- Incremental Chat API calls: near-zero. Polls add a poll message plus a small number of vote events,
  each created by a member by hand and metered as part of normal Chat usage. The reminder action makes
  no Stream calls — it schedules a browser-local timer only.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — near-zero incremental
  consumption; no change to active-user counts. The only new message volume is the occasional poll and
  its votes, which members create deliberately.
- Peak scenario estimate: A channel running several polls adds a handful of poll messages and vote
  events; this is bounded by manual interaction and is negligible against normal message traffic. The
  reminder feature contributes nothing to Stream traffic.

## Fallback and Degradation Plan

- What degrades first: On a channel that does not permit polls, the "Create poll" entry simply does
  not appear (Stream's own gate). On a channel that does not permit reminders, the "Remind me about
  this" action is absent. Neither path crashes; the rest of the chat keeps working.
- User-visible messaging behavior: Unchanged for sending/receiving; both features are additive.
- Kill switch / feature flag: Not applicable. Polls follow the channel-type toggle; turning polls off
  on the channel type removes the affordance. Removing the reminder action reverts that feature
  independently; the panel still renders when Stream env is absent (it shows "Chat unavailable.").

## Observability

- Metrics and alerts added/updated: None.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required (client presentation only). Typecheck, ESLint, and EOF
  formatting pass on the touched files; the panel still degrades to its loading/error/unavailable
  states when Stream env is missing, and both new features are absent (not broken) when the channel
  does not permit them.
- Rollback strategy: Revert the panel and CSS change; no runtime or data impact either way.
