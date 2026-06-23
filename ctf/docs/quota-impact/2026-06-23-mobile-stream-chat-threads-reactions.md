# Stream Quota Impact Note — mobile Direct Line chat threads + reactions (Android parity)

## Summary

- Feature/Change: Brings the mobile shared chat (`ctf/packages/mobile/src/components/shared/StreamChatView.tsx`,
  used by chyme's `StreamChatPanel` and the Direct Line tabs: TrustTransport, SocketRelay, LightHouse,
  Foundation) up to the web's richer Stream layout. The bare message list + input is wrapped in
  `OverlayProvider` and gains threaded replies (`thread`/`threadList` on `<Channel>`, `<MessageList
  onThreadSelect>`, `<Thread />`) plus the SDK's default reactions, typing indicator, and read state.
  This is presentation / SDK-layout only in one React Native client component — no new Stream API
  calls, no new channels, no new dashboard toggles. All used capabilities are already permitted on the
  `messaging` channel type.
- PR: mobile Stream chat threads + reactions (branch only; no PR opened)
- Owner: farah
- Date: 2026-06-23

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only — presentation and SDK layout. The
  quota-impact gate fires because the changed file path contains "stream". No new message volume, no
  new channels, no new active users; threads and reactions are existing message operations the same
  members already perform on web.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 — the same members already use these chats; no new active users.
- Activity Feed API calls estimate: 0 — no Activity Feeds usage.
- Video participant-minutes estimate: 0 — no video.
- AI Moderation credits estimate: 0 — no moderation calls added.
- Incremental Chat API calls: near-zero. Reactions and thread replies are normal message operations
  already metered as part of ordinary Chat usage; this change only exposes the UI to perform them on
  Android. No new background polling, no new channel watches beyond the existing `channel.watch()`.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — no change to message volume or
  active-user counts; only the client layout changes.
- Peak scenario estimate: Members reacting to and replying-in-thread more often produces a small,
  member-driven increase in message/reaction events that is already within normal Chat usage and is
  bounded by manual interaction.

## Fallback and Degradation Plan

- What degrades first: If the SDK cannot load the thread or reaction overlay, the main message list
  and composer keep working. The component still shows its loading / error / "Chat unavailable."
  states when Stream credentials are missing or the connection fails.
- User-visible messaging behavior: Unchanged for sending/receiving; threads and reactions are
  additive layout features.
- Kill switch / feature flag: Not applicable. Reverting the component restores the prior minimal
  layout with no runtime or data impact.

## Observability

- Metrics and alerts added/updated: None.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required (client presentation only). Mobile typecheck and
  ESLint (0 warnings) pass on the touched file. The component keeps its loading / error /
  "Chat unavailable." fallbacks. This is device-verified UI; a human should confirm on a device that
  long-press shows the reaction picker, "reply in thread" opens `<Thread />`, "Back" returns to the
  main list, and that other people's bubbles render in the plugin accent while the member's own stay
  gray.
- Rollback strategy: Revert the component change; no runtime or data impact either way.
