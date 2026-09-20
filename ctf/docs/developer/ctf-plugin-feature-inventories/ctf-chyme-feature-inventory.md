# Chyme Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` remains reference-only and must not be modified.
- Unified plugin scope slug: `chyme`
- This document captures the implemented Chyme scope in `ctf/` as of the current rewrite baseline.

## Intent and Outcome

Chyme delivers a lightweight social-audio room with companion text chat, shared-adapter Stream-backed room join flow, provider-neutral access enforcement, and plugin-scoped deletion behavior under the CTF plugin-first architecture.

Lifecycle/governance references applied:

1. Inventory/checklist lifecycle follows `index.mdc` precedence and Rule 120.
2. Profile/deletion boundaries follow Rule 114 and `ctf/docs/contracts/CHYME_PROFILE_AND_DELETION_CONTRACT.md`.
3. Implementation sequencing must honor baseline phase order: auth integration, Railway deployment baseline, Vercel integration, Expo baseline.

## User Features (Implementation Scope)

1. Authenticated room bootstrap via `GET /api/chyme/room` with deterministic room provisioning (`chyme-main-room`) and participant upsert.
2. Companion text chat read/send via `GET /api/chyme/messages` and `POST /api/chyme/messages`, with DB persistence and Stream message fan-out through shared adapters. A member can **delete** their own room chat message (`DELETE /api/chyme/messages/[messageId]`, author-only) and **Edit** it — edit is delete + repost (loads the text into the composer, deletes the original, member sends a fresh message), matching the Commons home chat. Edit/Delete show on the member's own messages only. (The displayed room chat is DB-backed; the Stream fan-out copy has no per-message id stored, so a single-message delete removes the DB row shown in the panel — full Stream purge still happens on Chyme service/account deletion.)
3. Stream-backed room join/token flow via `POST /api/chyme/join`, using shared Stream wrappers in `packages/shared`.
4. Service-scoped deletion request via `DELETE /api/account/chyme-profile`.
5. Full-account deletion request initiation via `DELETE /api/account/full-account`, including ServiceCredits reclaim dependency queueing in existing reclaim/outbox tables.
6. ServiceCredits peer tipping: a **Tip** action on every other participant's tile sends ServiceCredits from the signed-in member to that participant via `POST /api/chyme/service-credits` (origin_plugin `chyme`). The transfer delivers immediately and is recognized in GDP as Chyme peer tips. The action never appears on the local member's own tile or on a listen-only guest (no wallet).
7. Back Channel (spec #1746): start a free, private 1:1 audio call with another member who is in the same live room right now, using the **Back Channel** action on their participant tile. They get an invite they can accept or decline — nobody is cold-called. Once accepted, you talk one-to-one in a small call panel while the room stays open behind you; hanging up ends it with no history kept. It is always free — a note points you to Foundation if you want a call with ServiceCredits attached. You can't Back Channel someone you've blocked (or who blocked you), and it never appears on your own tile.
8. Web UI surface includes participant list, join-call action, chat panel, the per-participant tip action (`chyme-tip-dialog.tsx`), the per-participant Back Channel action (`chyme-back-channel-layer.tsx`), and deletion actions.
9. Android UI surface includes room summary, participant roster, chat send/read, join action, the per-participant tip action (`ChymeTipModal.tsx`), the per-participant Back Channel action with a bottom-sheet invite and full-screen call (`ChymeBackChannelInviteSheet.tsx` / `ChymeBackChannelCall.tsx`), and deletion actions using runtime-configured provider-neutral identity headers.
10. **Private "Weavers of the Commons" room (web, contributor-gated).** A second Chyme room, `chyme-contributors-room`, reachable from an in-shell room switcher next to the main room. It is the Chyme counterpart to the gated Commons chat channel: only contributor-eligible members (and admins) may join, gated exactly like the Commons channel — the contributor-access channel-open switch **and** the member's eligibility flag, or admin. A member who fails either gets a bare 404 from the room read, and the switcher tab shows the "how it's earned" explainer (`WeaversBadge` + a link to `/apps/directory/weavers-of-the-commons`) — the same no-shaming pattern; non-eligible members never see a locked/absence state. It is an **audio + room-chat MVP**: live audio (join/speak/listen/presence/hand-raise) and its own room text chat. ServiceCredits tips and Back Channel 1:1 calls are intentionally **not** offered in the private room yet (Back Channel invites are scoped to the main room's presence). The room is addressed by a `?room=contributors` query param threaded through the client (`ChymeShell` → `ChymeLiveShell` → `ChymeRoomView` → `ChymeAudioRoom`). Each opened room stays **mounted** (hidden with `display:none` when it is not the active one) rather than being remounted on switch, so switching rooms never tears down a live audio call. Android: out of scope (Commons/contributor surfaces are web-only per rule 105; the native app is narrowed to the main Chyme room).
11. **Rooms rail + in-room layout (web, owner request 2026-07-23).** The room switcher at the top of the shell is a horizontal, left-to-right scroller of room cards (the open Main Room and the private Weavers of the Commons room), so it stays one compact row instead of a full-height card that repeated the room title and wasted vertical space on phones. Selecting a card switches the room shown below without disconnecting any room already joined (see feature 10). A **"Get the Android app"** card appears in the rail on non-Android browsers and links to the repo's GitHub Releases page filtered to the mobile releases (`https://github.com/chargingthefuture/chargingthefuture/releases?q=mobile`), where the APK is downloaded (owner decision 2026-07-23 — APK is distributed via GitHub releases only, not an app store; filter added 2026-08-18 so the newest APK sits at the top now that wallpaper releases share the page); on an Android device the card is hidden and the rail is just the list of rooms. Inside a room, the audio controls (mute / raise hand / leave) sit directly **below** the participant avatars and **above** the room chat, so a member can mute/unmute while talking without hunting past the avatars or scrolling the chat.

12. **Room capacity and the Stream quota notice (2026-09-19).** Every room read carries `capacity`
    (`current` / `max`) and `quota` (the band, a member-facing `notice`, and whether guest
    listening and Back Channel are open). The room header reads the plain count ("3 participants")
    and names the cap only once it matters — from 80% of it ("40 of 50 participants · nearly
    full") and at it ("50 of 50 participants · full"; owner report 2026-09-19: "1 of 50" all day
    read as a claim about the room) — and, from
    the Yellow band up, a plain notice under it says what is getting tight and what pauses (web
    and Android). A member joining a room that is at its cap gets "This room is full right now (M
    of M people). Try again in a minute." in place of the stage (web) or as the join alert
    (Android); a member already inside the presence window is never turned away by their own row.
    The caps and the pauses come from `lib/stream-quota/policy.ts`, driven by the minute meter
    below; the numbers themselves are on the admin screen, not member screens (rule 110).
13. **The Join pill tells the truth about the live connection (web, 2026-09-19).** "✓ Joined" used
    to be set once, when the join request succeeded, and never changed — a phone that locked,
    switched apps, or lost the network kept reading "Joined" after the call had dropped. The pill
    now follows the Stream SDK's calling state: "✓ Joined", "Reconnecting…" (amber) while the SDK
    is trying, and "Connection lost — leave and rejoin" (red) once it has given up, with the same
    line under the stage. Android already keeps the call alive in the background (its foreground
    service), so the change is web-only.
14. **Signed-out listeners: one identity per browser, minted on the tap, capped, and metered
    (2026-09-19).** The public page load no longer mints a Stream guest user; `Tap to listen`
    calls `POST /api/chyme/public/listen`, which admits the guest (room live, guests not paused,
    a spot free under `CHYME_MAX_GUEST_LISTENERS`), sets an httpOnly cookie carrying one random
    guest id for that browser, and mints `chyme-guest-<id>` — so a returning browser reuses one
    Stream user instead of creating a fresh one per load. While listening, the page heartbeats
    `POST /api/chyme/public/heartbeat` every 35s (the guest cap counts it; the minute meter is
    credited from it) and posts `POST /api/chyme/public/leave` on close. A refusal shows the
    server's own reason with a "Try again" control.

15. **Scheduled rooms, MVP: what is coming up on the TI Radio guide (owner decision, 2026-09-19).**
    Chyme now reads the TI Radio schedule and shows the next five booked slots that have not ended
    — day and time in the reader's own timezone ("Today · 2:00 PM – 3:30 PM"), the title, "Hosted
    by @handle", and an "On air now" mark on the slot happening this minute — with a link to the
    full guide. Web: under the rooms rail on the member view (`chyme-upcoming.tsx`) and under the
    room list on the signed-out page (both re-read on the page's refresh control), as a sideways
    rail of cards in the shape of the rooms rail above it (owner directive, 2026-09-20 — stacked,
    five booked slots were a phone screen on their own). Android: the Upcoming tab of the room
    list, which used to be a placeholder sentence; it keeps its stacked list, since it has a tab
    and a screen to itself rather than a strip under the room. Read through the guide's
    own public route `GET /api/ti-radio/guide` (client-side; no server import, per the plugin
    boundary), so a signed-out visitor sees the same list. Empty state says nothing is scheduled and
    that any approved member can book a slot; a failed read shows the route's reason. This is the
    whole of scheduled rooms for now: no room creation, no room per slot, no search — the rest of
    the multi-room design waits for usage.
16. **Hand-raise mode, the member's side (owner decision, 2026-09-19).** A room is in open mic
    (every joiner may speak — the room as it shipped) or hand-raise mode. In hand-raise mode a
    joiner listens: the microphone control is replaced by "Listening — raise your hand to ask to
    speak", the microphone is turned off the moment the room says so, and a notice under the room
    header says what the mode means. When an admin lets them speak the microphone control returns
    on the next room poll (within 15s); when an admin moves them back to listening it is gone again
    and their microphone is off. Web and Android. The mode and the member's own role ride on every
    room read (`speakMode`, `viewer`).
17. **Removed from a room (member's side, 2026-09-19).** A member an admin removed is dropped from
    the call and the count at once, and a later Join answers "An admin removed you from this room.
    You can come back once an admin lets you back in." (403) in place of the stage; the heartbeat
    answers the same, so a still-open page cannot keep a presence row alive. Lifted only from the
    Chyme admin screen.

## Admin Features

1. **Live Audio Usage screen (`/admin/chyme`, 2026-09-19).** The Stream Video minute meter:
   month-to-date participant-minutes against the budget, the percent and the band, today's
   minutes, a straight-line projection to month end, the per-surface split (main room, Weavers
   room, signed-out listeners, Back Channel), the last seven days, who is in the main room this
   minute (members and signed-out listeners), the caps and pauses in force, and the settings
   behind them. Read-only, admin-only, with a "Copy as text" control so the whole thing can be
   pasted into a message from a phone (rule 131). Reads `GET /api/chyme/admin/stream-usage`. The
   count is the app's own estimate from the presence heartbeats; the Stream dashboard is the bill
   of record.
2. Eligibility gate must enforce shared access approval model (`approved user` or `admin`) for room/chat/join routes.
3. **Moderation controls (owner decision, 2026-09-19), web and Android.** An admin in the room
   sees, under every other member's tile: **Mute** (turns their microphone off in the call), **Remove**
   (drops them from the call and keeps them out until an admin lets them back in — a confirm first),
   and in hand-raise mode **Let speak** / **Listening** (their role). In the control row an admin sees
   the **speak-mode switch**: Open mic ↔ Hand-raise mode. Switching to hand-raise turns everyone
   present except the acting admin into a listener and mutes them; switching back lets everyone
   unmute. Every action is recorded in `chyme_admin_audit_trail` and applied in the Stream call
   through the server SDK (`lib/chyme/stream-moderation.ts`); when Stream did not apply it (an
   outage, a call that ended) the answer says so in `streamNotice` and the control shows the line —
   the decision stands in this app either way. Hand-raise mode is enforced server-side on the call
   only when `CHYME_GUEST_STREAM_ROLE` is set (the listen-only role guests already carry doubles as
   the listener role); unset, the apps enforce it alone, as guest listen-only was before the role
   existed. That role and its grants on the `default` call type are owned by code, not by dashboard
   clicks: the "Stream — Guest Listener Setup" workflow applies them and checks them weekly
   (`ctf/scripts/stream-guest-listener-setup.mjs`), so a drift that would break hand-raise mode or
   guest listening goes red on its own.
4. **Removed members, on the Live Audio Usage screen (`/admin/chyme`).** Every live removal across
   both rooms, newest first, with the reason and one control, **Let back in**, which lifts the
   removal (the row stays as the record) and unblocks the member from the call.

## API Surface and Route Map (Target)

**Room scope (`?room=`).** The room, presence, chat, join, heartbeat, hand, and leave routes accept an optional `?room=contributors` query param selecting the private Weavers room; anything else (or absent) is the open main room. For `room=contributors` the route runs `requireChymeContributorAccess` (standard Chyme `approved_full` gate **plus** the contributor channel-open switch and the member's eligibility flag or admin) and returns a bare **404** for a non-eligible member; the main room runs the standard `requireChymeAccess`. The room key is resolved from the scope server-side (`chymeRoomKeyForScope`), never from caller input, and threaded into the repository (`ensureRoom(roomKey)`) and the Stream chat channel (channel id = room key), so the two rooms never share presence, messages, or a Stream channel. The `service-credits` (tips) and `back-channel/*` routes are main-room only for now (no `?room` scope).

Chyme plugin routes:

- `GET /api/chyme/room` — the room, its fresh participants, `guestCount` (signed-out listeners in
  the room right now — always 0 for a room other than the public main room, which is the only one a
  guest can reach), `capacity` (`{ current, max }` against
  the cap in force), `quota` (`{ band, notice, guestListenAllowed, backChannelAllowed }` from
  the Stream quota policy), `speakMode` (`'open' | 'hand_raise'`), and `viewer`
  (`{ isAdmin, role }` — worked out on the server; an admin is always a speaker). Polled every 15s
  by both apps while a room is shown.
- `GET /api/chyme/messages` — read bounded room history. Optional `?limit` is clamped to the `chyme.messages.list` contract bounds (minimum 1, maximum 100) at the route layer; a missing or non-numeric value falls back to the default (100).
- `POST /api/chyme/messages` — send a chat message. CSRF-guarded (`x-ctf-csrf: '1'` + same-origin).
- `DELETE /api/chyme/messages/[messageId]` — delete the caller's OWN room chat message. Author-only: the repository (`deleteRoomMessage`) checks ownership and deletes only when `user_id` matches; a message that is not the caller's returns **403** (`CHYME_NOT_MESSAGE_OWNER`), an unknown/already-gone id returns **404** (`CHYME_MESSAGE_NOT_FOUND`), a malformed (non-UUID) id returns **400**. Room-scoped via `?room=` like the sibling message routes. Audit `chyme.message.delete`. CSRF-guarded. There is no in-place edit — the client's **Edit** loads the message text into the composer and calls this delete, so a corrected message is a fresh row with a new id/timestamp (matching the Commons home chat).
- `POST /api/chyme/join` — load/bootstrap the room and mint Stream join credentials; marks the member joined (an admin as a speaker; in hand-raise mode a member as a listener). CSRF-guarded. **403** `CHYME_REMOVED_FROM_ROOM` while an admin's removal stands. **409** (`CHYME_ROOM_FULL`, with `capacity`) when the room already holds as many members as the quota policy's cap allows — checked before the Stream mint (a turned-away member costs no Stream call) and again under a lock on the room row inside `markRoomCallJoined`, so two members racing for the last spot cannot both take it. A member already inside the presence window is never turned away by their own row. Audited as a deny with reason `room_full`.
- `POST /api/chyme/heartbeat` — presence keepalive (403 `CHYME_REMOVED_FROM_ROOM` while a removal stands, so a still-open page cannot keep a removed member present); refreshes the member's `last_seen_at` while in the call and credits the seconds since the previous heartbeat (capped at the 45s window) to the Stream Video minute meter (`stream_video_usage_daily`, surface `chyme:<roomKey>`). CSRF-guarded.
- `POST /api/chyme/hand` — persists the caller's raise/lower hand on their presence row (`{ raised: boolean }`); returns `{ ok, room }` with refreshed participants. The raised hand stays visible to everyone until lowered, the member leaves, or their presence goes stale. Audit command `chyme.hand`. CSRF-guarded.
- `POST /api/chyme/leave` — drops the member's presence row on exit (which also clears any raised hand). CSRF-guarded.
- `GET /api/chyme/public/room` — **public, unauthenticated, read-only.** Returns the one default room's live status (`isLive`, `participantCount`, `guestCount`) and, when live, `guestListenAllowed` — false, with `listenUnavailable` carrying the plain reason, while the Stream quota policy has guest listening paused (Orange band and above). Since 2026-09-19 this route touches nothing on Stream: the guest identity is minted by the listen route below on the visitor's tap, so a page load is no longer a Stream user. Only a failed database read returns 503, with the reason. Per-IP rate limit (30 a minute).
- `POST /api/chyme/public/listen` — **public, unauthenticated; the tap.** Admits one signed-out listener and returns their listen-only Stream credentials. Requires the same-origin `x-ctf-csrf: '1'` header (it mints a billable identity and takes a spot), per-IP rate limited like the room read. Reads the browser's `ctf_chyme_guest` cookie (httpOnly, `SameSite=Lax`, `Secure` in production, path `/api/chyme/public`, one year) or sets one carrying a fresh random UUID; the Stream user is `chyme-guest-<id>`, so one browser is one Stream user across page loads. Refusals, each with the plain reason in `message`: **409** `CHYME_GUEST_LISTEN_FULL` when every guest spot is taken (`CHYME_MAX_GUEST_LISTENERS`, default 100), **409** with `isLive: false` when the room went quiet between the read and the tap, **503** `CHYME_GUEST_LISTEN_PAUSED` while the quota policy has guests paused, **503** `CHYME_STREAM_UNAVAILABLE` when Stream is not configured or rejected the guest upsert (Stream's own reason, api key redacted). The admission (live check, policy, cap, roster insert) runs in one transaction under a lock on the room row so two taps cannot both take the last spot. Guests are listen-only: the client joins muted with no speak controls, and when `CHYME_GUEST_STREAM_ROLE` is set the guest Stream user is created with that restricted role so Stream blocks publish server-side (the owner removes `send-audio`/`send-video`/`screenshare` from that role on the `default` call type — see `ctf/docs/plugins/chyme/guest-listener-stream-role.md`; the owner has applied it as of 2026-09-18). The guest token expires after one hour.
- `POST /api/chyme/public/heartbeat` — **public, unauthenticated.** The listener's presence keepalive, every 35s while listening (visible tab only, like the member heartbeat). Identified by the guest cookie: **400** `CHYME_GUEST_IDENTITY_MISSING` without it, **404** with the same code when the guest's roster row is gone (the page then re-admits itself through the listen route). Refreshes `chyme_guest_listeners.last_seen_at` and credits the gap to the minute meter (surface `chyme:guest`). Answers with the room's current `participantCount` and `guestCount`, which is what keeps the listener's own attendance line right as people arrive and leave — the beat is already a round trip every 35s, so the counts cost no extra request. CSRF header required; per-IP rate limited.
- `POST /api/chyme/public/leave` — **public, unauthenticated.** Drops the guest's roster row so the spot frees at once rather than at the end of the presence window; the cookie stays so the browser keeps its one Stream identity. Always `ok` when there is no cookie. CSRF header required; per-IP rate limited.
- `GET /api/chyme/public/messages` — **public, unauthenticated, read-only** (owner directive, 2026-09-18: a signed-out visitor can read the room chat and signs in to write). Returns the one default room's recent messages (`ok`, `isLive`, `messages`; optional `?limit` clamped to 1–100, default 50) only while the room is live; when nobody is in the call it answers `isLive: false` with an empty list. Per-IP rate limit like the room route (the page polls every ten seconds). A failed database read returns 503 with the reason. There is no POST: writing still needs a signed-in, approved member via `POST /api/chyme/messages`.
- `POST /api/chyme/service-credits` ← `{ toUserId, amount, message?, idempotencyKey? }` → `{ ok, transaction }` — send ServiceCredits from the signed-in member to `toUserId` from the Chyme room (e.g. tipping a speaker). Gated by `requireChymeAccess`. Validation (all 400 on failure): `amount` must be a finite number greater than 0 and at most `CHYME_MAX_TIP_AMOUNT` (10000); `toUserId` must not equal the sender (no self-tip). Optional `idempotencyKey` is a client nonce, namespaced under the sender (`chyme-<senderUserId>-<nonce>`) so a retried tip deduplicates; absent it, `sendServiceCredits` mints a per-request UUID. Delegates to `sendServiceCredits` (`lib/chyme/repository.ts`), which uses the shared ServiceCredits transfer primitive — Chyme owns no credits ledger. CSRF-guarded: the handler calls `ensureMutationCsrf` (requires the `x-ctf-csrf: '1'` header + same-origin), matching the sibling plugin service-credits routes (lighthouse / foundation / skills-hunt).

Admin routes (2026-09-19). All `requireChymeAdminAccess` (`requiredRoles: ['admin']`); the mutations
take the same-origin `x-ctf-csrf: '1'` header and accept `?room=contributors`; every mutation writes a
row in `chyme_admin_audit_trail` (`recordChymeAdminAudit`) whatever the outcome, and answers
`{ ok, streamApplied, streamNotice? }` — `streamNotice` carries Stream's own reason when the call
side did not apply (the decision is recorded and enforced by this app either way):

- `POST /api/chyme/admin/mute` ← `{ userId }` — turn the member's microphone off in the call. Nothing stored beyond the audit row. Audit `chyme.admin.mute`.
- `POST /api/chyme/admin/remove` ← `{ userId, reason? }` — remove the member from the room and keep them out: presence row deleted, a `chyme_room_removals` row inserted (or its reason refreshed), the member blocked from the Stream call. Audit `chyme.admin.remove`.
- `POST /api/chyme/admin/lift-removal` ← `{ userId }` — let a removed member back in: the removal row is lifted (kept as the record) and the member unblocked from the call. **409** `CHYME_MEMBER_NOT_IN_ROOM` when there was no live removal. Audit `chyme.admin.lift-removal`.
- `POST /api/chyme/admin/role` ← `{ userId, role: 'speaker' | 'listener' }` — hand-raise mode: let a present member speak, or move them back to listening (which also mutes them). Sets `chyme_room_members.role` and, when `CHYME_GUEST_STREAM_ROLE` is set, the member's role on the call. **409** `CHYME_MEMBER_NOT_IN_ROOM` when they are not present. Audit `chyme.admin.role`.
- `POST /api/chyme/admin/speak-mode` ← `{ mode: 'open' | 'hand_raise' }` — switch the room's mode. Switching to hand-raise turns everyone present except the acting admin into a listener and mutes them in the call (`demoted` in the answer). Audit `chyme.admin.speak-mode`.
- `GET /api/chyme/admin/removals` — every live removal across both rooms, newest first, for the admin screen. Read-only.
- `GET /api/chyme/admin/stream-usage` — **admin-only** (`requireChymeAdminAccess`, `requiredRoles: ['admin']`), read-only. Returns `usage` (the `StreamVideoUsageSummary`: month start, day of month, budget, used minutes, percent, band, today, straight-line projection, per-surface and per-day rows), `policy` (the `ChymeQuotaPolicy` in force), `room` (the main room's live state, member count, guest count), and `config` (the four settings). Feeds the Live Audio Usage screen. A failed read answers 503 with the reason. No mutation, so no audit row (the admin audit coverage gate covers mutating handlers).

Back Channel routes (free 1:1 audio sidebar between two members in the same live room, spec #1746). All under `/api/chyme/back-channel/`; all require `requireChymeAccess` (signed-in + approved_full); all mutations CSRF-guarded:

- `GET /api/chyme/back-channel/state` — poll-driven state for the caller: `{ incomingInvite, outgoingInvite, activeCall }`. Reaps stale rows on every read (a pending invite lapses after ~45s or when either party leaves the room; a live call whose heartbeats stopped ends after ~90s). Read-only, not audited (high-frequency poll).
- `POST /api/chyme/back-channel/invite` ← `{ recipientUserId }` → `{ ok, callId }` — invite another member who is in the same room right now. Block-aware: `403` (`CHYME_BACK_CHANNEL_BLOCKED`) if a `member_blocks` row exists in either direction; `409` (`CHYME_BACK_CHANNEL_NOT_IN_ROOM`) if either party is not freshly present; `503` (`CHYME_BACK_CHANNEL_PAUSED`) while the Stream quota policy has Back Channel paused (Orange band and above — the tile action is hidden by then via the room's `quota.backChannelAllowed`; this is the check behind it). Audit `chyme.back-channel.invite`.
- `POST /api/chyme/back-channel/accept` ← `{ callId }` → `{ ok, callId, streamCallId, streamApiKey, streamUserId, streamToken }` — recipient accepts; the call goes live and the recipient's Stream 1:1 audio join credentials are returned. Audit `chyme.back-channel.accept`.
- `POST /api/chyme/back-channel/join` ← `{ callId }` → same credentials shape — mints join credentials for a member already in an active call (the initiator, once accepted). Audit `chyme.back-channel.join`.
- `POST /api/chyme/back-channel/decline` ← `{ callId }` → `{ ok: true }` — recipient declines; no message is sent to the initiator. Audit `chyme.back-channel.decline`.
- `POST /api/chyme/back-channel/leave` ← `{ callId }` → `{ ok: true }` — either party hangs up (or the initiator cancels a still-pending invite). Terminal. Audit `chyme.back-channel.leave`.
- `POST /api/chyme/back-channel/heartbeat` ← `{ callId }` → `{ ok: true }` — keeps a live call from being reaped; called on an interval by both apps. Not audited. Credits twice the gap since the previous beat (two participants; capped at the 90s reap window) to the minute meter, surface `chyme:back-channel`.

Deletion/account routes (API retained; no longer surfaced in the Chyme UI as of 2026-06-01 — see Delivery Status):

- `DELETE /api/account/chyme-profile`
- `DELETE /api/account/full-account`

Current command-contract note:

- Chyme should be delivered as route + repository flows aligned to plugin command/access/audit contracts.
- Plugin command/access/audit YAML triplet artifacts are present:
  - `ctf/docs/contracts/CHYME_PLUGIN_COMMAND_CONTRACTS.yaml`
  - `ctf/docs/contracts/CHYME_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`
  - `ctf/docs/contracts/CHYME_PLUGIN_AUDIT_CONTRACTS.yaml`

## Data Model and Storage Contracts (Target)

Canonical schema target: Chyme core tables are defined in `ctf/schema.sql`, aligned to route assumptions and schema-drift checks.

1. `chyme_rooms`
   - Shared room metadata (`call_active`, and since 2026-09-19 `speak_mode TEXT NOT NULL DEFAULT 'open'`
     — `open` or `hand_raise`, written only by `POST /api/chyme/admin/speak-mode`), one row per room
     keyed by unique `room_key`. **Two rooms exist:** the open `chyme-main-room` and the private `chyme-contributors-room` (the Weavers room). Both are created at runtime via `ensureRoom(roomKey)` upsert (no schema change — the table already supported multiple rooms; `chyme_room_members`, `chyme_messages`, and `chyme_back_channel_calls` all key off `room_id`). Deletion (`markServiceDeletion`) removes the member's messages and presence rows across **all** rooms (keyed on `user_id`), so the private room is covered.
2. `chyme_service_profiles`
   - Plugin extension lifecycle per user (`active|deleted`, timestamps).
3. `chyme_room_members`
   - Membership roster keyed by `(room_id, user_id)`, role enum (`speaker|listener` — read only in
     hand-raise mode: an admin joins as a speaker, a member as a listener until an admin lets them
     speak; ignored in open mode), last-seen updates, and `hand_raised BOOLEAN NOT NULL DEFAULT FALSE` (persistent raise/lower hand state, set by `POST /api/chyme/hand`, cleared on leave/row deletion). The member is identified by the raw `username` (no separate `display_name` column); the app renders it as `@username`, falling back to `user-<first 8 of user_id>` when the username is null.
4. `chyme_messages`
   - Message history with DB-level text constraint (`1..1000` chars). The author is identified by the raw `username` (no separate `display_name` column); the app renders it as `@username`, falling back to `user-<first 8 of user_id>` when the username is null.
5. `chyme_deletion_events`
   - Service/account deletion event log.
6. `service_credits_account_deletion_reclaims`
   - Downstream reclaim dependency record created when full-account deletion is requested.
7. `service_credits_adapter_outbox`
   - Queue used to hand the reclaim dependency to the existing ServiceCredits execution flow.
9. `chyme_guest_listeners` (2026-09-19)
   - The signed-out listener roster for the public main room: `guest_id TEXT PRIMARY KEY` (the
     random UUID from the browser's httpOnly cookie), `joined_at`, `last_seen_at`; indexed on
     `last_seen_at`. A guest counts as listening only while `last_seen_at` is inside the 45s presence
     window; rows four windows old are pruned on the next admission. Holds no personal data — a guest
     id is a random value and nothing else — and is never joined to a member. What the guest cap
     (`CHYME_MAX_GUEST_LISTENERS`) counts and what the public heartbeat refreshes. Migration
     `ctf/db/migrations/post/0029_chyme_stream_usage_and_guest_listeners.sql`.
10. `stream_video_usage_daily` (2026-09-19)
    - The Stream Video minute meter: `(usage_date DATE, surface TEXT)` primary key,
      `participant_seconds BIGINT`, `updated_at`. One row per UTC day per surface, credited from the
      presence heartbeats (`chyme:<roomKey>` for members, `chyme:guest`, `chyme:back-channel`): each
      heartbeat adds the seconds since the previous one, capped at the presence window, so a
      participant who dropped out is not credited for the gap. Read by `lib/stream-quota/usage.ts`
      (month-to-date against `STREAM_VIDEO_MINUTES_BUDGET`, default 333,000) for the admin screen
      and for the band that drives the quota policy. Named for what it measures rather than for
      Chyme because Beacon, Foundation, and PeerProgramming video could credit it the same way; today
      only the Chyme surfaces do. The Stream dashboard is the bill of record. Same migration as above.
11. `chyme_room_removals` (2026-09-19)
    - A member an admin removed from a room: `id`, `room_id` (→ `chyme_rooms`, cascade), `user_id`,
      `username`, `removed_by`, `reason` (≤300), `removed_at`, `lifted_at`, `lifted_by`. Partial unique
      index on `(room_id, user_id) WHERE lifted_at IS NULL` — one live removal per member per room;
      lifted rows stay as the record. Join and heartbeat refuse while a live row exists. Deleted with
      the member's account (deletion registry: a deleted account cannot come back, so the row has
      nothing left to enforce). Migration `ctf/db/migrations/post/0030_chyme_moderation.sql` (also
      adds `chyme_rooms.speak_mode`).
12. `chyme_admin_audit_trail` (2026-09-19)
    - Every Chyme admin action (mute, remove, let back in, role, speak mode), in the shape every other
      plugin's durable admin trail uses: `actor_id`, `command`, `policy_status`, `reason`,
      `target_type`, `target_id`, `result`, `error_category`, `metadata`, `created_at`; indexed on
      `(created_at DESC, actor_id, command)`. Written by `recordChymeAdminAudit`
      (`lib/chyme/admin-audit.ts`), which never throws. Retained on account deletion (deletion
      registry), as every plugin's admin trail is. Same migration.
8. `chyme_back_channel_calls`
   - Back Channel 1:1 call lifecycle (spec #1746). One row per call, keyed by `id`, referencing `chyme_rooms(id)` (`ON DELETE CASCADE`). Columns: `initiator_user_id`, `recipient_user_id`, `initiator_username`, `recipient_username`, `status` (`inviting|active|declined|ended|lapsed`), `stream_call_id`, `created_at`, `answered_at`, `ended_at`, `ended_by_user_id`, `last_heartbeat_at`. A CHECK forbids self-calls; a partial unique index (`status IN ('inviting','active')`) allows only one live call per initiator→recipient direction. Indexed by recipient+status, initiator+status, and room. Holds no chat/history — a row exists only to run one call and is removed on the member's Chyme service deletion (and account deletion). Never surfaced as Trust evidence or in any public feed (rule 132).

## Security, Privacy, and Compliance Controls (Target)

1. Authenticated access is required on Chyme routes; unauthenticated requests are denied (`401`).
2. Access gate enforces approved-user or admin eligibility (`403` for non-approved non-admin users).
3. Identity handle source is the canonical auth-provider username/handle for username/`@mention` semantics, aligned to `ctf/docs/contracts/PLUGIN_IDENTITY_HANDLE_BASELINE.md`.
4. Message payloads are trimmed server-side and rejected when empty.
5. Service deletion runs in transaction and records deletion event for audit trail. Chyme fans each chat message out to Stream (`sendChymeStreamMessage`), so Stream keeps an independent copy; deletion also removes it via `deleteChymeStreamData(userId)` (hard delete of the member's Stream user `chyme-<userId>` with `mark_messages_deleted`). This is wired the systemic way: the shared account-deletion orchestrator runs a per-plugin external-cleanup hook (`lib/account/external-cleanup-registry.ts`) **after** the DB transaction commits, so every whole-account entry point (full-account route, internal delete route, Clerk webhook) clears the Stream copy. The bespoke `DELETE /api/account/chyme-profile` route (which uses `markServiceDeletion`, not the orchestrator) calls `deleteChymeStreamData` directly for the same effect. All best-effort after the DB delete: a Stream outage is logged (`reportError`), never blocks or rolls back the deletion.
6. Full-account endpoint records the Chyme deletion request and queues the downstream ServiceCredits reclaim dependency.
7. Stream integration is routed through shared wrappers/adapters in `ctf/packages/shared`.
9. **Stream quota caps and the minute meter (2026-09-19).** The room cap (`CHYME_MAX_PARTICIPANTS`,
   default 50; `CHYME_RED_BAND_MAX_PARTICIPANTS`, default 10, in the Red band) and the guest cap
   (`CHYME_MAX_GUEST_LISTENERS`, default 100; 0 from the Orange band up) are enforced server-side
   under a lock on the room row, never on the client alone. The policy is derived from the app's own
   meter (`stream_video_usage_daily`) against `STREAM_VIDEO_MINUTES_BUDGET` at rule 110's bands
   (70 / 85 / 95%). Member screens get the band's plain notice and the cap; the meter's numbers are
   admin-only (rule 110: internal quota detail stays off member surfaces). All four settings have
   defaults; none has to be set in Infisical for the app to run (documented in rule 123).
10. **The guest cookie holds no personal data.** `ctf_chyme_guest` is a random UUID, httpOnly,
    `SameSite=Lax`, `Secure` in production, scoped to `/api/chyme/public`, one year. It links a
    browser to one Stream guest user (`chyme-guest-<id>`) and one roster row and nothing else; it is
    never read on a member route and never joined to a member identity. A visitor clearing cookies
    gets a fresh id and a fresh Stream user, which is the pre-2026-09-19 behavior for every load.
11. **Moderation is admin-only and recorded (2026-09-19).** The six `/api/chyme/admin/*` routes run
    `requireChymeAdminAccess` (`requiredRoles: ['admin']`), the mutations take the same-origin CSRF
    header, and every mutation writes `chyme_admin_audit_trail` whatever the outcome. A removal
    keeps a member out of one room only (per-room rows) and is lifted only by an admin; the reason,
    if given, is stored with it and shown on the admin screen. Nothing here is surfaced as Trust
    evidence or on any public feed (rule 132).
8. **Back Channel (spec #1746)** is consent-gated and private: an invite must be accepted (no cold ringing); declining returns only `{ ok: true }` and sends the initiator nothing. It is block-aware — a `member_blocks` row in either direction hides the tile action and makes `invite` return `403`, using the shared `isBlockedBetween` check. It is room-bound — an invite is only valid while both members are freshly present, and lapses server-side otherwise. It carries **no ServiceCredits** (a required Foundation note on every call surface points paid consultations to Foundation). Participation is never exposed as Trust evidence, in activity feeds, or on any public surface (rule 132 sensitive-participation exclusion), and no call history is retained. A member's `chyme_back_channel_calls` rows are deleted on Chyme service deletion and account deletion.

## Web and Android Delivery Status

1. Web implementation is delivered for room/chat/join workflows. The account/data deletion API endpoints remain available, but their buttons were removed from the Chyme room UI (2026-06-01) pending a dedicated, designed account-settings surface; deletion is no longer triggered from inside Chyme.
2. Android implementation is delivered for room/chat/join workflows using runtime-configured request identity and the same protected API surface, including the **live audio room** (Stream Video React Native SDK) at parity with the web room. The deletion buttons were likewise removed from `ChymeRoom.tsx`. Room-chat **Delete + Edit** (delete + repost) is at parity with web as of #1858: `chyme-chat-view.tsx` shows Edit/Delete on the member's own messages only, calling the same author-only `DELETE /api/chyme/messages/[messageId]`.
3. Current feature-parity status is web+android complete (both platforms are at the same single-room feature level).
4. Web pixel pass: `chyme-live-shell` is aligned to `design/.../survivor-hub/Chyme.tsx`, using lucide-react iconography in place of emoji glyphs. Loading and empty states render inline. The signed-out visitor state is now delivered: `components/chyme/chyme-public-shell.tsx` renders the public view aligned to `design/.../survivor-hub/ChymePublic.tsx` (desktop) and `MobileChymePublic.tsx` (phone width), and the plugin route shows it to anonymous visitors instead of the access-denied wall. The public view is marketing/empty-state content only — it shows no private or per-user data, and because there is no public room-listing endpoint, the room list renders an honest empty state rather than the mockup's placeholder rooms. Its sign-in and join affordances point at the hosted sign-in URL.
5. Android pixel pass: `ChymeRoom.tsx` (and sub-components `chyme-loading`, `chyme-empty`, `chyme-room-list`, `chyme-chat-view`, plus the live `ChymeAudioRoom.tsx`) is aligned to `design/.../survivor-hub/MobileChyme.tsx`, `MobileChymeEmpty.tsx`, `MobileChymeLoading.tsx`. A canonical `api.ts` entry-point was added. All data is bound to real `/api/chyme/*` endpoints. The static in-room stage (`chyme-active-room.tsx`) was replaced by the live `ChymeAudioRoom.tsx` (Stream Video) on 2026-06-08. The public state (`MobileChymePublic.tsx`) is not applicable — Chyme is auth-only per the #102 visibility decision. Delivered 2026-05-31; live audio added 2026-06-08.
7. **Back Channel** (spec #1746) is delivered on **web and Android in the same change** (Chyme is on the native keep-list, rule 105). Web: a "Back Channel" action on each other member's participant tile (next to Tip), an incoming-invite toast, and a floating active-call mini-panel that keeps the room usable behind it (`components/chyme/chyme-back-channel*.tsx`, driven by the `useBackChannel` poll hook). Android: the same tile action, a bottom-sheet incoming invite (`ChymeBackChannelInviteSheet.tsx`), and a full-screen active call (`ChymeBackChannelCall.tsx`, driven by `useChymeBackChannel`) that reuses the Chyme Android foreground service so a backgrounded call keeps playing. Both platforms mint a Stream Video 1:1 audio call (`default` call type, audio-only) via `createChymeBackChannelCredentials`. **On-device verification (real EAS build, not Expo Go) that a backgrounded Back Channel keeps audio is a required release gate** — see the Android app test script (step AN-BC) and the Chyme test-script Back Channel section.

9. **Moderation controls (2026-09-19)** are delivered on **web and Android in the same change**:
   the tile actions (Mute, Remove, Let speak / Listening), the speak-mode switch, the listener's
   microphone notice, and the hand-raise notice under the room. Web-only by nature: the Removed
   members section on the admin screen.
8. **Stream quota meter, caps, and notices (2026-09-19)** are delivered on **web and Android in the
   same change** for the member-facing parts (the "N of M" count, the quota notice under the room,
   the room-full refusal on join, the Back Channel pause) — Chyme is on the keep-list. Web-only by
   nature: the signed-out listener path (guest identity, heartbeat, leave, refusal reasons), the
   connection-aware Join pill (Android's foreground service already keeps the call alive), and the
   admin usage screen (admin surfaces are web-only).
6. Scope (MVP): the shipped product is a single shared room (`CHYME_MAIN_ROOM_KEY` / "Chyme Main Room: Exit the Gauntlet") plus the hardcoded contributor room (`CHYME_CONTRIBUTORS_ROOM_KEY`, 2026-07-23). The full-featured `Chyme.tsx` design — multiple rooms, room creation ("Start a Room"), discovery, upcoming/scheduled rooms, search, reactions, and speaker-vs-audience promotion with raise-hand — is the accepted design target and is **not yet built**. The pixel passes above aligned the single-room view's styling and iconography to the mockup; they did not implement the mockup's multi-room feature set. See "Gaps and Known Technical Debt".

## Seed Coverage Status

Rule requirement: deterministic plugin seed script for manual validation in dev environments.

Current status:

- Deterministic Chyme seed script is present under `ctf/scripts/seedChyme.mjs`.
- Validation and release evidence live in `ctf/docs/testing/CHYME_FIRST_TEST_PASS.md` and `ctf/docs/quota-impact/2026-04-05-chyme-phase0-remediation.md`.

## Gaps and Known Technical Debt

Reviewed in full on 2026-09-19 (owner directive: Chyme is one third of the Peace Battle 2 protest;
close the gaps and remedy the debt). Each item below says whether it is closed, open as a product
decision the owner has not made, or owned elsewhere. Nothing here is code work left undone.

1. **Owned elsewhere — full-account delete lifecycle is request-first.** Terminal completion depends
   on the shared account-deletion orchestrator (`lib/account/deletion-orchestrator.ts`), which is
   the account area's, not Chyme's. Chyme's part (its own tables, the Stream copy via
   `deleteChymeStreamData`, the Back Channel rows) is complete.
2. **Closed (2026-09-19) — admin tooling and moderation.** The Live Audio Usage screen
   (`/admin/chyme`) and, the same day on the owner's decision, moderation controls: mute, remove
   (kept out until let back in), speaker-vs-listener grant in hand-raise mode, and the speak-mode
   switch, on web and Android (Admin Features 3–4, User Features 16–17). What remains true: the
   call-side enforcement of hand-raise mode needs `CHYME_GUEST_STREAM_ROLE` (already configured for
   guests) — without it the apps enforce the mode alone; and a Stream outage during an action is
   reported to the admin, not retried.
3. **Closed (2026-09-19) — no app-level minute metering.** The 2026-06-01 quota note recorded that
   the app had no participant-minute signal and the Stream dashboard was the only source of truth.
   `stream_video_usage_daily` is credited from every presence heartbeat (members, guests, Back
   Channel), summarized by `lib/stream-quota/usage.ts`, shown on `/admin/chyme`, and acted on by
   `lib/stream-quota/policy.ts`. Since the same day every other Stream Video call is credited too
   (owner decision: the app's meter is the only one read): Beacon publishers, PeerProgramming cohort
   calls, and Foundation calls are credited from Stream's `call.session_participant_left` webhook
   (`lib/stream-quota/webhook-usage.ts`, handled by the Beacon webhook route, which is the one URL
   Stream sends every call event to), exact per participant. What remains true: the Chyme lines are
   estimates good to one heartbeat interval per participant per session, and Beacon's HLS viewers
   never join a call so they are not participant-minutes. Stream's dashboard stays the bill of record.
4. **Closed (2026-09-19) — no room cap, no guest cap, no quota-driven degradation.** Rule 110's
   bands existed as prose only. The room cap, the guest cap, the Orange-band pauses (guests, Back
   Channel), the Red-band cap, and the member notices are all in force (User Features 12, Security 9).
   The caps are soft in one respect: a member counted present only by a fresh row (their Stream
   connection already dropped) still holds a spot until the 45s window lapses.
5. **Closed (2026-09-19) — one Stream guest user per page load.** The public room read used to
   `upsertUser` a fresh `chyme-guest-<random>` on every load, before the visitor tapped anything.
   The read now touches nothing on Stream; the tap mints one identity per browser (User Features 14).
   Whether Stream counts an upserted-but-never-connected user toward Chat MAU was never confirmed;
   the change removes the question rather than answering it.
6. **Closed (2026-09-19) — the web "Joined" pill did not follow the connection.** User Features 13.
7. **Closed (2026-09-19) — `chyme_rooms.call_active` only ever went true.** `leaveRoom` now clears
   it when the last fresh member leaves. Nothing reads it for "live" (fresh presence is), so this is
   hygiene for whoever reads the table next, not a behavior change.
8. **Owner decision (2026-09-19) — multi-room platform, scheduled rooms only.** The MVP runs one
   open room plus the private Weavers room, and now shows what is scheduled (User Features 15) by
   reading the TI Radio guide. The rest of the `Chyme.tsx` design — room directory, room creation,
   a room per slot, search, reactions — is deferred by the owner until usage justifies it. There are
   no create-room, list-rooms, search, or reaction routes. The plugin registry reflects this as
   `implemented_shell`.
9. **Closed by design (2026-09-19) — no in-app deletion entry point inside Chyme.** The Chyme
   buttons were removed on 2026-06-01 on purpose; the account area's Account & Data screen is the one
   place a member deletes a service or the whole account, and `DELETE /api/account/chyme-profile`
   remains wired there. Chyme does not need its own control.
10. **Owner's Stream configuration, done — guest listen-only server-side enforcement.** The code
    assigns `CHYME_GUEST_STREAM_ROLE` when set (2026-06-26); the owner applied the role and the
    call-type grants on 2026-09-18 (`ctf/docs/quota-impact/2026-09-18-stream-guest-listener-setup.md`).
    Client-side enforcement stays as the second layer.
11. **Release gate, not code — Android background audio verification.** The foreground service is
    configured (2026-07-20); whether audio and presence survive backgrounding is confirmed only on a
    real device from an EAS build (test script CH-10, CH-16). Same for a backgrounded Back Channel.
12. **Known limit — the per-IP rate limiter is per process.** `lib/security/rate-limit.ts` counts in
    one Node process's memory (resets on deploy; counts per instance). It is the brake on the public
    reads and the listen/heartbeat/leave writes; the guest cap, which is what bounds Stream cost, is
    in Postgres and shared. A shared-store limiter is the next step only if the public routes are
    abused in a way the cap does not already bound.
13. **Known limit — web presence needs a foreground tab.** No web API holds a live WebRTC call in a
    backgrounded or locked page (the keep-alive hook holds a screen wake lock while foreground). A
    member holding the room open from a browser is present while the screen is on and the tab is
    front; the pill and the line under the stage now say so when that stops being true. The Android
    app's foreground service is the answer for a long sit.

## Change Log

- 2026-09-20: **The room's count says how many people are in it, not how many of them have
  accounts.** Owner report: the signed-out page read "Listening live · 1 member in the room" while
  the reader was in the room too and the stage right under it showed two tiles. The count was the
  member roster alone, so it under-reported the room by exactly the person reading it, and with a
  larger audience it would have been wrong by the size of that audience. Members and guests are now
  counted separately and both are named. The listener's line reads "2 in the room · 1 member,
  1 guest", falling back to the plain "1 member in the room" when nobody signed out is listening,
  and to "1 guest listening" when nobody has joined the call yet; the tap-to-listen button ahead of
  it uses the same line in place of the old on-stage count. Two new helpers in
  `lib/chyme/capacity-line.ts` hold the wording: `chymeAttendanceLine` for the listener's line, and
  a third argument on `chymeParticipantLine` so the member room's header names guests after the
  capacity part ("1 participant · 1 guest listening") rather than folding them into the "N of M" —
  the cap in that line is the member cap, and guests are capped separately, so adding them together
  would misstate both. `ChymeRoomResponse` carries `guestCount` (0 for any room other than the
  public main room, the only one a guest can reach) and the Android room list mirrors the same
  line. The listener's numbers stay current without a polling loop: the listen answer and every
  35-second heartbeat now carry the counts, so the line counts this listener from the moment they
  are admitted instead of waiting for a page refresh. No schema change; `chyme.public.heartbeat`
  and `chyme.room.read` gained output fields in the command contracts.

- 2026-09-20: **The signed-out page fits one screen: a sideways schedule, a closed room chat, and
  the invitations card floated off the page.** Owner report: Chyme had too much going on, and the
  invitations row on top of it read as part of Chyme. Three changes, no new data and no route
  change. (1) `chyme-upcoming.tsx` draws the booked slots as a horizontal rail of 170px cards with
  the same scroll and snap behavior as the rooms rail above it, instead of a stacked list that put
  five full-width rows — most of a phone screen — under the room. Both web surfaces get it; the
  Android Upcoming tab keeps its stacked list, because there the schedule owns a tab and a screen
  rather than a strip under the room. (2) `ChymeGuestChat` starts closed, as one row a visitor taps
  to open (`aria-expanded` / `aria-controls`, chevron, "read what members are saying"); the
  ten-second poll starts on the first open, so a closed chat reads nothing from
  `GET /api/chyme/public/messages`. Open, it is the same read-only panel with the same 40vh cap and
  the same "Sign in to chat" link. (3) The invitations row is no longer rendered above the plugin —
  see the non-plugin inventory 1.15; on Chyme it was a block of invitation cards before anything
  about Chyme. Net: header, invitation card, live room, the tap-to-listen control, the chat row and
  the schedule fit one phone screen; the participant list and the chat are what scroll. Test script
  CH-7 and CH-22 updated. No schema, route, or contract change.
- 2026-09-19: **The guest listen-only role carries hand-raise mode too, and the records now say so.**
  The role named by `CHYME_GUEST_STREAM_ROLE` is given to a member an admin moves to listening, not
  only to a signed-out guest, so the runbook
  (`ctf/docs/plugins/chyme/guest-listener-stream-role.md`), the setup script, and the workflow no
  longer say members are unaffected by it. Nothing about the target state changes: a listening member
  wants the same grants a guest wants, join and hear but never publish, so the existing "Stream —
  Guest Listener Setup" workflow already applies and weekly-checks what both need, through Stream's
  APIs rather than dashboard clicks. What is newly written down is how far a drift reaches — a
  missing `join-call` grant drops a listening member as well as refusing every guest — and the
  runbook gains a "What hand-raise mode adds" section. Docs only; no code, schema, route, or
  contract change.
- 2026-09-19: **Moderation controls: mute, remove, let back in, and hand-raise mode with speaker
  grant.** Owner decision the same day, answering the open question of whether the room should have
  a moderator. Server: `chyme_rooms.speak_mode`, `chyme_room_removals`, `chyme_admin_audit_trail`
  (migration `0030`); `lib/chyme/moderation.ts` (the database half), `lib/chyme/stream-moderation.ts`
  (the call half, on `@stream-io/node-sdk` — new dependency — mute, block, unblock, member role),
  `lib/chyme/admin-audit.ts` (durable trail); six routes under `/api/chyme/admin/`; the room read
  carries `speakMode` and `viewer`; join and heartbeat answer 403 while a removal stands, and an admin
  joins as a speaker. Web: `chyme-moderation.tsx` (tile actions, speak-mode switch, listener notice),
  `chyme-controls.tsx` takes a microphone-control override and an extra slot, the admin screen gains
  Removed members. Android: `ChymeModeration.tsx` and the same wiring in `ChymeAudioRoom.tsx`,
  `ChymeApi.ts`. Contracts: five commands plus the removals read, access policies, audit events.
  Quota note `ctf/docs/quota-impact/2026-09-19-chyme-moderation-stream-controls.md`. Test script
  CH-23 and CH-A3. Gaps item 2 closed. Account deletion: `chyme_room_removals` rows are deleted
  with the member's account and `chyme_admin_audit_trail` is retained (deletion registry and the
  deletion contract). The SDK's package `postinstall` runs `husky` when it can resolve it, which
  broke a clean CI install; pnpm `neverBuiltDependencies` skips that script.
- 2026-09-19: **The minute meter covers every Stream Video call.** Owner decision: the app's meter
  is the only one read; the Stream dashboard is not. Beacon publishers, PeerProgramming cohort
  calls, and Foundation calls are now credited to `stream_video_usage_daily` from Stream's
  `call.session_participant_left` event (`duration_seconds`, one participant's time in the call),
  through the Beacon webhook route — the one URL Stream sends every call event to — and
  `lib/stream-quota/webhook-usage.ts`, which maps the call id to a surface and skips Chyme and Back
  Channel (their heartbeats already feed the meter). `/admin/chyme` labels the new lines. Unit
  tests cover the mapping and the payload read. No schema or contract change; quota note
  `2026-09-19-stream-video-meter-all-calls.md`.
- 2026-09-19: **The cap is an advisory, and the signed-out page stops saying "listening" before the
  tap.** Two owner reports from the phone. (1) "1 of 50 participants" under the room name all day
  read as a claim — that the room is capped at 50, or that 50 people ought to be there. The line is
  now the plain count and names the cap only from 80% of it ("40 of 50 participants · nearly full")
  and at it ("· full"), on web (`lib/chyme/capacity-line.ts`, with unit tests) and Android
  (`chyme-room-list.tsx`). The refusal at the cap is unchanged. (2) The signed-out page said
  "You're listening live — sign in to speak" above the Tap to listen button, before any sound was
  on; it now reads "The room is live. Tap below to listen; sign in to speak." and the listener
  component says "Listening live" itself once joined. Test script CH-7 and CH-20 updated. No
  schema, route, or contract change.
- 2026-09-19: **Scheduled rooms, MVP: Chyme shows what is coming up on the TI Radio guide.** Owner
  decision the same day, answering the multi-room question: the schedule only, everything else
  later, no usage to justify more. `components/chyme/chyme-upcoming.tsx` reads
  `GET /api/ti-radio/guide` client-side (the plugin boundary forbids a server import), keeps the
  booked slots that have not ended, soonest first, capped at five, and prints them in the reader's
  timezone with an "On air now" mark; mounted under the rooms rail on the member view and under the
  room list on the signed-out page. Android: the room list's Upcoming tab (`chyme-room-list.tsx`,
  `getChymeUpcoming` in `ChymeApi.ts`) replaces its placeholder sentence with the same list. Unit
  tests cover the slot pick and the day/time label. No schema, route, or contract change; the TI
  Radio inventory's "Chyme does not read this schedule" gap is closed. Test script CH-22 added.
- 2026-09-19: **Stream Video minute meter, room and guest caps, quota-driven pauses, one guest
  identity per browser, and a Join pill that follows the connection.** Owner question on the day:
  does holding the main room open around the clock, alone, burn too much of the Stream quota? The
  arithmetic said no (1,440 minutes a day, about 13% of the 333,000-minute month), but the code
  review behind the answer found that none of the guard rails the owner remembered existed: rule
  110's bands were prose, there was no minute meter, no participant cap, no quota-driven
  degradation, no member notice, and the public page minted a fresh Stream guest user on every
  load. All of that is now built. (1) `stream_video_usage_daily` is credited from every presence
  heartbeat — members (`touchRoomPresence`, `markRoomCallJoined`, `setRoomMemberHandRaised`),
  guests (new public heartbeat), Back Channel (twice the gap, two participants) — each capped at
  the presence window; `lib/stream-quota/usage.ts` summarizes the month against
  `STREAM_VIDEO_MINUTES_BUDGET` (default 333,000) and `lib/stream-quota/policy.ts` turns the band
  into caps and pauses (Yellow: notice; Orange: guests and Back Channel paused; Red: room cap
  drops to `CHYME_RED_BAND_MAX_PARTICIPANTS`). (2) `POST /api/chyme/join` answers 409
  `CHYME_ROOM_FULL` at the cap (`CHYME_MAX_PARTICIPANTS`, default 50), checked before the Stream
  mint and again under a lock on the room row; the room read carries `capacity` and `quota`; the
  header reads "N of M"; a notice shows from Yellow up on web and Android; the Back Channel tile
  action hides and the invite route answers 503 `CHYME_BACK_CHANNEL_PAUSED` while paused. (3) The
  public room read no longer mints anything; `POST /api/chyme/public/listen` on the tap admits the
  guest under `CHYME_MAX_GUEST_LISTENERS` (default 100), sets the `ctf_chyme_guest` httpOnly cookie
  (one random id per browser, no personal data), and mints `chyme-guest-<id>`; the page heartbeats
  `POST /api/chyme/public/heartbeat` and posts `POST /api/chyme/public/leave` on close; the roster is
  `chyme_guest_listeners`. (4) The web Join pill follows the Stream SDK's calling state ("✓ Joined" /
  "Reconnecting…" / "Connection lost — leave and rejoin") with the same line under the stage; it used
  to be set once on join and never change. (5) New admin screen `/admin/chyme` (Live Audio Usage)
  over `GET /api/chyme/admin/stream-usage`, with copy-as-text. (6) `chyme_rooms.call_active` is
  cleared when the last fresh member leaves. Migration `0029`. Contracts: `chyme.public.listen`,
  `chyme.public.heartbeat`, `chyme.public.leave`, `chyme.admin.stream-usage.read`. Env keys (all
  with defaults) documented in rule 123. Quota note
  `ctf/docs/quota-impact/2026-09-19-chyme-stream-quota-meter-caps-guest-identity.md`. Gaps section
  rewritten in full. Test script CH-7 updated; CH-20, CH-21, CH-A2 added.
- 2026-09-18: **The signed-out listener can recover sound: a "Tap to hear the room" button when the
  browser blocked playback, and the Silent switch named on screen.** Owner report on the day: the
  tap-to-listen page joined, showed the stage and the chat, and stayed silent. Two causes, both on
  the phone. (1) The audio tracks arrive seconds after the tap and the Stream SDK starts each with
  `play()` outside any gesture; when the browser refuses (its autoplay rule) the SDK records the
  element as blocked. The guest view now reads the SDK's blocked signal (`useIsAutoplayBlocked`) and
  shows one green button whose tap calls `call.resumeAudio()`, which the rule allows. (2) A page
  that only plays and never records is treated like a ringtone on iPhone, so the Silent switch mutes
  it; members never hit this because their microphone capture ignores the switch. The tap now sets
  the page's audio session type to `playback` (the Audio Session API, iPhone Safari 17+), and a muted
  line under the player names the switch and the volume, and retries on tap. Test script CH-7 names
  both. No schema, route, or contract change.
- 2026-09-18: **The signed-out page shows who is on stage, reads the room chat, and drops the locked
  "Start a Room" bar.** Three owner reports from the signed-out phone, the same night as the
  tap-to-listen fix. (1) The member in the room saw the guest on stage, but the guest's own page
  showed no avatars; `ChymeSpeakerAvatar` and `ChymeSpeakerStatusBadge` are now exported from the
  member room and the guest view draws the same "On Stage · N" tiles from the same Stream participant
  list (the guest's own tile reads "You (listening)"; no tip, hand, or Back Channel actions). The
  "Listening live" line now says "N members in the room" from the server count, since the stage count
  includes the listener. (2) A visitor can read the room chat and signs in to write: new read-only
  route `GET /api/chyme/public/messages` (above) and `ChymeGuestChat` under the stage, polling every
  ten seconds, with one "Sign in to chat" link; a failed read shows the route's reason and status.
  (3) The grayed, locked "Start a Room" bottom bar is gone from the signed-out view — a control that
  does nothing is noise to a visitor. (4) The "Live Rooms" label row carries the same refresh button
  the signed-in page has beside Join Room (owner directive: the two screens should match, and the
  installed app on Android has no browser reload); it re-reads the room and the chat, and a listener
  already in the call keeps their guest identity and connection. Test script CH-7 names all four. No
  schema or contract change; one new public read route.
- 2026-09-18: **The signed-out listener taps before the join, so the phone plays the room.** Owner
  report from two phones the same night: with the guest grants applied, the signed-out iPhone joined
  and appeared on stage as "Guest listener", and the member in the room saw it there, but the guest
  heard nothing and got no prompt. The guest page joined on page load, and a phone browser (iOS
  Safari above all) refuses to play sound a page starts on its own; the SDK's audio elements were
  added muted by the browser. Members never hit this because they tap Join. The guest component now
  starts in an idle state with one **Tap to listen** button under the room heading (on-stage count,
  and the line "Phones only play sound after a tap. You will hear the room and cannot be heard."); the
  tap resumes an audio context as the browser's permission to play, then runs the same connect and
  join as before. Test script CH-7 step 2 and its expected text name the button. No schema, route,
  or contract change.
- 2026-09-18: **Every Stream failure in Chyme says what failed and why.** Owner directive, the night
  before a live event: every Stream connection must work and every failure must be diagnosable from
  the phone that hit it. Server side (`lib/chyme/stream.ts`): a Back Channel token that Stream refuses
  now throws with Stream's reason instead of returning null, so the accept and join routes answer
  "Unable to accept Back Channel: <reason>" rather than "Stream service is not configured" (null is
  reserved for Stream being unconfigured); the create-then-watch channel setup names both failures
  when both fail; the message fan-out and the account-deletion cleanup record the reason before
  swallowing it; the room join route answers "Unable to join Chyme call: <reason>". Client side: the
  web and native Back Channel panels show Stream's reason under "Could not connect to the call", and
  the native audio room reports a failed join to Sentry as the web room already did. The reason text
  comes from the new shared helper `lib/shared/stream-error-text.ts` (keeps Stream's message,
  redacts an `api_key` value, caps at 300 characters); the public room route now uses it too. Same
  pass covered Beacon, Foundation, LightHouse, SocketRelay, TrustTransport, Feed, Contributor Access,
  and the shared web and native chat panels (a failed connect is reported and its reason shown). No
  schema or contract change; route error messages gain a reason. Quota note:
  `ctf/docs/quota-impact/2026-09-18-stream-error-verbosity.md`.
- 2026-09-18: **The guest-listener Stream setup is owned by code, with a weekly drift check.** The
  evening's root cause was a Stream dashboard step left undone — the `chyme_listener` role had no
  `join-call` on the `default` call type — and a dashboard step cannot be tested, diffed, or re-run;
  the dashboard also does not work at phone width, which is the only screen the owner has. New
  workflow **"Stream — Guest Listener Setup"** (`.github/workflows/stream-guest-listener-setup.yml`,
  script `ctf/scripts/stream-guest-listener-setup.mjs`) reads the Stream key pairs and
  `CHYME_GUEST_STREAM_ROLE` from Infisical and brings the app to the runbook's target state through
  Stream's APIs: the role exists (Chat API, `listRoles` / `createRole`); on the call type it has
  `join-call` and `read-call`, not the three publish capabilities, everything else untouched (Video
  API, read → update → read back). Three modes: **plan** prints the state and what would change;
  **apply** writes and verifies; **check** — run weekly, Tuesdays 05:52 UTC, production — goes red
  on drift so a half-done setup is caught before a member reports it. Members are unaffected: only
  the named role changes, and only guests carry it. Takes effect on the next page load. Never prints
  a secret; the api key is scrubbed from Stream error text. Quota note
  `ctf/docs/quota-impact/2026-09-18-stream-guest-listener-setup.md`. No app code, schema, route, or
  contract change; runbook, test script CH-8 and the workflow index updated.
- 2026-09-18: **Root cause of the signed-out listen failure recorded: the guest role lacked
  `join-call`.** With the reason line shipped the same evening, the public page read Stream's own
  refusal — the `chyme_listener` role "is not allowed to perform action JoinCall in scope
  'video:default'". `CHYME_GUEST_STREAM_ROLE` had been set and the role created, but the `default`
  call type never got the grant, so every guest since then was minted and then refused while
  members in the room saw nothing wrong. Config, not code: the runbook
  `ctf/docs/plugins/chyme/guest-listener-stream-role.md` gains a section with the exact wording and
  the two ways out (grant `join-call` in the Stream dashboard, or unset the env var). Test script
  CH-8 names the wording. No code, schema, route, or contract change.
- 2026-09-18: **The signed-out page says which of four states it is in, instead of "No public rooms
  right now" for two of them.** Owner report, the same evening as the two fixes above: signed in on
  one device and in the room, the signed-out view showed nothing live. Two silent paths could produce
  that. First, the public route wrapped the live-state read and the guest-identity mint in one catch,
  so a Stream-side failure minting the guest (a role name Stream does not know, a Stream outage) came
  back as a 503 — and the shell treated any non-ok response as "not live" and showed the empty
  state while a member was audibly in the call. Second, a live room with no `credentials` (Stream
  not configured) matched neither render branch and drew nothing at all under the invitation card.
  `GET /api/chyme/public/room` now reads the live state first and returns 503 only when that read
  fails; when the room is live and the mint fails it still answers `ok` / `isLive: true` and puts
  the plain reason in a new optional `listenUnavailable` field, reported to Sentry under
  `public_room_guest_credentials`. The shell's room list is its own component,
  `ChymePublicRoomList`, with four states: the live check failed (says so, with the server's message
  and HTTP status, never "no rooms"); not live (the shipped empty state, unchanged); live and
  listening (unchanged); live but no guest identity (the room heading, "The room is live — sign in
  to join it.", and the reason underneath in the same note style the listener uses). `GuestNote` is
  exported from `chyme-guest-listen.tsx` for that last state. The route's response gains one
  optional field and no existing field changes; there is no contract file for this route and no
  other consumer. Test script CH-7 gains the two new states.

- 2026-09-17: **A signed-out listener no longer dead-ends on "Couldn't connect to the live room."**
  Owner report: the public Chyme page showed the room name, said "You're listening live", and under
  it sat a connect failure whose only advice was to refresh. Three things were wrong with that box
  and all three are fixed in `chyme-guest-listen.tsx` and `chyme-public-shell.tsx`. First, one failed
  attempt ended the visit — there was no retry, so a guest identity that had not propagated yet, an
  SFU mid-reconnect, or a network blip during page load was permanent. The join now runs up to three
  attempts with a widening gap. Second, the room can genuinely have ended: "live" is computed from a
  member's presence row, which stays fresh for up to 45 seconds after their Stream connection is
  gone, so the server hands out a guest token for a call that is no longer there. On the last failed
  attempt the listener re-reads `GET /api/chyme/public/room`; when that says the room has ended it
  tells the shell, which re-reads the room and falls back to the "No public rooms right now" empty
  state instead of leaving a failure under a heading claiming the visitor is listening. That case is
  expected, so it is no longer reported to Sentry as a fault. Third, the reason was thrown away. The
  signed-in room has shown its verbatim Stream error since it was built; the guest path showed a
  fixed sentence, which left a report sent from a phone with nothing in it but that sentence. The
  reason now renders as a second line under the existing text, and the Sentry report carries the call
  type and call id alongside the guest Stream id, matching what the member room already sends. The
  shipped copy is unchanged — the detail line is added under it. No schema, route, or contract
  change; the public endpoint is read as it already existed. Test script CH-7 gains the
  room-ends-while-connecting step and CH-8 records the visible reason.
- 2026-09-17: **The signed-out view asks once instead of three times, and drops the search and tag
  controls that filtered nothing.** Owner report: the same Sign In / Join pair sat in the green
  header, on the invitation card, and in the bottom bar — one page putting the same request in front
  of a visitor three times before they had read what the room is. The invitation card keeps it,
  because it is the only one of the three that says what signing in gets you ("Listen in for free.
  Sign in to speak, react, or host your own room."). The header is now the back control and the
  title; the bottom bar keeps only the grayed, locked **Start a Room**, which is not a sign-in
  control but the statement that hosting needs an account. The `verifyUrl` variant collapses the same
  way: a member part-way through Unlock sees one **Finish verifying** link, on the card. Second part
  of the same report: the search box and the Healing / Economy / Housing / Legal / Skills tags are
  gone. There is one public room — the main room, since the Weavers room is private and never
  appears here — so both controls offered to narrow a list of one, and neither did anything if
  tried: the input was `readOnly` and the tags were plain spans with no click handler. They belong
  back on this page when it lists more than one room, and at that point they need real search and
  filter behavior rather than to be un-hidden, because none is built. `chyme-public-shell.tsx` only,
  which is the signed-out surface — the signed-in shell and the Android room list are untouched. No
  schema, route, or contract change. Test script CH-7 now counts the sign-in affordances and checks
  that the search box and tags are absent.

- 2026-09-15: **The disclaimer says endorsement, not recommendation.** Owner directive. A recommendation is a soft opinion a reader is free to weigh, and disclaiming one concedes that this project was offering an opinion in the first place. What a reader takes from a published schedule under this project's name is that the project stands behind the people on it, and that is the thing being denied. The short form on all three Chyme surfaces — signed out, signed in, and the Android room list — swaps the one word; the long form on the TI Radio guide also spells out that this project does not vouch for a host or for what gets said in their room. One string in `@ctf/shared`, so the four surfaces changed together, and the constant has been named `HOSTING_NOT_ENDORSEMENT` since it was written, so the copy now agrees with the code. The manual test script checks the new wording. Copy only — no schema, route, or contract change.

- 2026-09-14: **Both the signed-out and signed-in room surfaces say a host is not endorsed.** Chyme's public shell is readable without an account, so a visitor can land on a live host having seen nothing about how they got there — and with TI Radio now publishing a schedule of who is hosting when, more people arrive that way than before. Two placements, and the first draft got one of them wrong in a way worth recording: the statement was put inside the signed-out shell's `live.isLive` branch, where it rendered **only to somebody already listening**, who is the one person least in need of telling. A visitor arriving from the TI Radio schedule usually reaches the page *before* the room goes live, reads "Listen in for free", and saw nothing. It now sits on the always-visible invitation card, so it is on screen in both states. The signed-in shell (`chyme-shell.tsx`) had nothing at all — a member reads the same public schedule and the same question applies — so it carries the statement in a line under the rooms rail, rather than on a card inside it, because the rail is a horizontal scroller of fixed-width cards that a sentence does not fit. **The Android room list carries it too** (Chyme is on the keep-list, rule 105), under the room list so it reads as a note about what the list is rather than a warning about the room above it. That moved the string out of the web package: it now lives in `@ctf/shared` (`packages/shared/src/copy/hosting-disclaimer.ts`), which mobile and web both already import. Retyping it into the mobile package would have created a second wording free to drift, which is the exact failure the single string exists to prevent, so the string crosses the package boundary instead of the text being copied. All four surfaces — Chyme signed out, Chyme signed in, Chyme on Android, and the TI Radio guide — now read from that one file. Not a safety claim, on purpose. Copy only — no schema, route, or contract change, and nothing about who may listen or speak has moved.


- 2026-08-24: **The signed-out Chyme view scrolls as a page, and its never-rendered desktop layout is
  gone.** The guest shell was pinned to exactly one viewport (`height: 100dvh; overflow: hidden`) with
  the room list scrolling inside it, so the document never scrolled and Safari's "Full Page"
  screenshot stopped after one screenful. It is now `minHeight: 100dvh` with no inner scrollbox, and
  the green header keeps its always-visible behavior with `position: sticky`. Same file also drops
  `DesktopChymePublic`: since the mobile-first switch (2026-07-20) it was hidden by CSS at every
  width, so it rendered for nobody — with it gone, the `.ctf-bp-desktop` / `.ctf-bp-mobile` helpers in
  `globals.css` had no users left and were removed too. Signed-in Chyme is untouched (it already used
  `minHeight`). No API, schema, or contract change; Chyme test script CH-7 updated to match.
- 2026-08-18: **"Get the Android app" card links to the filtered Releases view (owner request).** The Releases page now also carries `wallpapers-v*` releases, so the newest APK no longer sits at the top of the unfiltered page — a non-technical visitor had to scroll and work out which release was the app. The card's link adds `?q=mobile`, so the page opens showing only the `mobile-v*` releases with the newest APK first. `chyme-shell.tsx` constant only; Chyme test script step updated to match. No schema, route, or contract change. Verified: `@ctf/web` typecheck + eslint clean.
- 2026-08-02: **Deletion burn-down batch 2: the back-channel call log joins the deletion registry.**
  On account deletion, `chyme_back_channel_calls` rows where the member was the initiator or the
  recipient are deleted. Both sides are hard-deleted rather than pseudonymized: the ephemeral call
  row has no history surface either party revisits, and the table's no-self CHECK would be violated
  once both parties of one call deleted their accounts under a shared placeholder.
  `ended_by_user_id` is always one of the two parties, so the two deletes clear every row naming the
  member. Caught by the deletion-coverage gate added in #2056. Contract updated to match.
- 2026-07-24: **Audio room no longer prompts for camera permission (audio-only).** Chyme is audio-only and never publishes video, but the room, the Back Channel 1:1 call, and the native Android room all called `activeCall.join()` **first** and only disabled the camera afterward — so the Stream Video SDK requested a video track during join and the browser/OS fired a camera prompt (iOS Safari and a saved-to-home PWA prompt the moment a video track is requested; the prompt showed no reason, which was off-putting). Reordered so `camera.disable()` runs **before** `join()` in `chyme-audio-room.tsx`, `chyme-back-channel-panel.tsx`, and the native `ChymeAudioRoom.tsx` — mirroring the guest listen path, which already did this and never prompted. The room and native room also disable the mic before join now, so they join muted and the **mic** permission is only requested when the member presses Unmute (listen-first); the Back Channel still enables the mic after join because a 1:1 call is a conversation. No camera is ever captured. No schema/route/contract change. Verified: `@ctf/web` and `@ctf/mobile` typecheck + eslint clean.
- 2026-07-23: **Android parity — room chat Delete + Edit (delete + repost) (#1858).** The web room chat gained Delete + Edit earlier today (#1854); this brings the native Android Chyme room chat to parity (Chyme is a keep-list Android surface, rule 105). `chyme-chat-view.tsx` now renders **Edit** and **Delete** under the member's **own** messages only (`item.userId === currentUserId`, where `currentUserId` is derived from the joined Stream user id `chyme-<clerkUserId>`). Delete is confirm-gated (a native `Alert`); Edit loads the text into the composer and deletes the original (there is no in-place edit — a fix is a fresh row with a new id/timestamp). `ChymeRoom.tsx` adds `handleDeleteMessage` (optimistic remove, restore + alert on failure) and `handleEditMessage` (set composer text + delete), mirroring the web handlers. New API client `deleteChymeMessage(messageId)` in `ChymeApi.ts` calls the existing author-only `DELETE /api/chyme/messages/[messageId]` (CSRF-guarded) — **no new route, schema, or contract**; the server side already shipped with #1854. Verified: `@ctf/mobile` typecheck runs in CI (mobile deps are not installed in the sandbox).
- 2026-07-23: **Room chat gets Delete + Edit (delete + repost), matching the Commons home chat.** The Chyme Room Chat had no per-message controls — a member could not remove or fix their own message. Added `DELETE /api/chyme/messages/[messageId]` (author-only via `deleteRoomMessage`, which checks ownership → 403 for someone else's message, 404 for a missing id, 400 for a non-UUID), room-scoped via `?room=` and CSRF-guarded, audit `chyme.message.delete`. Web UI (`chyme-chat-panel.tsx`): **Edit** and **Delete** actions on the member's own messages only. As in the Commons, there is no in-place edit — Edit loads the text into the composer and deletes the original, so a fix is a fresh row (new id/timestamp); Delete confirms then removes optimistically (restored on failure). Wired through `chyme-live-shell` (`handleDeleteMessage`/`handleEditMessage`) → `chyme-room-view` → `chyme-chat-panel`. The displayed chat is DB-backed, so the delete removes the row shown; the Stream fan-out copy has no per-message id stored (full Stream purge remains on service/account deletion). No schema change. Web client only; Android parity for the native Chyme room chat is deferred and tracked in #1858 (Chyme is a keep-list Android surface per rule 105 — not out of scope). Verified: `@ctf/web` typecheck, lint, a11y lint, and `build:ci`. Owner-review lane (data deletion + new API route).
- 2026-07-23: **Room chat no longer scrolls sideways (bug fix).** A message containing a long unbroken string (e.g. a pasted URL) widened the room-chat window and let it scroll left/right. The message text now wraps long strings (`overflow-wrap: anywhere` / `word-break: break-word`, keeping line breaks with `pre-wrap`) and the message list has `overflow-x: hidden`, so the chat window only ever scrolls up and down. `chyme-chat-panel.tsx` only — no schema/route/contract change. Verified: `@ctf/web` typecheck + eslint clean.
- 2026-07-23: **"Get the Android app" card now links to GitHub Releases (owner decision).** The rooms-rail Android card previously rendered only when the `NEXT_PUBLIC_CHYME_ANDROID_APP_URL` build variable was set (no URL was committed). The owner set the destination: the APK is downloaded from the repo's **GitHub Releases** page only (`https://github.com/chargingthefuture/chargingthefuture/releases`) — not an app store. The card now links there directly and always shows on non-Android browsers (still hidden on Android); the env var is removed. `chyme-shell.tsx` only. Verified: `@ctf/web` typecheck + eslint clean.
- 2026-07-23: **Rooms rail, no-disconnect room switch, and in-room controls moved below the avatars (web, owner request).** Three connected UX fixes on the Chyme shell. (1) **No disconnect on room switch.** The shell used to render `ChymeLiveShell` keyed by `roomScope`, so switching between the Main Room and the private Weavers room **remounted** the shell and tore down the live WebRTC audio call — a member speaking in one room was dropped the moment they peeked at the other. Now `ChymeShell` keeps every room the member has opened mounted and toggles which one is visible with `display:none`; a hidden room's call stays alive, so switching never disconnects. The Main Room is mounted from the start; the private room mounts the first time it is opened. (2) **Rooms rail.** The old stacked room card (which repeated the room title and ate a full card of vertical space on phones) is replaced by a horizontal, left-to-right scroller of compact room cards; `ChymeSidebar` is slimmed to just the Join/refresh action row (the duplicate title is gone). A **"Get the Android app"** card renders in the rail on non-Android browsers and links to the repo's GitHub Releases page (`https://github.com/chargingthefuture/chargingthefuture/releases`), where the APK is downloaded (owner decision 2026-07-23 — APK via GitHub releases only); on Android the card is hidden and the rail is just the list of rooms. (3) **Controls placement.** In `ChymeAudioFrame` the mute / raise-hand / leave controls now sit directly **below** the participant avatars and **above** the room chat (they were above the avatars), so a member can mute/unmute mid-conversation without scrolling. Web-client only — no schema, route, or contract change. Verified: `@ctf/web` typecheck + eslint clean.
- 2026-07-23: **Private "Weavers of the Commons" Chyme room for contributors (web, audio + chat MVP).** The contributor "Weavers of the Commons" status already grants a private Commons chat channel; it now also grants a private Chyme audio room. A second room, `chyme-contributors-room`, is reachable from an in-shell room switcher next to the main room. Gated exactly like the Commons gated channel via a new `requireChymeContributorAccess` (standard `approved_full` Chyme gate **plus** the contributor channel-open switch and the member's eligibility flag, or admin); a non-eligible member gets a bare 404 and the switcher shows the "how it's earned" explainer (`WeaversBadge` + `/apps/directory/weavers-of-the-commons`) — the same no-shaming pattern, never a locked/absence state. Implementation: the Chyme repository room helpers were generalized (`ensureMainRoom` → `ensureRoom(roomKey)`; `getRoomState`/`listRoomMessages`/`sendRoomMessage`/`markRoomCallJoined`/`touchRoomPresence`/`setRoomMemberHandRaised`/`leaveRoom` take an optional `roomKey`, default main); `createStreamJoinCredentials`/`ensureChannel`/`sendChymeStreamMessage` take a channel id (= room key) so each room has its own Stream chat channel; the room/join/messages/heartbeat/hand/leave routes resolve a `?room=contributors` scope via `requireChymeRoomAccess`; and the client threads `roomScope` (`ChymeShell` → `ChymeLiveShell` → `ChymeRoomView` → `ChymeAudioRoom`, keyed by scope). `markServiceDeletion` now clears the member across **all** rooms (keyed on user_id) so the private room is covered. **MVP scope:** audio + room chat only — ServiceCredits tips and Back Channel are main-room only for now (Back Channel invites are scoped to the main room's presence); disabled in the private room and noted as a follow-up. No schema change (the `chyme_rooms` table already supported multiple rooms). Web-only (Android narrowed to Chyme main room per rule 105). Verified: `@ctf/web` typecheck, lint, a11y lint, and `build:ci` clean. Owner-review lane (adds an access gate).
- 2026-07-23: **Web audio now holds a screen wake lock + Media Session presence while a call is joined (closest web gets to Android's background audio).** Android keeps a Chyme call alive when the app is backgrounded via a native foreground service (2026-07-20); the browser has no equivalent — no web API can hold a live WebRTC call in a fully backgrounded or screen-locked page. New shared hook `components/chyme/use-audio-call-keep-alive.ts` does what the web platform can: while the call is joined **and the tab is foreground**, it (1) holds a **Screen Wake Lock** so the display doesn't sleep (a sleeping screen suspends the page and drops the call) — re-acquired on `visibilitychange` because the browser auto-releases it when the page hides; and (2) publishes **Media Session** metadata + a `playing` playback state so the OS/browser treats the audio as active (lock-screen/media-key presence, audio prioritized). Everything is feature-detected and no-ops on unsupported browsers (older Safari). Wired into all three joined audio surfaces: `chyme-audio-room.tsx` (`status === 'joined'`), `chyme-guest-listen.tsx` (guest listen-only), and `chyme-back-channel-panel.tsx` (1:1 Back Channel). Web-client only — no schema, route, or contract change; the presence heartbeat is unchanged. This does **not** match Android's "leave the app and keep talking" — it keeps the call solid while the tab is open and the screen is on. Android: out of scope (this is a web-only capability gap; the native app already has the stronger foreground-service behavior). Verified: `@ctf/web` typecheck, lint, a11y lint, and `build:ci` all clean.
- 2026-07-20: **Back Channel — free 1:1 audio sidebar inside a live Chyme room (spec #1746), web + Android.** A member can start a casual 1:1 audio call with another member who is in the same room right now, from the participant tile (next to Tip). Consent-gated (invite → accept; declining sends nothing back), block-aware (`isBlockedBetween`, `403` + hidden action either direction), room-bound (an invite lapses when either party leaves or after ~45s), and free (no ServiceCredits — a Foundation note on every call surface points paid consultations to Foundation). Nothing DM-shaped: no history, no re-contact, no text; a live call is a distinct Stream Video 1:1 audio call (`default` type, audio-only) via `createChymeBackChannelCredentials`, kept alive by a heartbeat and reaped after ~90s if both apps stop beating. Private: excluded from Trust evidence, feeds, and all public surfaces (rule 132). New table `chyme_back_channel_calls` (removed on Chyme service/account deletion). New routes under `/api/chyme/back-channel/` (`state`, `invite`, `accept`, `join`, `decline`, `leave`, `heartbeat`) with audit commands `chyme.back-channel.{invite,accept,join,decline,leave}`. Web: `chyme-back-channel*.tsx` + `useBackChannel` wired into `chyme-audio-room.tsx`; `bc-pulse`/`bc-float-in`/`bc-toast-in` keyframes in `globals.css`. Android (keep-list, rule 105): `ChymeBackChannelInviteSheet.tsx`, `ChymeBackChannelCall.tsx`, `useChymeBackChannel.ts` wired into `ChymeAudioRoom.tsx`, reusing the Chyme foreground service so a backgrounded call keeps playing. Contracts + this inventory + the Chyme and Android test scripts updated. Verified: `@ctf/web` and `@ctf/mobile` typecheck clean. **Release gate:** on-device background-audio check for a Back Channel (real EAS build) is required before "proven" — same class as the room's AN-4/CH-10. Built from the Replit handoff (`BACK_CHANNEL_HANDOFF.md`) as intent, recreated with the app's existing components/tokens per the production-era design policy.
- 2026-07-20: **Deletion now removes the member's Stream copy — via a shared external-cleanup hook (privacy).** Chyme dual-writes every chat message: to `chyme_messages` and, via `sendChymeStreamMessage`, to the Stream channel. Deletion only ever purged Postgres (the account-deletion registry/orchestrator is DB-table-only), so a member's message content lingered on Stream indefinitely after they deleted their profile or account (Stream retains messages with no expiry by default). Added `deleteChymeStreamData(userId)` in `lib/chyme/stream.ts` (hard-deletes the Stream user `chyme-<userId>` with `mark_messages_deleted`; never throws). Rather than patch it into individual routes, added a **systemic seam**: `lib/account/external-cleanup-registry.ts` maps plugin slug → external cleanup, and the orchestrator (`deletion-orchestrator.ts`) runs it **after** the DB transaction commits, best-effort (`reportError` on failure, never rolls back the deletion). This covers every whole-account entry point at once — the full-account route, the internal delete route, and the Clerk webhook — closing the hole a route-only fix would have left on the Clerk/internal paths. The bespoke `DELETE /api/account/chyme-profile` route (which uses `markServiceDeletion`, not the orchestrator) calls `deleteChymeStreamData` directly. **The same seam is how the other Stream-chat plugins (Foundation, Lighthouse, SocketRelay, TrustTransport) and Beacon will be fixed — follow-ups register their own cleanup here.** No schema/route/contract-shape change. Verified: `@ctf/web` typecheck + eslint clean, EOF clean.
- 2026-07-20: **Android live audio now survives backgrounding (owner hard requirement).** A member who
  navigates away from the Chyme room without closing — or locks the screen — must not be dropped from
  the call. Enabled the Stream Video React Native SDK's documented Android foreground service: (1) added
  `@notifee/react-native@9.1.8` to `ctf/packages/mobile/package.json` (the package the SDK uses to run
  the service; matches the SDK's own pinned version and its `>=9.0.0` peer requirement), lockfile
  updated and resolved with no unmet peer error; (2) changed the `@stream-io/video-react-native-sdk`
  Expo config-plugin entry in `app.config.ts` from the bare string to the array form
  `['@stream-io/video-react-native-sdk', { androidKeepCallAlive: true }]`, which at prebuild writes the
  foreground-service permissions (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`,
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`) and the `app.notifee.core.ForegroundService`
  declaration; (3) added a one-time `StreamVideoRN.updateConfig({ foregroundService: { android: { channel:
  { id: 'chyme-audio', name: 'Chyme live audio' }, notificationTexts: { title, body } } } })` at module
  load in `App.tsx` (before any call is joined) to register the keep-alive notification channel — the
  symbol used is `StreamVideoRN.updateConfig`, exported by the installed SDK 1.32.3. (The channel type in
  1.32.3 accepts only `id`/`name`; the SDK drops sound/vibration for the keep-alive channel itself, so
  `lights`/`vibration` are not passed — that keeps the mobile typecheck clean.) `updateConfig` is a plain
  config setter and a no-op on iOS, so it does not affect app boot; iOS background audio is unchanged
  (already handled by the config plugin). **Presence side effect (also resolved):** because the foreground
  service keeps the JS runtime alive while in a call, the existing Chyme presence heartbeat (every 35s) and
  room poll (every 15s) keep firing when backgrounded, so the member no longer drops off after the 45s
  presence window while still connected — the earlier "member drops off after the presence window when
  backgrounded" behavior is resolved by the same change. Updated the two heartbeat/poll comments in
  `ChymeAudioRoom.tsx` (comment-only) to reflect this. Android-only; web + mobile-responsive unaffected.
  No schema, route, or contract change. **NOT verifiable here:** typecheck, lint, EOF, parity, and the
  lockfile all pass, but whether audio continues and the member stays in the roster when the app is
  backgrounded can only be confirmed on a real device from an EAS dev/production build (not Expo Go). That
  on-device check is a required release gate before this is considered proven.
- 2026-07-17: **History-aware back navigation (app-wide sweep).** The member shell's hand-rolled
  back chevron was replaced by the shared `BackChevronButton` — it returns to the previous in-app
  page and falls back to All Apps when there is no in-app history. UI-only; no schema, route, or
  contract change.
- 2026-07-17: **Android now shows other members' server-persisted raised hands in the live audio room** (#1599). Previously the mobile room rendered only the local member's own persistent hand plus everyone else's transient Stream reaction (which the SDK auto-clears), so a mobile member never saw another member's hand stay up. `ChymeAudioRoom.tsx` now polls `GET /api/chyme/room` every 15s while joined — matching the web `chyme-live-shell` cadence — guarded by a `status === 'joined'` effect that clears its interval on unmount / when leaving the room and uses a `canceled` flag so a late response can't set state after unmount. It builds a `raisedHandUserIds` set from the participants whose `handRaised` is true (keyed by clerk user id) and threads it through `ChymeAudioRoomLive` → `ChymeSpeakerTile`; each non-self, non-guest tile shows the ✋ when its `chyme-<clerkUserId>` (prefix stripped) is in the set, keeping the transient Stream reaction as an instant in-call cue and the local member driven by their own instant toggle. Added `handRaised: boolean` to the mobile `ChymeParticipant` type in `ChymeApi.ts` (the endpoint already returned it). This reads the same `GET /api/chyme/room` the web room already polls, so it adds no new server endpoint and no Stream/GetStream quota — it is a database read, not a Stream call; no new quota-impact note is needed. Android-only change; web + mobile-responsive unaffected. No schema, route, or contract change (both endpoints already existed). NOT verifiable here: the live audio + presence path needs an EAS dev build on a device; `@ctf/mobile` typecheck/lint are the gates run in CI.
- 2026-07-14: **Android pull-to-refresh on the Chyme room list.** Dragging the room list down (`chyme-room-list.tsx`, wired through `ChymeRoom.tsx`) re-pulls the room + messages in the background without flashing the branded splash. The live audio room and chat view are untouched (they are real-time surfaces). Mobile-client only — no backend, schema, route, or contract change.
- 2026-07-01: **Graceful handling when the browser has no WebRTC (Safari Lockdown Mode).** The live audio room needs `RTCPeerConnection`; Safari's Lockdown Mode (and some hardened/older browsers) removes it, so the Stream Video SDK threw `Can't find variable: RTCPeerConnection` and the room surfaced that raw error (reported by a member on iOS Safari with Lockdown Mode on). Added `isWebRtcAvailable()` in `chyme-audio-room.tsx` (reads `window.RTCPeerConnection`/`webkitRTCPeerConnection` by property access so the check can't itself throw); both the member room (`chyme-audio-room.tsx`) and the guest listen path (`chyme-guest-listen.tsx`) now detect the missing WebRTC before creating the Stream client, set an `unsupported` state, and show a clear, actionable message (what's wrong + how to turn off Lockdown Mode for the site) instead of a raw error or a misleading "try refreshing." Chat still works in this state. The expected-environment case is no longer reported to Sentry. Web + mobile-responsive (the same web component serves the phone breakpoint); no Android change (React Native uses native WebRTC, a separate path). No schema/route/contract change. Verified: `@ctf/web` typecheck + eslint clean, EOF clean.
- 2026-06-26: **Added server-side listen-only enforcement for guest listeners (code half)** (code-review issue #980, high/security). `createChymeGuestListenCredentials` minted a guest Stream token with the default role, so a guest who extracted their own token could `join()` and publish audio to the live room — listen-only was enforced only by the client (muted join, no speak controls). The guest Stream user is now created with the role named in the new optional `CHYME_GUEST_STREAM_ROLE` env var; the owner configures that role on the `default` Video call type to drop `send-audio`/`send-video`/`screenshare` while keeping join/listen, so Stream blocks publish at the API level. The env var gates the change: unset → guests keep the default role (unchanged, client-only) so this is safe to deploy in any order; set → server-enforced. Client-side mute/disable is kept as defense-in-depth. Members are unaffected (only `chyme-guest-…` identities get the role). Owner runbook added: `ctf/docs/plugins/chyme/guest-listener-stream-role.md`. Per the owner's "I do code + you do Stream config" decision (2026-06-26). No schema/contract/route change. Verified: `@ctf/web` typecheck + eslint clean, EOF clean. NOT verifiable here: the actual Stream publish block needs the role/grants applied in the Stream app and the env var set.
- 2026-06-26: **Hardened `POST /api/chyme/service-credits` and fixed its idempotency key** (code-review issues #981 high/security, #986). The tip route only checked `toUserId` truthy and `amount > 0`, so (a) a member could tip themselves (round-trip credits for fee/accounting abuse) and (b) any large positive amount passed through, with the shared transfer primitive's balance check the only guard. Added two route-layer rejections (both 400): self-tip (`toUserId === sender`) and amount above `CHYME_MAX_TIP_AMOUNT` (new constant, 10000); also tightened the amount check to require a finite number. Separately, `sendServiceCredits` built its `idempotencyKey` as `chyme-${fromUserId}-${Date.now()}` — a value that changes every call, so a retried tip (network failure) would create a second transfer instead of deduplicating, risking a double-charge. It now accepts an optional `idempotencyKey`: the route derives one from a client-supplied nonce (`chyme-<sender>-<nonce>`) when present so retries dedupe, and otherwise the repository mints a per-request `randomUUID()` (never `Date.now()`). Web and mobile clients don't send a nonce yet, so today's behavior matches a per-request UUID; wiring a stable client nonce for true retry-dedup is a follow-up. No schema or contract change (the route still has no command-contract entry — a pre-existing gap). Verified: `@ctf/web` typecheck + eslint clean, EOF clean.
- 2026-06-26: **Clamped the `GET /api/chyme/messages` `limit` to the contract bounds at the route layer** (code-review issue #988). `parseLimit` returned the raw parsed integer, so an out-of-range page size (e.g. a huge or negative `?limit`) reached `listRoomMessages` and relied on the repository's own `Math.min/Math.max` clamp for safety. It now clamps to `[1, CHYME_DEFAULT_MESSAGES_LIMIT]` (the `chyme.messages.list` contract maximum of 100) before the value leaves the route, so the API layer enforces the bound itself instead of trusting the repository. Chosen clamp over a 400 rejection because a list endpoint capping page size to the maximum is the conventional, non-breaking behavior and matches the existing repository clamp. One-line route change; no contract, schema, or client change (web and mobile already request `?limit=50`).
- 2026-06-26: **Closed two Android audio-room parity gaps: presence heartbeat and persistent hand-raise** (code-review issues #992, #990). (1) The mobile room never pinged the presence heartbeat, so a mobile participant who stayed in the call dropped off the participant list after the 45s presence window even while still connected to Stream audio. Added a `status === 'joined'` `useEffect` in `ChymeAudioRoom.tsx` that POSTs `/api/chyme/heartbeat` immediately and every 35s (new `postChymeHeartbeat` in `ChymeApi.ts`), matching the web room; the OS suspends the timer when the app is backgrounded, so presence lapses on its own then (no `document.visibilityState` counterpart on React Native). (2) Raising a hand on mobile only sent a transient Stream reaction and auto-reset after 2.5s, so it was never persisted — other members (e.g. on web) never saw a mobile participant's raised hand stay up. Lifted hand state into `ChymeAudioRoomLive`, made it a persistent toggle (no auto-reset), and POST `/api/chyme/hand` with `{ raised }` (new `postChymeHand` in `ChymeApi.ts`) alongside the Stream reaction — mirroring the web `onToggleHand`. The local member's own tile is now driven by this toggle; the control reads "Hand"/"Lower". Mobile still renders other members' persistent hands only from the transient Stream reaction (it does not yet poll the server-persisted set as web does) — recorded in Gaps. No schema, route, or contract change (both endpoints already existed). Web + mobile-responsive unaffected (Android-only change). NOT verifiable here: the live audio + presence path needs an EAS dev build on a device; `@ctf/mobile` typecheck is the gate run in CI.
- 2026-06-25: **Wired ServiceCredits peer tipping into the room (web + Android).** The `POST /api/chyme/service-credits` backend route already existed but nothing called it; now each other participant's tile carries a **Tip** action that sends ServiceCredits from the signed-in member to that participant. Web: `chyme-tip-dialog.tsx` (a `ChymeTipButton` on the speaker tile opening an amount/message dialog), posting through the CSRF-attaching `requestJson`. Android: `ChymeTipModal.tsx` (matching button + modal) and a new `postChymeTip` in `ChymeApi.ts`. The Tip action is hidden on the local member's own tile and on listen-only guests (no wallet). Tips flow through the shared transfer primitive with `origin_plugin = 'chyme'`, deliver immediately, and are recognized in GDP as Chyme peer tips (the GDP source was registered earlier; it now has real activity to count). Verified: `@ctf/web` + `@ctf/mobile` typecheck clean and web eslint clean.
- 2026-06-25: **Closed the last chyme CSRF gap — `POST /api/chyme/join`** (owner-approved). Added the `ensureMutationCsrf` guard to the join route (it gained a `request` parameter) and the `x-ctf-csrf: '1'` header to the mobile `postChymeJoin` (`ChymeApi.ts`); the web join caller already sends it through the `requestJson` change from the prior pass. **Every chyme mutation route is now CSRF-guarded.** Verified: `@ctf/web` + `@ctf/mobile` typecheck clean and web eslint clean.
- 2026-06-25: **Added CSRF guards to the remaining chyme mutation routes** (`hand` / `messages` POST / `leave` / `heartbeat`) — owner-approved follow-up to the service-credits fix. Each now calls `ensureMutationCsrf` after the access gate (`leave` and `heartbeat` gained a `request` parameter). Because these routes have **live clients** (unlike the service-credits route), their callers were updated to send `x-ctf-csrf: '1'`: the web `requestJson` helper (`components/chyme/chyme-shared.ts`) now attaches it on every non-GET request (covers messages + leave), the two raw `fetch` calls in `chyme-audio-room.tsx` (heartbeat, hand) add it inline, and the mobile `postChymeMessage` (`ChymeApi.ts`) adds it. Verified: `@ctf/web` + `@ctf/mobile` typecheck clean and web eslint clean. `POST /api/chyme/join` was the one chyme mutation still without the guard at the time of this pass; it is closed by the follow-up entry above.
- 2026-06-25: **Added the missing CSRF guard to `POST /api/chyme/service-credits`** (security hardening — owner-approved). The money-moving send route was gated by `requireChymeAccess` only; it now also calls `ensureMutationCsrf` (requires `x-ctf-csrf: '1'` + same-origin host), matching every sibling plugin's service-credits route (lighthouse / foundation / skills-hunt / socket-relay). Added a chyme `ensureMutationCsrf` helper to `app/api/chyme/_lib.ts` (mirroring the socket-relay/foundation implementation, using the shared `checkMutationOrigin`) and a `csrfDenied: 'CHYME_CSRF_DENIED'` code to `CHYME_ERROR_CODE`. No client currently calls this route (it is an unwired backend endpoint — `sendServiceCredits` has no caller outside the handler), so nothing breaks; whenever a UI is wired up it sends the same `x-ctf-csrf: '1'` header as all other mutations. Resolves the Gaps item recorded earlier today; the remaining non-money chyme mutations are tracked as the new Gaps item 6. Web typecheck clean (`pnpm --dir ctf --filter @ctf/web run typecheck`).
- 2026-06-25: **Documented the service-credits route** (inventory-debt burn-down — documentation catch-up, no code change). Added `POST /api/chyme/service-credits` (send credits caller→`toUserId` via `sendServiceCredits` / the shared transfer primitive; gated by `requireChymeAccess`) to the route map. While verifying the handler, recorded a real finding in Gaps (item 6): this money-moving route has no `ensureMutationCsrf` check, unlike its sibling plugin service-credits routes — a CSRF guard for parity is a follow-up code change. Removed the route from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-20: Made the raise/lower hand **persistent**. Previously a raised hand rode on Stream's transient reaction (`participant.reaction`), which the SDK auto-clears after a few seconds, so other members never saw it stay up. The state is now stored server-side: new `hand_raised BOOLEAN NOT NULL DEFAULT FALSE` column on `chyme_room_members` (guarded `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for legacy DBs), new `setRoomMemberHandRaised(identity, raised)` repository function (updates the caller's presence row and returns refreshed room state), and new `POST /api/chyme/hand` route (`{ raised: boolean }` → `{ ok, room }`, gated by `requireChymeAccess`, audit command `chyme.hand`). `ChymeParticipant` and `listRoomParticipants` carry `handRaised`. In the web stage, `chyme-room-view` derives a set of clerk user ids with a raised hand from `room.participants` and threads it through `ChymeAudioRoom` → `ChymeAudioRoomLive` → `ChymeSpeakerTile`; each non-self, non-guest tile shows the ✋ when its `chyme-<clerkUserId>` (prefix stripped) is in the set. The local member stays driven by their own instant local toggle (which now also POSTs to persist). `chyme-live-shell` adds a light room poll every 15s (only while the tab is visible, mirroring the heartbeat's visibility guard; updates only `room`, leaving chat/draft untouched) so other members' hands appear/disappear without a manual refresh. Leaving deletes the presence row (clearing the hand), and stale presence drops the member from `listRoomParticipants` via the freshness window — so a departed member never lingers with a hand up. Command and audit contracts updated. No Android change in this pass (web + mobile-responsive).
- 2026-06-19: Let signed-out visitors **listen** to the one default room when it is live, resolving the contradiction between the "free to listen" guest banner and the members-only reality. New public `GET /api/chyme/public/room` returns the default room's live status and, only when live, an ephemeral guest Stream identity (`createChymeGuestListenCredentials`); new `getPublicRoomLiveState()` reads the room with no identity (a guest is not a member). New `components/chyme/chyme-guest-listen.tsx` connects that guest to the same `default` call and plays its audio receive-only (camera + microphone disabled, no speak/raise-hand controls); `components/chyme/chyme-public-shell.tsx` fetches the endpoint and renders the listener when live. Speaking still requires sign-in. Listen-only is enforced client-side; server-side publish restriction would need Stream call-type roles (flagged in the quota note). Stream Quota Impact Note added (`docs/quota-impact/2026-06-19-chyme-guest-listen.md`) — guests accrue Stream Video participant-minutes while listening, only when a room is live. No schema change (the default room is the public one by its existing `chyme-main-room` key).
- 2026-06-13: Tuned the presence heartbeat to cut idle database cost. The audio room now pings `/api/chyme/heartbeat` every **35s** (was 20s) and **only while the browser tab is visible** (Page Visibility API); a backgrounded/forgotten tab stops pinging, so it stops writing `last_seen_at` and drops out of presence after the 45s window — and the database compute is no longer pinned awake by an open tab. Returning to the tab pings immediately so the member reappears without waiting. 35s stays comfortably inside `CHYME_PRESENCE_TTL_SECONDS` (45s). No schema, route, or contract change.
- 2026-06-13: Fixed room presence so a member can actually leave, is removed on disconnect, and is never shown twice. Presence now means "joined the call," not "viewing the page": `upsertMember` was removed from `getRoomState`, `listRoomMessages`, and `sendRoomMessage` (merely opening Chyme or chatting no longer lists you on stage). `listRoomParticipants` now only returns members seen within `CHYME_PRESENCE_TTL_SECONDS` (45s), so a disconnected member drops off automatically. New `POST /api/chyme/heartbeat` (refreshes `last_seen_at` every 20s while in the audio room) and `POST /api/chyme/leave` (deletes the member row on Leave, called from the live shell). `callActive`/"Live" is now derived from fresh presence (`participants.length > 0`) instead of a stored flag nothing turned off. The web audio room de-dupes stage tiles by `userId` (a lingering extra Stream session no longer renders the same user twice). New audit command `chyme.call.leave`. No schema change (`chyme_room_members.last_seen_at` already existed).
- 2026-06-08: Built the Android (React Native) live audio room for parity with the web room (issue #265). New `ctf/packages/mobile/src/features/chyme/ChymeAudioRoom.tsx` mirrors `components/chyme/chyme-audio-room.tsx` one-to-one using `@stream-io/video-react-native-sdk`: joins the `default` call type audio-only with `{ create: true }`, starts muted, real microphone mute/unmute (`microphone.toggle()`), live participant tiles driven by `useParticipants()` with speaking/mute state, raise-hand broadcast (Stream reaction), and a real leave on exit. `ChymeRoom.tsx` now stores the `POST /api/chyme/join` credentials and renders `ChymeAudioRoom` for the in-room state; the old static `chyme-active-room.tsx` stage was removed. The SAME Stream user token serves chat and audio, so no second token call and no token-route change were needed (the join route mints the token with `stream-chat`'s `createToken`, which is product-agnostic; the web room already reuses it for Video). Dependencies added to `ctf/packages/mobile/package.json`: `@stream-io/react-native-webrtc@137.1.3`, `@react-native-community/netinfo@11.5.2`, `react-native-svg@15.15.3`, `expo-build-properties@~55.0.13`, and dev `@config-plugins/react-native-webrtc@14.0.0`. `app.config.ts` wires the `@stream-io/video-react-native-sdk` and `@config-plugins/react-native-webrtc` Expo config plugins (microphone permission text, audio background mode, Android WebRTC permissions). NOT verifiable here: the live audio needs an EAS dev build on a device — typecheck, lint, EOF, parity, and lockfile-sync all pass, but the actual join/speak/hear path must be confirmed on a device.
- 2026-06-08: Added the signed-out visitor (public) web view. New `components/chyme/chyme-public-shell.tsx` renders the public experience pixel-faithful to `design/.../survivor-hub/ChymePublic.tsx` (desktop) and `MobileChymePublic.tsx` (phone width), with sign-in/join affordances pointing at the hosted sign-in URL. This is part of a shared framework: the plugin route (`app/apps/[pluginSlug]/page.tsx`) now detects the anonymous-visitor denial (`AUTH_UNAUTHORIZED`) and renders that plugin's public shell from a slug-to-shell registry (`components/plugins/public-visitor-registry.tsx`) instead of the access-denied wall; plugins with no bespoke public shell fall back to a generic public shell. The view carries no private or per-user data — there is no public room-listing endpoint, so the room list shows an honest empty state, not the mockup's placeholder rooms. The earlier note that "Chyme is auth-only, public state not applicable" is superseded for the signed-out browse view; speaking, hosting, reacting, and saving still require sign-in. Web + mobile-responsive complete; no Android change (the framework is web-only). TypeScript: zero errors. EOF: clean. Parity check: passed.
- 2026-06-02: Dropped the redundant `display_name` column from `chyme_room_members` and `chyme_messages`. That column only ever held the author's `@username`, which duplicated the raw `username` already stored on each row. The domain types, repository, API identity, web components, and Android feature now expose and render the raw `username`, formatting it as `@username` at display time (falling back to `user-<first 8 of user id>` when a username is null). A guarded, idempotent migration (`ctf/db/migrations/post/0002_chyme_drop_display_name.sql`) drops the leftover column from any database that still has it; `schema.sql` no longer defines it. The deletion contract was updated to list `username` instead of `display_name` as the personal-data field on both tables.
- 2026-06-01: Built the real live audio room and removed the stubbed video panel. `components/shared/stream-video-panel.tsx` was a placeholder that called `videoClient.call('default', id).join()` with no `{ create: true }` and rendered "[Stream video UI coming soon]", so every join showed "Failed to join video room." Replaced it with `components/chyme/chyme-audio-room.tsx`, a real Stream Video integration: joins the `default` call type audio-only with `{ create: true }`, starts muted, real mute/unmute (`microphone.toggle()`), live participant tiles driven by `useParticipants()` with speaking and mute state, audio playback via `ParticipantsAudio`, raise-hand as a broadcast Stream reaction, and a real leave. The pre-join `chyme-stage` now only previews room membership; the live stage and controls are Stream-driven. The fake local `muted`/`handRaised` state in `chyme-live-shell` was removed. The live room is loaded client-only (`next/dynamic`, `ssr: false`). Requires the Stream app to have the Video product enabled (see Gaps #3).
- 2026-06-01: Removed the "Delete Chyme Data" / "Delete Full Account" buttons from the Chyme room (web `chyme-sidebar` / `chyme-live-shell` and mobile `ChymeRoom.tsx`) because they cluttered every room view; the deletion API endpoints are retained for a future designed account-settings surface (design queued). Also corrected the record: the shipped Chyme is a single-room MVP, and the full-featured `Chyme.tsx` (multi-room, create/discover, upcoming/scheduled, search, reactions, speaker/audience promotion) is the accepted design target, not yet built. The earlier "implementation is complete across web and Android" (2026-05-17) referred to the single-room workflows and their pixel pass, not the mockup's full feature set.
- 2026-05-31: Android pixel pass. Rewrote `ChymeRoom.tsx` aligned to `MobileChyme.tsx` / `MobileChymeEmpty.tsx` / `MobileChymeLoading.tsx` mockups. Decomposed into modular sub-components (`chyme-loading`, `chyme-empty`, `chyme-room-list`, `chyme-active-room`, `chyme-chat-view`), each within rule-116 200-line / complexity-10 limits. Added canonical `api.ts` entry-point re-exporting from `ChymeApi.ts`. All UI state (loading, empty, room-list, in-room, chat) bound to real `/api/chyme/room`, `/api/chyme/messages`, `/api/chyme/join`, and account deletion endpoints. Public state omitted — Chyme is auth-only. TypeScript: zero errors. EOF: clean. Parity check: passed.
- 2026-05-29: Modularity refactor. Decomposed the oversized `ChymeLiveShell` (359 lines / complexity 40, a pre-existing rule-116 violation) into modular sub-components (`chyme-header`, `chyme-sidebar`, `chyme-room-view`, `chyme-stage`, `chyme-chat-panel`, `chyme-controls`, `chyme-shared`), each within the 200-line / complexity-10 limits. No behavior, API, or copy change.
- 2026-05-29: Design-sync reconcile to `c5d83c0`. Removed user-facing "GetStream" wording from `chyme-live-shell`: "Social Audio · GetStream Powered" → "Social Audio · End-to-End Encrypted", the chat "GetStream" badge → "Encrypted", and "Audio via GetStream" → "Audio — encrypted". Copy-only.
- 2026-05-29: Web UI circle-back. Aligned `chyme-live-shell` to the `Chyme.tsx` mockup by replacing emoji glyphs with the mockup's lucide-react icons (Radio, Mic/MicOff, Hand, Phone, MessageSquare, Hash, Send, Volume2, Users, Lock, RefreshCw); structure and palette already matched. API wiring unchanged.
- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language (Delivery Phasing section); confirmed implementation is complete across web and Android. Renamed section to "Gaps and Known Technical Debt" (Rule 120 format).
- 2026-04-05: Completed Android parity on the real Chyme API surface, queued ServiceCredits reclaim dependency on full-account delete, and aligned Chyme docs to `ctf/schema.sql` plus shared Stream wrappers.
- 2026-02-25: Created initial Chyme CTF rewrite inventory and documented governance/parity requirements.


## Build Checklist


### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - Chyme implementation and supporting artifacts stay under `ctf/`.
- [x] Confirm plugin ID and room key stability.
  - Acceptance criteria:
    - Plugin slug remains `chyme`.
    - Default room remains `chyme-main-room` unless an explicit migration plan is approved.
- [x] Confirm profile/deletion contract exists.
  - Acceptance criteria:
    - `ctf/docs/contracts/CHYME_PROFILE_AND_DELETION_CONTRACT.md` exists and maps expected behavior.

### Baseline Prerequisite Gate (Mandatory)

- [x] Confirm baseline sequence completion before Chyme build start.
  - Acceptance criteria:
    - Auth foundation completed.
    - Railway deployment baseline completed.
    - Vercel staging integration completed.
    - Expo baseline completed.

### �� Core Implementation and Contract Alignment

- [x] Implement Chyme room bootstrap route behavior.
  - Acceptance criteria:
    - `GET /api/chyme/room` creates/loads deterministic room and upserts participant profile/member for eligible users.
- [x] Implement Chyme chat list/send route behavior.
  - Acceptance criteria:
    - `GET /api/chyme/messages` returns bounded room history.
    - `POST /api/chyme/messages` trims input, rejects empty text, and persists valid messages.
- [x] Implement Stream join route behavior.
  - Acceptance criteria:
    - `POST /api/chyme/join` returns Stream credentials when server config is present.
    - Route returns `503` when Stream server config is unavailable.
- [x] Implement migration/data model coverage.
  - Acceptance criteria:
    - Core Chyme tables and indexes exist and match route assumptions.
- [x] Confirm command/access/audit contract alignment.
  - Acceptance criteria:
    - Chyme command contract follows Rule 201 template conventions.
    - Chyme access/deny policy contract follows Rule 202 template conventions.
    - Chyme audit contract follows Rule 203 template conventions.

### �� Deletion and Compliance

- [x] Implement service-scoped deletion flow.
  - Acceptance criteria:
    - `DELETE /api/account/chyme-profile` marks service profile deleted and records service deletion event.
- [x] Implement full-account request behavior.
  - Acceptance criteria:
    - `DELETE /api/account/full-account` records account-scope deletion request and enqueues downstream reclaim dependency.
- [x] Align full-account lifecycle statuses with global orchestrator model.
  - Acceptance criteria:
    - Status model (`requested`/`processing`/`completed`/`failed`) is represented consistently in account deletion workflow.

### �� Seed and Deterministic Dev Validation

- [x] Add deterministic Chyme seed script.
  - Acceptance criteria:
    - Seed script under `ctf/scripts/` creates predictable Chyme baseline test data for local/dev validation.
- [x] Capture dev validation evidence. [MANUAL VALIDATION CHECKLIST DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Seed data can be regenerated for local/dev manual validation.

### �� Web/Android Parity

- [x] Confirm web Chyme baseline is implemented.
  - Acceptance criteria:
    - Web UI and API support room, chat, join, and deletion actions.
- [x] Implement Android parity for Chyme plugin flows.
  - Acceptance criteria:
    - Android delivers equivalent room/chat/join/deletion behavior and policy outcomes using the protected Chyme API surface.
- [x] Close platform parity deferment with owner/date (if not delivered in same phase).
  - Acceptance criteria:
    - Parity no longer depends on a deferred follow-up owner/date.

### �� Release Gates and Lifecycle Maintenance

- [x] Keep Chyme inventory/checklist synchronized with accepted changes. [EVIDENCE CAPTURE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Feature/behavior changes update both Chyme docs in the same PR.
- [x] Record release-gate compliance status.
  - Acceptance criteria:
    - Command/access/audit contracts, migration evidence, and policy/audit checks are linked before release cut.
- [x] Add Stream quota-impact and validation artifacts.
  - Acceptance criteria:
    - Chyme has a dedicated quota-impact note and updated validation instructions aligned to canonical schema flow.

### Change Log

- 2026-02-25: Created initial Chyme rewrite checklist with baseline sections and governance requirements.
- 2026-03-01: Replaced implemented-baseline validation checklist with fresh-start implementation checklist and baseline prerequisite gate.
- 2026-03-01: Completed Phase 0 web/API/migration/policy/audit scope and recorded Android parity deferment owner/date.
- 2026-03-02: Added Chyme closure handoff evidence and second-pass runtime de-scaffolding updates (join call state persistence).
- 2026-04-05: Closed Android deferment, wired ServiceCredits reclaim dependency queueing for full-account delete, and added release evidence for schema/quota/validation alignment.
