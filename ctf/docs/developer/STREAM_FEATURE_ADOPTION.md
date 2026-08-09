# Stream Feature Adoption — Tracking

This document tracks the work to use more of the GetStream feature set across the app's chat
surfaces. The owner's direction (2026-06-21): the product is underutilizing Stream; the Commons in
particular is the first thing people see and should feel inviting and high production value. Unless a
feature is marked excluded below, build it.

This is a living tracker. Update the status column as work ships, and link the PR.

## Two architecture decisions (owner-approved, 2026-06-21)

1. **Commons keeps its custom design; add Stream features into it.** The Commons (the home/community
   chat) is a hand-built surface — it renders our own cards and reads from our own
   `/api/commons/messages`, mirroring to Stream server-side. We do **not** replace it with Stream's stock
   chat UI. Instead we add a live Stream client connection underneath the existing design and surface
   each feature within our own components. This preserves the approved Commons look (design guardrail)
   while gaining the real-time features.
2. **Plugin chats adopt Stream's richer UI.** The per-plugin chats (TrustTransport, SocketRelay,
   LightHouse, Foundation, Chyme) already run Stream's React components but only render a bare message
   list + input (`components/shared/stream-chat-panel.tsx`). These get the fuller Stream UI (thread
   view, reactions, typing, presence, search, etc.) since they have no bespoke design to protect.

## Channel types in Stream (only `messaging` is used)

Stream's "Channel Types" page lists five built-in types (`commerce`, `gaming`, `livestream`,
`messaging`, `team`). A channel type is a template of default capabilities that every channel of that
type inherits. **This product creates every chat channel as type `messaging`** — confirmed in code
(every `.channel(...)` call passes `'messaging'`). The other four types are Stream's starter
templates; the app never creates channels in them, so toggling their capabilities has no effect here.

Two consequences for this plan:

- **The toggles that matter are on `messaging`.** Enabling a capability there only *permits* it; the
  feature still appears only once we build the UI (that UI is the work below). So turning everything on
  for `messaging` is correct groundwork, not the feature itself.
- **Enforce exclusions at the channel type where it's cheap.** We excluded uploads (#13/#14), so
  turning **Uploads off** on `messaging` enforces "no uploads" at the source rather than relying on us
  not building the UI.
- **Voice is PeerProgramming only (#12).** The clean way to scope voice to PP without enabling it
  app-wide is a **dedicated `peer-programming` channel type** with audio/uploads enabled, used only by
  PP channels, while the shared `messaging` type stays without it. The PP voice task uses this.

### Why PeerProgramming uses `messaging`-style text and a `default` video call, not `livestream`

"Livestream" exists in two Stream products and PP wants neither:

- **Chat → `livestream` channel type** is a *text* type for one-to-many broadcast chat (Twitch-style:
  a few post, a large anonymous audience watches). PP's text isn't even a Stream channel today — it
  lives in our own `peer_programming_messages` table with custom UI. If it ever moved onto Stream Chat,
  the right type would be `messaging` (a small, two-way cohort with typing, read receipts, threads),
  not `livestream`.
- **Video → `livestream` call type** is a *video* broadcast (a host publishes; others only watch). PP
  video uses call type `'default'` (`pp-session-call.tsx`), a meeting where every member is a two-way
  participant — correct for a ≤12-person cohort talking as equals.

The one trigger that would justify `livestream`: if we later let listen-in non-members **watch the
live cohort video** (members on camera, listeners watching only). That audience-watching pattern is
what the `livestream` video call type is for, and we'd switch PP's call type for that case. The text
listen-in shipped in PR #692 needs no type change — it is read-only text gated in our own code.

## Commons topic filtering (one feed + topic filter)

Owner decision (2026-06-21): members should be able to filter the Commons by topic ("all housing
discussions", "all health discussions", etc.). We do this as **one unified feed with a topic filter**,
not as separate topic rooms:

- Commons posts are stored in our own `feed_community_posts` table, which already has a `category`
  column (defaults to `'general'`). Topic is therefore already a field we own.
- Build: let an author pick a topic when posting (extend `category` with a small fixed topic set), and
  add topic chips/tabs at the top of Commons (All · Housing · Health · …) that filter via our API/DB.
- Stream's Query Channels API is **not** used for this — it filters channels, not messages within a
  channel, and Commons is one feed backed by our database. Query Channels is instead the right tool for
  the cross-chat unread inbox / nav badges (#23): listing every channel a member belongs to with unread
  counts.

## Surfaces in scope

| Surface | How it uses Stream today | Approach |
|---|---|---|
| Commons (home/community chat) | Custom UI over `/api/commons/messages`; mirrors to Stream server-side | (1) add features into custom design |
| PeerProgramming text room | Custom UI over `/api/peer-programming/messages` | (1) add features into custom design; **plus** voice (see #12) |
| PeerProgramming session | Stream **Video** (live calls) | already live; audit for gaps |
| TrustTransport chat | `StreamChatPanel` (list + input only) | (2) richer Stream UI |
| SocketRelay chat | `StreamChatPanel` | (2) richer Stream UI |
| LightHouse chat | `StreamChatPanel` | (2) richer Stream UI |
| Foundation chat | `StreamChatPanel` | (2) richer Stream UI |
| Chyme chat | `StreamChatPanel` | (2) richer Stream UI |

## Feature decisions

Legend — **Build**: in scope, not yet shipped · **Done**: shipped · **Excluded**: owner excluded ·
**Admin-only** / **PP-only**: in scope but limited to that audience/surface.

| # | Feature | Decision | Notes |
|---|---|---|---|
| 1 | Emoji reactions on messages | **Done (plugin chats: web + Android)** / Build (Commons) | The headline "inviting" feature. Plugin chats: web shipped in the shared `stream-chat-panel.tsx`; mobile (Android) parity shipped in the shared `StreamChatView.tsx` (#699) — long-press reaction picker is the SDK default once `OverlayProvider` wraps the channel. Commons (custom UI) shipped emoji reactions separately. |
| 2 | Threaded replies (thread panel) | **Done (plugin chats: web + Android)** / Build (Commons) | Plugin chats: web shipped `Window` + `Thread` in `stream-chat-panel.tsx`; mobile (Android) parity shipped in `StreamChatView.tsx` (#699) — `thread`/`threadList` on `<Channel>` + `<MessageList onThreadSelect>` + `<Thread />`. Commons thread view still to do. |
| 3 | Quoted reply (inline "replying to…") | **Done (Commons)** / Build (plugin chats) | Commons shipped in PR #695. Plugin chats still to do. |
| 4 | @mentions with autocomplete + highlight | Done (plugin chats) / Build (Commons) | Plugin chats shipped in the shared StreamChatPanel: typing `@` suggests channel members and mentions render highlighted, the Stream default once the channel is watched with its member list. Commons (custom UI) is a separate follow-up. |
| 5 | Edit your own message | Build | All surfaces. |
| 6 | Delete your own message | Build | All surfaces. |
| 7 | Pin a message | **Admin-only** | Only admins may pin/unpin; everyone sees the pinned bar. |
| 8 | Copy message text | Build | All surfaces. |
| 9 | Message search (in-channel) | Done (plugin chats) / Build (Commons) | Plugin chats shipped in the shared StreamChatPanel: a compact search strip at the top of the conversation calls `channel.search`, which scopes to the open channel, and lets a member jump to a result. Commons (custom UI) is a separate follow-up. |
| 10 | Slash commands | Deferred | The only configured command is `giphy`, which is excluded (#16). No active command to surface; revisit if we add non-giphy commands. |
| 11 | Emoji picker in the composer | Build | All surfaces. |
| 12 | Voice / audio messages | **PP-only** | Excluded everywhere except PeerProgramming. PP is a scoped async+sync environment that is easier to moderate, so voice is allowed there only. |
| 13 | Image upload + inline preview | **Excluded** | — |
| 14 | File upload (docs/PDFs) | **Excluded** | — |
| 15 | Link preview cards (URL enrichment) | Done (plugin chats) / Build (Commons) | Plugin chats shipped in the shared StreamChatPanel: URL enrichment is on in the composer (`enrichURLForPreview`) and the og-scrape attachment renders through Stream's default Attachment card in the message list. Commons (custom UI) is a separate follow-up. |
| 16 | Giphy picker | **Excluded** | Remove/skip the `giphy` command surface. |
| 17 | Typing indicators | Build | All surfaces. |
| 18 | Read receipts (who's seen it) | Build | All surfaces. |
| 19 | Delivery status (sent/delivered) | Build | All surfaces. |
| 20 | Online / offline presence dots | Build | All surfaces. |
| 21 | Channel member list / "who's here" | Build | All surfaces. |
| 22 | Unread divider ("where you left off") | **Done (Commons)** / Build (plugin chats) | Commons shipped in PR #695. |
| 23 | Unread count badges on the app nav | Build | Uses the last-seen endpoint from PR #695. |
| 24 | Polls (create + vote) | **Done (plugin chats)** / Build (Commons) | Plugin chats shipped — polls are the stream-chat-react 12.16 default once the channel type permits them (owner enabled the toggle); the panel confirms the defaults and tints the poll card to the plugin accent. The Commons custom-design version is a separate follow-up. |
| 25 | Message reminders / "remind me" | **Done (plugin chats)** / Build (Commons) | Plugin chats shipped — a "Remind me about this" message action. stream-chat 8.60 has no per-message reminder API (it lands in stream-chat 9.x / stream-chat-react 13.x), so it schedules an in-browser nudge for now, gated on the channel `reminders` config. The Commons version and the server-backed reminder after the version upgrade are separate follow-ups. |
| 26 | Scheduled messages | Build | Turn on the dashboard toggle (currently off) + UI. |
| 27 | Flag a message for review | Build | All surfaces. Feeds the moderation review queue (#30). |
| 28 | Mute a user | Build | All surfaces. |
| 29 | Block / ban a user | **Admin-only** | Admin moderation action. |
| 30 | Automod (block-list / semantic) + review queue | Build | Uses Stream's Moderation product. |
| 31 | Slow mode / cooldown on a channel | Build | Admin-configurable per channel. |
| 32 | Web push notifications | **Excluded** | — |
| 33 | Mobile (Android) push notifications | **Excluded** | — |
| 34 | Unread reminder pings (email/push) | **Excluded** | — |
| 35 | Stream **Feeds** (activity feed, follows, reactions on posts) | Audit | Owner: already applied where applicable. Audit for gaps and report; do not rebuild. |
| 36 | Stream **Video** beyond PeerProgramming (recording, screenshare) | Audit | Owner: already applied where applicable. Audit for gaps and report; do not rebuild. |
| 37 | Location sharing | **Excluded** | Excluded on safety grounds for a survivor product. |

## Build tasks (flat, ordered; dependencies named)

Each task is intended to ship as its own small PR, grouped so a single PR touches one feature cluster
across the relevant surfaces. A task with no dependency can run anytime / in parallel.

1. **Commons live Stream layer (foundation).** Done (branch `feat/commons-live-stream-layer`,
   2026-06-21). Added a live Stream Chat client connection beneath the existing custom Commons UI
   (kept the design; read live events, did not swap components): `POST /api/commons/join` now mints real
   `ctf-feed-community` credentials, the Commons hook opens a `stream-chat` connection and refreshes
   history on `message.new`/reconnect, the 10s poll slows to a 30s backstop while live, and a subtle
   "X is typing…" line surfaces typing — all with a clean fall-back to polling when Stream is
   unconfigured. Read receipts (#18), delivery status (#19), and presence dots (#20) were left as
   deferred follow-ups for the presence cluster (task 6). This is the prerequisite for real-time
   Commons features (reactions sync, typing, read receipts, delivery, presence). No dependency.
   **Blocks:** the Commons portion of tasks 2, 6, 7.
2. **Reactions (#1).** Plugin chats: enable in the richer Stream UI. Commons: render a reaction bar on
   the custom cards. Commons portion is blocked by task 1.
3. **Threads + quoted reply for plugin chats (#2, #3).** Add `Thread`/`Window` to the plugin chats;
   Commons quoted reply is already done (#695), add the thread view there too. No dependency for the
   plugin-chat portion.
4. **Composer cluster (#4, #11).** @mentions autocomplete + emoji picker, all surfaces. No dependency.
5. **Message actions cluster (#5, #6, #8).** Edit / delete own message + copy, all surfaces. No
   dependency. (Commons edit/delete touches our own message API, not Stream.)
6. **Presence cluster (#17, #18, #19, #20, #21).** Typing, read receipts, delivery status, presence
   dots, member list. Plugin chats: enable. Commons: blocked by task 1.
7. **Pin a message, admin-only (#7).** Pinned bar visible to all; pin/unpin restricted to admins.
   Commons portion blocked by task 1.
8. **Link preview cards (#15).** Render URL-enrichment attachments, all surfaces. No dependency.
9. **Unread nav badges (#23).** App-nav unread counts from the last-seen endpoint shipped in #695. No
   dependency.
10. **Message search (#9).** In-channel search, all surfaces. No dependency.
11. **Polls (#24).** Enable the channel-type toggle, build create + vote UI. No dependency.
12. **Reminders + scheduled messages (#25, #26).** Enable toggles, build the UI. No dependency.
13. **Moderation cluster (#27, #28, #29, #30, #31).** Flag, mute, admin block/ban, automod + review
    queue, slow mode. Touches admin surfaces; sequence the review queue after flagging exists within
    this task.
14. **Voice messages — PeerProgramming only (#12).** Audio recording in the PP room. Scoped to PP by
    giving PeerProgramming its own `peer-programming` channel type (audio/uploads enabled) so voice
    never reaches the shared `messaging` type. No dependency.
15. **Commons topic filter.** Extend the existing `feed_community_posts.category` field with a small
    fixed topic set, let authors pick a topic when posting, and add topic chips/tabs that filter the
    Commons feed via our API/DB. One unified feed, not separate rooms. No dependency.
16. **Audit: Stream Feeds (#35) and Stream Video (#36).** Review where Feeds and Video are used today
    and report any surface that should have them but doesn't. Report only; build follow-ups as
    separate tasks if gaps are found.

## Excluded (do not build)

Image upload (#13), file upload (#14), Giphy (#16), web push (#32), Android push (#33), unread
reminder pings (#34), location sharing (#37). Voice (#12) is excluded everywhere except Peer
Programming.

## Change log

- 2026-06-21: Document created with the owner's marked exclusions and the two architecture decisions.
  Commons reply-to-message (#3) and unread divider (#22) already shipped in PR #695.
- 2026-06-21: Added the "Channel types in Stream" section (only `messaging` is used; enforce
  exclusions there; dedicated `peer-programming` type for voice) and the "Commons topic filtering"
  section (one unified feed filtered on the existing `category` field; Query Channels reserved for the
  cross-chat unread inbox). Added the Commons topic-filter build task.
- 2026-06-21: Added the "why `messaging`-style text + `default` video, not `livestream`" note for Peer
  Programming, with the one trigger (broadcasting cohort video to listen-in watchers) that would
  justify the `livestream` video call type.
- 2026-06-21: Task 1 (Commons live Stream layer) shipped on branch `feat/commons-live-stream-layer`.
  `POST /api/commons/join` mints real `ctf-feed-community` credentials (or reports `configured: false`);
  the Commons hook opens a `stream-chat` connection, refreshes history on `message.new`/reconnect,
  slows the poll to a 30s backstop while live, and surfaces a typing indicator — falling back to
  polling when Stream is unconfigured. Read receipts, delivery status, and presence dots deferred to
  task 6. Quota note: `ctf/docs/quota-impact/2026-06-21-commons-live-stream-layer.md`.
- 2026-06-21: Plugin-chat portions of @mentions (#4), in-channel message search (#9), and link
  preview cards (#15) shipped in the shared StreamChatPanel, so every Direct Line chat (TrustTransport,
  SocketRelay, LightHouse, Foundation) gets them. @mentions and link previews are Stream v12 defaults
  switched on by watching the channel with members and setting `enrichURLForPreview`; search is a
  compact strip calling `channel.search`. The Commons versions of all three remain separate follow-ups
  because Commons uses our own custom UI, not the Stream component.
- 2026-06-21: Plugin-chat portions of polls (#24) and message reminders (#25) shipped in the shared
  StreamChatPanel, so every Direct Line chat (TrustTransport, SocketRelay, LightHouse, Foundation)
  gets them. Polls are the stream-chat-react 12.16 default once the channel type permits them (owner
  enabled the toggle): the composer attachment menu shows "Create poll" and the message list renders
  Stream's poll card with live voting; the panel only confirms the defaults run and tints the card to
  the plugin accent. Reminders are a "Remind me about this" message action gated on the channel
  `reminders` config; stream-chat 8.60 has no per-message reminder API (it arrives in stream-chat 9.x /
  stream-chat-react 13.x), so it schedules an in-browser nudge for now. The Commons versions and the
  server-backed reminder after the stream-chat upgrade remain separate follow-ups.
- 2026-06-23: Android parity for the plugin-chat richer layout — threaded replies (#2) and reactions
  (#1) — shipped in the shared mobile chat `StreamChatView.tsx` (#699), so every Direct Line chat
  (TrustTransport, SocketRelay, LightHouse, Foundation, chyme) on Android matches the web's `Window` +
  `Thread` layout. The minimal `<Chat><Channel><MessageList/><MessageInput/></Channel></Chat>` is now
  wrapped in `OverlayProvider` (required for the long-press reaction picker and thread navigation);
  `thread`/`threadList` go to `<Channel>`, `<MessageList onThreadSelect>` opens a reply thread, and
  `<Thread />` renders it with a "Back" affordance. Reactions, the typing indicator, and read state are
  the `stream-chat-react-native` 8.13 defaults once `OverlayProvider` wraps the channel — no extra prop
  needed. The accent/gray bubble convention is preserved: the "others take the plugin accent" theme now
  travels through `OverlayProvider value={{ style }}` (replacing the prior `ThemeProvider` wrapper) so
  the overlay and thread inherit it, and the member's own bubbles stay gray via the unchanged
  Channel-level `myMessageTheme`. Presentation / SDK-layout only — no new Stream API calls, no quota
  impact (`ctf/docs/quota-impact/2026-06-23-mobile-stream-chat-threads-reactions.md`). The Commons
  threads/reactions versions (custom UI) remain separate follow-ups.
