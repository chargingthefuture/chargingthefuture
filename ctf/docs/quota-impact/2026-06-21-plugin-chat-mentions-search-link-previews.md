# Stream Quota Impact Note — plugin chat @mentions, message search, link previews

## Summary

- Feature/Change: Turns on three already-permitted Stream Chat features in the shared plugin-chat
  panel (`StreamChatPanel`, used by the Direct Line chats: TrustTransport, SocketRelay, LightHouse,
  Foundation). The change is presentation/feature-enable only in one client component plus a small CSS
  addition. The three features:
  - @mention autocomplete in the composer and mention highlighting in messages (Stream's default once
    the channel's member list is loaded; the panel now watches with presence so members are present).
  - In-channel message search: a compact search strip that calls `channel.search(query, options)`,
    which the Stream SDK scopes to this one channel, and lets a member jump to a result. This is a
    read-only query, made only when a member types a term and presses search.
  - Link preview cards for pasted links: URL enrichment is turned on in the composer
    (`enrichURLForPreview`), and the resulting og-scrape attachment renders through Stream's default
    Attachment card in the message list. No new message volume.
- PR: plugin chat @mentions, message search, link previews (branch only; no PR opened)
- Owner: farah
- Date: 2026-06-21

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only — presentation and feature-enable. The
  gate fires because the changed file paths contain "stream". No new channels, no new message volume,
  no new toggles in the dashboard; all three capabilities are already permitted on the `messaging`
  channel type.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 — the same members already use these chats; no new active users.
- Activity Feed API calls estimate: 0 — no Activity Feeds usage.
- Video participant-minutes estimate: 0 — no video.
- AI Moderation credits estimate: 0 — no moderation calls added.
- Incremental Chat API calls: near-zero. The only added call pattern is `channel.search`, made on
  demand when a member runs a search; URL enrichment is a scrape Stream already performs server-side
  for links and is metered as part of normal Chat usage, not a separate add-on.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — near-zero incremental
  consumption; no change to message volume or active-user counts.
- Peak scenario estimate: A member repeatedly running searches issues a handful of extra read queries;
  this is bounded by manual interaction and is negligible against normal message traffic.

## Fallback and Degradation Plan

- What degrades first: If a search request fails, the panel shows "No messages found" and the rest of
  the chat keeps working. If URL enrichment is unavailable, links simply send as plain text. Mentions
  fall back to plain text if members are not loaded.
- User-visible messaging behavior: Unchanged for sending/receiving; the three features are additive.
- Kill switch / feature flag: Not applicable. Removing `enrichURLForPreview` or the search strip
  reverts each feature independently; the panel still renders when Stream env is absent (it shows
  "Chat unavailable.").

## Observability

- Metrics and alerts added/updated: None.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required (client presentation only). Typecheck, ESLint, and EOF
  formatting pass on the touched files; the panel still degrades to its loading/error/unavailable
  states when Stream env is missing.
- Rollback strategy: Revert the panel and CSS change; no runtime or data impact either way.
