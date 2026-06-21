# Stream Feature Adoption — Tracking

This document tracks the work to use more of the GetStream feature set across the app's chat
surfaces. The owner's direction (2026-06-21): the product is underutilizing Stream; the Commons in
particular is the first thing people see and should feel inviting and high production value. Unless a
feature is marked excluded below, build it.

This is a living tracker. Update the status column as work ships, and link the PR.

## Two architecture decisions (owner-approved, 2026-06-21)

1. **Commons keeps its custom design; add Stream features into it.** The Commons (the home/community
   chat) is a hand-built surface — it renders our own cards and reads from our own
   `/api/hub/messages`, mirroring to Stream server-side. We do **not** replace it with Stream's stock
   chat UI. Instead we add a live Stream client connection underneath the existing design and surface
   each feature within our own components. This preserves the approved Commons look (design guardrail)
   while gaining the real-time features.
2. **Plugin chats adopt Stream's richer UI.** The per-plugin chats (TrustTransport, SocketRelay,
   LightHouse, Foundation, Chyme) already run Stream's React components but only render a bare message
   list + input (`components/shared/stream-chat-panel.tsx`). These get the fuller Stream UI (thread
   view, reactions, typing, presence, search, etc.) since they have no bespoke design to protect.

## Surfaces in scope

| Surface | How it uses Stream today | Approach |
|---|---|---|
| Commons (home/community chat) | Custom UI over `/api/hub/messages`; mirrors to Stream server-side | (1) add features into custom design |
| Peer Programming text room | Custom UI over `/api/peer-programming/messages` | (1) add features into custom design; **plus** voice (see #12) |
| Peer Programming session | Stream **Video** (live calls) | already live; audit for gaps |
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
| 1 | Emoji reactions on messages | Build | All surfaces. The headline "inviting" feature. |
| 2 | Threaded replies (thread panel) | Build | All surfaces. |
| 3 | Quoted reply (inline "replying to…") | **Done (Commons)** / Build (plugin chats) | Commons shipped in PR #695. Plugin chats still to do. |
| 4 | @mentions with autocomplete + highlight | Build | All surfaces. |
| 5 | Edit your own message | Build | All surfaces. |
| 6 | Delete your own message | Build | All surfaces. |
| 7 | Pin a message | **Admin-only** | Only admins may pin/unpin; everyone sees the pinned bar. |
| 8 | Copy message text | Build | All surfaces. |
| 9 | Message search (in-channel) | Build | All surfaces. |
| 10 | Slash commands | Deferred | The only configured command is `giphy`, which is excluded (#16). No active command to surface; revisit if we add non-giphy commands. |
| 11 | Emoji picker in the composer | Build | All surfaces. |
| 12 | Voice / audio messages | **PP-only** | Excluded everywhere except Peer Programming. PP is a scoped async+sync environment that is easier to moderate, so voice is allowed there only. |
| 13 | Image upload + inline preview | **Excluded** | — |
| 14 | File upload (docs/PDFs) | **Excluded** | — |
| 15 | Link preview cards (URL enrichment) | Build | All surfaces. Capability already enabled in the dashboard; just render the cards. |
| 16 | Giphy picker | **Excluded** | Remove/skip the `giphy` command surface. |
| 17 | Typing indicators | Build | All surfaces. |
| 18 | Read receipts (who's seen it) | Build | All surfaces. |
| 19 | Delivery status (sent/delivered) | Build | All surfaces. |
| 20 | Online / offline presence dots | Build | All surfaces. |
| 21 | Channel member list / "who's here" | Build | All surfaces. |
| 22 | Unread divider ("where you left off") | **Done (Commons)** / Build (plugin chats) | Commons shipped in PR #695. |
| 23 | Unread count badges on the app nav | Build | Uses the last-seen endpoint from PR #695. |
| 24 | Polls (create + vote) | Build | Turn on the dashboard toggle (currently off) + UI. |
| 25 | Message reminders / "remind me" | Build | Turn on the dashboard toggle (currently off) + UI. |
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
| 36 | Stream **Video** beyond Peer Programming (recording, screenshare) | Audit | Owner: already applied where applicable. Audit for gaps and report; do not rebuild. |
| 37 | Location sharing | **Excluded** | Excluded on safety grounds for a survivor product. |

## Build tasks (flat, ordered; dependencies named)

Each task is intended to ship as its own small PR, grouped so a single PR touches one feature cluster
across the relevant surfaces. A task with no dependency can run anytime / in parallel.

1. **Commons live Stream layer (foundation).** Add a live Stream Chat client connection beneath the
   existing custom Commons UI (keep the design; read live events, do not swap components). This is the
   prerequisite for real-time Commons features (reactions sync, typing, read receipts, delivery,
   presence). No dependency. **Blocks:** the Commons portion of tasks 2, 6, 7.
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
14. **Voice messages — Peer Programming only (#12).** Audio recording in the PP room. Scoped to PP.
    No dependency.
15. **Audit: Stream Feeds (#35) and Stream Video (#36).** Review where Feeds and Video are used today
    and report any surface that should have them but doesn't. Report only; build follow-ups as
    separate tasks if gaps are found.

## Excluded (do not build)

Image upload (#13), file upload (#14), Giphy (#16), web push (#32), Android push (#33), unread
reminder pings (#34), location sharing (#37). Voice (#12) is excluded everywhere except Peer
Programming.

## Change log

- 2026-06-21: Document created with the owner's marked exclusions and the two architecture decisions.
  Commons reply-to-message (#3) and unread divider (#22) already shipped in PR #695.
