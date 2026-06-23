# Stream Quota Impact Note — mobile Direct Line chat mentions + search + link previews (Android parity)

## Summary

- Feature/Change: Brings the mobile shared chat (`ctf/packages/mobile/src/components/shared/StreamChatView.tsx`,
  used by chyme's `StreamChatPanel` and the Direct Line tabs: TrustTransport, SocketRelay, LightHouse,
  Foundation) up to the web chat's three additions for issue #734: (1) @mention autocomplete, (2)
  in-channel message search, and (3) link-preview cards. Mentions and link previews are SDK defaults
  in stream-chat-react-native 8.13.x (no extra calls): the MessageInput's built-in `@` trigger reads
  the watched channel's members and renders the suggestion popup within the existing OverlayProvider,
  and Stream's server-side URL enrichment produces `og_scrape` attachments that the default MessageList
  Attachment renderer draws as preview Cards. Search is a new, small sibling component
  (`StreamChatSearch.tsx`) that calls `channel.search(term)` scoped to the current channel only when a
  member runs a search.
- PR: mobile Stream chat mentions + search + link previews (branch only; no PR opened)
- Owner: farah
- Date: 2026-06-23

## Stream Surfaces Affected

- Chat / Activity Feeds / Video / AI Moderation: Chat only. The quota-impact gate fires because the
  changed file paths contain "stream" (`StreamChatView.tsx`, `StreamChatSearch.tsx`). Mentions and
  link-preview rendering are zero net new API calls (SDK presentation over messages and attachments
  the members already exchange). In-channel search adds on-demand `channel.search` calls, bounded by
  explicit member action — one query per search submit, not per render.

## Estimated Monthly Impact

- Chat MAU impact estimate: 0 — the same members already use these chats; no new active users.
- Activity Feed API calls estimate: 0 — no Activity Feeds usage.
- Video participant-minutes estimate: 0 — no video.
- AI Moderation credits estimate: 0 — no moderation calls added.
- Incremental Chat API calls: mentions and link previews add 0 net new calls (mention member
  suggestions reuse the already-watched channel's member state; link previews are server-side
  enrichment already performed when a member posts a URL, rendered client-side with no extra request).
  Search adds a small, user-initiated volume of `channel.search` calls. Rough bound: each Direct Line
  has a small set of active members; even if every member ran a handful of searches per day, that is
  on the order of low tens of search calls per channel per day — say under ~1,000 search calls per
  month across all four Direct Line chats at current participation. These are normal Chat search
  queries (capped at 25 results each, no paging), not background polling, and never fire on render.

## Budget Threshold Risk

- Expected threshold after rollout (Green/Yellow/Orange/Red): Green — no change to message volume or
  active-user counts; the only new traffic is a small, member-driven number of on-demand search
  queries that scale with manual interaction, not with the number of mounts or messages.
- Peak scenario estimate: A burst of members searching at once produces a brief spike of
  `channel.search` calls bounded by how fast people can type and submit; each is a single bounded
  query. This stays well within ordinary Chat usage.

## Fallback and Degradation Plan

- What degrades first: If a `channel.search` call fails, the search panel shows its "Search failed.
  Try again." state and the rest of the chat (list, composer, threads, reactions, mentions, link
  previews) keeps working. If the SDK cannot render the mention popup or a preview card, the message
  list and composer still function. The component keeps its loading / error / "Chat unavailable."
  states when Stream credentials are missing or the connection fails.
- User-visible messaging behavior: Unchanged for sending/receiving. Mentions, search, and link
  previews are additive; turning the search panel off (collapsed by default) removes all search
  traffic.
- Kill switch / feature flag: Not applicable. Search is collapsed by default and only queries when a
  member opens it and submits; reverting the component removes the search affordance entirely with no
  data impact.

## Observability

- Metrics and alerts added/updated: None.
- Dashboard link (if available): N/A.

## Validation

- Tests added for degraded mode: None required (client presentation + on-demand search). Mobile
  ESLint passes with 0 warnings on the touched files. The new search component handles empty,
  loading, no-results, and error states. The change is type-clean: `tsc` reports only a pre-existing
  tsconfig `baseUrl` / `ignoreDeprecations` deprecation unrelated to this change. This is
  device-verified UI; a human should confirm on a device that typing `@` opens the member suggestion
  popup, that opening "Search" and submitting a term lists matching messages with author + timestamp
  (and shows the no-results / error states), and that a posted URL renders a preview card in the list.
- Rollback strategy: Revert the component changes; no runtime or data impact either way.
