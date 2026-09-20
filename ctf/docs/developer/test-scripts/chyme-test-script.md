# Chyme — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- chyme`

| | |
|---|---|
| **Plugin** | Chyme (`chyme`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-chyme-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) · 2026-08-04 manual note: inventory scope line corrected to the real constant names (`CHYME_MAIN_ROOM_KEY`, `CHYME_CONTRIBUTORS_ROOM_KEY`) — no test change; the two-room cases below already match the shipped product · 2026-08-24 manual update: CH-7 now also checks that the signed-out view scrolls as a page (pinned header, Safari Full Page reaches the bottom) and ships one layout at every width |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

The one shared audio room — these are the can't-ship-broken checks. Member role unless noted.

1. **Room loads.** Open Chyme as a signed-in member. The room ("Chyme Main Room: Exit the
   Gauntlet"), the participant list, and the chat panel render — not a spinner or an error. → web ☐ mobile ☐ android ☐
2. **Join the call.** Press join. You connect to the live audio room, start muted, and can mute
   and unmute your own microphone. → web ☐ mobile ☐ android ☐
3. **Chat send/read.** Type a message and send it. It appears in the list and persists on
   reload. → web ☐ mobile ☐ android ☐
4. **Access wall for the signed-out visitor.** Open the plugin route while signed out. You see the
   public listen view (free to listen, sign in to speak), not private member data. → web ☐ mobile ☐ android ☐
5. **A host is not endorsed, signed out, whether or not anything is live.** Open Chyme signed out
   **with no room live**. The invitation card ("Listen in for free…") says hosts book their own
   slots, that a name is not an endorsement, and that the rules still apply in the room. Then open
   it again **while a room is live** and confirm the same line is still on screen. Both states
   matter: a visitor arriving from the TI Radio schedule usually gets here before the room starts,
   and an earlier draft showed this only once somebody was already listening. → web ☐ mobile ☐ android ☐
6. **A host is not endorsed, signed in.** Open Chyme as a member. The same statement sits under the
   rooms rail, above the room you are in. A member reads the same public TI Radio schedule, so the
   signed-in view must not be the one screen that omits it. → web ☐ mobile ☐ android ☐
7. **A host is not endorsed, on Android.** Open Chyme in the Android app and read under the room
   list. The same statement is there. Chyme is on the keep-list, so this surface is not covered by
   "web-only" and must not be the one that omits it. → web ☐ mobile ☐ android ☐
8. **All four wordings agree.** Compare the line on the Chyme signed-out card, the Chyme signed-in
   view, the Android room list, and the TI Radio guide's intro card. All four read from
   `@ctf/shared` (`packages/shared/src/copy/hosting-disclaimer.ts`) — the guide uses the long form,
   Chyme the short one. If any of them says something the others do not, somebody has inlined a copy
   and they will drift. None of them may claim the room is moderated, screened or safe — that is a
   claim the product cannot back. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### CH-1 · Room state and participant list
**Role:** member · **Surfaces:** all · **Precondition:** seeded member with room access.
**Steps:**
1. Open Chyme and read the room header and participant list.
2. Note who is shown and how each name renders.
**Expected:** The single shared room loads with its name. Each participant is shown by their handle
as `@username`, falling back to `user-<first 8 of the id>` when there is no username. Only members
seen recently (within the 45-second presence window) appear; a stale member drops off.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-2 · Send a chat message (validation)
**Role:** member · **Surfaces:** all
**Steps:**
1. Send a normal message.
2. Try to send an empty message (only spaces).
3. Try to send a very long message (over 1000 characters).
4. Send a message containing a long unbroken string (e.g. a full URL with no spaces), then read the
   Room Chat window on a phone-width screen.
**Expected:** The normal message posts and persists. An empty/whitespace-only message is rejected
(the `chyme.message.send` contract requires 1 to 1000 characters after trimming). A message over
1000 characters is rejected by the same bound, not silently cut. The long-URL message **wraps**
inside the chat window — the window scrolls only up and down, never left/right (no horizontal scroll).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-3 · Read chat history with a page size
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a room with several seeded messages.
2. Reload the history.
**Expected:** History loads bounded. The page size is clamped to the `chyme.messages.list` range
(at least 1, at most 100); a missing or non-numeric size falls back to the default. You never get an
unbounded dump or an error from an odd `limit`.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-4 · Join, presence heartbeat, leave
**Role:** member · **Surfaces:** all
**Steps:**
1. Join the call and stay in it for over a minute. Watch the permission prompts as you join. Test on
   iOS Safari and a saved-to-home-screen PWA in particular.
2. Press Unmute, then press leave.
**Expected:** Joining **never** asks for camera permission (Chyme is audio-only — the camera is
disabled before the call joins, so no camera prompt fires on any surface, including the iOS PWA). You
join muted; the **microphone** permission is only requested when you press Unmute (not on join). While
in the call you keep counting as present (the heartbeat refreshes your row every 35 seconds). On leave,
your row is dropped and you disappear from the participant list — and any raised hand clears. The room
shows "Live" only while at least one fresh member is present.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-5 · Raise and lower hand (persistent)
**Role:** member · **Surfaces:** all
**Precondition:** a second test member in the same room to observe.
**Steps:**
1. Raise your hand. Have the second member look at your tile.
2. Lower your hand, leave, or go stale.
**Expected:** The raised hand stays visible to everyone until you lower it, leave, or your presence
goes stale — not just for a couple of seconds. On web AND android the other member's tile shows the
persistent hand: android polls `GET /api/chyme/room` every 15s while in the room and renders every
other member's server-persisted raised hand, so the hand stays up after the short-lived Stream
reaction clears (#1599). Verify from an android device: with a second member's hand raised on web,
the android tile keeps the ✋ up (and drops it within ~15s of them lowering it).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-6 · Tip a participant in ServiceCredits
**Role:** member · **Surfaces:** all
**Precondition:** your wallet has a balance; a second participant with a wallet is in the room.
**Steps:**
1. Open the Tip action on another participant's tile, enter an amount, send.
2. Try to tip yourself.
3. Try to tip an amount above the limit.
**Expected:** The tip sends ServiceCredits from you to that participant and delivers immediately. The
Tip action never appears on your own tile or on a listen-only guest. Self-tip is rejected (400). An
amount that is not a finite number above 0, or above the maximum (10000), is rejected (400).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-7 · Signed-out visitor can listen
**Role:** member (test signed-out) · **Surfaces:** all
**Precondition:** the room is live (a signed-in member is in the call).
**Steps:**
1. Sign out. Open the Chyme plugin route. Before scrolling, note what is on the first screen.
2. Tap **Tap to listen** under the room heading, then listen to the live room; look for any speak
   control.
3. On iOS Safari, scroll the public view, then take a screenshot and choose **Full Page**.
4. Count the sign-in and join buttons on the whole page, top to bottom.
5. Have the last signed-in member leave the call, then reload the signed-out page within the next
   45 seconds (inside the presence window, so the server still reports the room as live).
**Expected:** Before the tap the room heading shows, under it the line "The room is live. Tap below
to listen; sign in to speak." (never "You're listening live" before the tap), and a single **Tap to
listen** button with the on-stage count and the line "Phones only play sound after a tap. You will hear the room and
cannot be heard." — nothing is connected yet, nothing plays, and (since 2026-09-19) nothing has been
created on Stream: the page load only reads whether the room is live. The tap posts to
`/api/chyme/public/listen`, which takes a listening spot, sets the browser's `ctf_chyme_guest` cookie
on the first tap, and mints the browser's one guest identity (`chyme-guest-<id>`, the same id on
every later visit from this browser). Then you see "Connecting to the live room…", then
"Listening live · N members in the room", and you hear the room, joined muted with no speak control.
While listening the page posts a heartbeat every 35 seconds (visible tab only); closing the page
posts a leave so the spot frees at once. If the tap is refused — every guest spot taken, guests
paused by the quota policy, the room ended, or Stream refused — the note says the server's own
reason with the HTTP status and a **Try again** button, never a blank space. Under that line sits one muted line, "No sound? Take the phone off Silent (the
switch or the Action button), turn the volume up, then tap here." — tapping it retries playback.
When the phone browser refused to start the audio on its own (its autoplay rule), a green **Tap to
hear the room** button appears above that line; one tap starts the sound and the button goes away.
A phone in Silent mode with no microphone in use is muted by the switch itself, which no page can
override; the tap asks the browser to treat the page as media playback, and the line names the
switch. Under those, an **On Stage** section shows the same avatar tiles the member
room shows — every member in the call by handle with the speaking ring and mic badge, and your own
tile as "You (listening)" with the headphones badge — and under the stage a **Room Chat** row. Since
2026-09-20 that row starts closed, reading "Room Chat · read what members are saying" with a
right-pointing chevron and nothing under it; the chat is not read at all while it is closed. Tap it
and it opens to the read-only panel with the members' messages, refreshed every ten seconds, and one
**Sign in to chat** link; there is no composer. If the chat cannot load, the open panel reads
"Couldn't load the room chat." with the server's message and the HTTP status.
(Since 2026-09-18: the join used to run on page load, which put the guest on stage with the audio
blocked by the phone's autoplay rule — the member in the room saw a listener who heard nothing.) The view shows marketing/empty-state content only — no private or per-user data, and the
room list is an honest empty state. When the room is not live, there is no listen audio. The public
view is one phone-width layout at every window size — never a two-column desktop version. The page
itself scrolls: the green header stays pinned at the top while the content moves under it, and
Safari's **Full Page** screenshot reaches the bottom of the content rather than stopping at one
screenful.

In step 1, on a phone, the first screen carries the header, the invitation card, the **Live Rooms**
row with its refresh button, the room name and the **Tap to listen** control, the closed **Room
Chat** row and the **Coming up on TI Radio** rail — nothing of the page's own content needs a scroll
to be found (owner directive, 2026-09-20). What scrolls is the stage when the room holds many
people, and the chat once you open it. The invitations card is not part of this page at all: it
floats in the bottom-left corner over whatever is under it, with a **×** that closes it for the rest
of the browser session; it is described in the non-plugin feature inventory, section 1.15.

In step 4 you find **exactly one** place to sign in or join — the invitation card, whose **Join Free
to Listen** and **Sign In** both point at the hosted sign-in URL (or a single **Finish verifying**
link when the visitor has an account part-way through Unlock). The green header carries the back
control and the title only, with no sign-in or join button. There is **no bottom bar** at all: the
grayed, locked **Start a Room** that sat there is gone (owner directive, 2026-09-18). The **Live
Rooms** label row carries the same 44-px **refresh** button the signed-in page has beside Join Room;
pressing it spins the icon, re-reads the room (live state, count) and the chat, and a listener
already in the call stays connected — the installed app on Android has no browser reload, so this is
the only way a visitor there re-checks the room. There is **no
search box and no category tags** (Healing / Economy / Housing / Legal / Skills) anywhere on the
page.

In step 5 the page does **not** settle on "Couldn't connect to the live room" under a heading saying
you are listening live: the listener retries, then re-reads the room and falls back to the "No public
rooms right now" empty state once the room has ended.

"No public rooms right now" appears **only** when the server said the room is not live. If the live
check itself fails (for example the per-IP limit, 30 loads a minute, answers 429), the card reads
"Couldn't check whether a room is live" with the server's message and the HTTP status. If the room
is live but guest listening is paused by the Stream quota policy (Orange band and above), the room
heading still shows, with "The room is live — sign in to join it." and a note carrying the reason —
never a blank space under the invitation card. A Stream refusal (not configured, or the guest
upsert rejected) surfaces on the tap instead, in the same note with a Try again button.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### CH-8 · Live audio with WebRTC disabled (Safari Lockdown Mode)
**Role:** member · **Surfaces:** web (desktop) · web (mobile-responsive)
**Precondition:** a browser with WebRTC turned off — easiest is iOS/iPadOS Safari with **Lockdown
Mode** on (Settings → Privacy & Security → Lockdown Mode), or a desktop browser where
`RTCPeerConnection` is blocked.
**Steps:**
1. In that browser, open the Chyme plugin route and enter the room (as a signed-in member).
2. Also try the signed-out listen path (CH-7) in the same browser.
**Expected:** No raw error like `Can't find variable: RTCPeerConnection`. Instead the room shows a
clear message that live audio isn't available because the browser has WebRTC turned off, names Safari
Lockdown Mode, and tells you how to turn it off for the site (address bar → aA → Website Settings) or
use another browser. **Chat still loads and works.** The guest listen path shows the same explanation
(not a misleading "try refreshing"). Turning Lockdown Mode off for the site and reloading lets the
audio room connect normally. When the guest listener does fail for a real reason (not Lockdown Mode),
the note carries the underlying reason as a second line under "Couldn't connect to the live room",
the same way the signed-in room shows its connection error — so the failure can be reported without
opening browser developer tools. One wording to know: "role 'chyme_listener' is not allowed to
perform action JoinCall" means the guest role is set but the `default` call type does not grant it
`join-call` — a Stream config fix, per `ctf/docs/plugins/chyme/guest-listener-stream-role.md`:
run the "Stream — Guest Listener Setup" workflow with mode apply (its weekly check run exists so
this state is caught before a member reports it).
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### CH-9 · Pull-to-refresh on the room list (android)
**Role:** member · **Surfaces:** android
**Precondition:** signed in on the device; the room list is showing (at least one participant in the room).
**Steps:**
1. Open the Chyme screen and wait for the room list to render.
2. Drag the room card list down and release.
3. While the refresh runs, watch the screen content.
**Expected:** A refresh spinner appears at the top of the list and the room data (participant count,
live state) re-pulls from `GET /api/chyme/room`. The branded loading splash does **not** flash — the
current room list stays visible until the fresh data lands. The spinner stops when the pull completes,
including on a failed request.
**Result:** android ☐ — notes:

---

### CH-10 · Call stays alive when the app is backgrounded (android)
**Role:** member · **Surfaces:** android · **Needs a real EAS dev/production build — not Expo Go, not
the mobile-responsive web layout.** The Android foreground service is native code that only exists in
an EAS build.
**Precondition:** signed in on an android device running an EAS build; a second member is speaking in
the room so there is audio to hear.
**Steps:**
1. Join the Chyme audio room and confirm you can hear the other member.
2. Press the device Home button (or switch to another app), leaving Chyme running in the background —
   do **not** close it. A "Chyme live audio" notification should appear while backgrounded.
3. Keep the app backgrounded for over a minute, then return to the room.
**Expected:** Audio from the room keeps playing while the app is backgrounded (you keep hearing the
other member). When you return, you are still in the call and still shown in the participant roster —
you were not dropped after the 45-second presence window, because the foreground service kept the
presence heartbeat and room poll running. Leaving the room clears the notification.
**Result:** android ☐ — notes:

---

### CH-10w · Web keep-alive: wake lock + Media Session while joined
**Role:** member · **Surfaces:** web (mobile-responsive) · **Best-effort only — the browser cannot
match the Android foreground service.** No web API holds a live call in a fully backgrounded or
screen-locked tab; this check confirms the two things the web platform *can* do while the tab is open.
**Precondition:** signed in in a browser that supports the Screen Wake Lock API (recent Chrome/Edge on
Android or desktop; a second member speaking so there is audio).
**Steps:**
1. Join the Chyme audio room and confirm you hear the other member.
2. Leave the tab foreground and idle — do not touch the device. Confirm the screen does **not** dim/
   sleep on its usual timeout while you stay in the call.
3. On a phone, check the lock screen / media notifications: a "Chyme audio room" media entry should be
   present (Media Session), showing the call as active audio.
4. Switch to another browser tab or minimize, then return. Confirm you are still in the call (the wake
   lock auto-releases when hidden and re-acquires when the tab is visible again — no crash, no drop).
5. On a browser without Wake Lock support (e.g. older Safari), repeat step 1: the room must still work
   normally — the keep-alive simply no-ops.
**Expected:** While joined and foreground, the screen stays awake and a Media Session entry shows the
call as playing; hiding/showing the tab re-acquires the wake lock cleanly. Nothing changes on
unsupported browsers. This does **not** keep the call alive when the tab is fully backgrounded or the
phone is locked — that is Android-only (CH-10).
**Result:** web ☐ mobile ☐ — notes:

---

### CH-11 · Deletion also clears the Stream copy (privacy)
**Role:** member · **Surfaces:** api/data (no in-app button — call the endpoint directly)
**Precondition:** a test member who has sent at least one chat message (so there is a Stream copy).
Access to the Stream dashboard for the app behind `STREAM_API_KEY`.
**Steps:**
1. As that member, send a chat message, then delete: call `DELETE /api/account/chyme-profile`
   (service scope) OR `DELETE /api/account/full-account` (whole account). Also worth checking the
   Clerk-webhook path (delete the user in Clerk) since that also runs the orchestrator hook.
2. In the Stream dashboard, look up the member's Stream user `chyme-<userId>` and their messages in the
   `messaging:chyme-main-room` channel.
**Expected:** After the delete, the member's rows are gone from Postgres (`chyme_messages`,
`chyme_room_members`) **and** their Stream user `chyme-<userId>` is hard-deleted with messages marked
deleted — the Stream copy no longer lingers, on any deletion path (service route directly; full-account
/ internal / Clerk webhook via the orchestrator's external-cleanup hook). The audit line records
`streamCleared: yes`. If Stream is down at delete time, the deletion still succeeds and the failure is
logged for retry/backfill — the account is still deleted. Since 2026-09-18 that log line carries
Stream's own reason (Sentry op `stream_delete_user`, area `chyme`), so "unconfigured" and "refused"
are distinguishable in the record.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Back Channel walkthrough (free 1:1 audio sidebar, spec #1746)

Back Channel is a casual 1:1 audio call with another member who is in the same live room right now.
Two test members in the same room are needed for most of these.

### CH-12 · Start a Back Channel (consent, no cold ring)
**Role:** member · **Surfaces:** all
**Precondition:** two members (A and B) both joined to the same live room.
**Steps:**
1. As A, on B's participant tile, press **Back Channel**.
2. Watch B's screen.
3. As B, press **Accept**.
**Expected:** A's tile action changes to "Invite sent…". B sees an incoming prompt (a toast on web, a
bottom sheet on Android) reading "wants a Back Channel" with Accept/Decline — B is never cold-rung
into a live call. On Accept, both A and B land in the live 1:1 audio call (floating panel on web,
full-screen on Android) and can hear each other. The Back Channel action never shows on your own tile.
If the call cannot connect, the panel reads "Could not connect to the call: <Stream's reason>" (web
and Android, since 2026-09-18) rather than a bare sentence; and if the accept or join route itself
fails, its message reads "Unable to accept Back Channel: <reason>" / "Unable to join Back Channel:
<reason>". "Stream service is not configured" now appears only when Stream credentials are absent,
never for a Stream refusal.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-13 · Decline sends nothing back
**Role:** member · **Surfaces:** all
**Steps:**
1. As A, invite B to a Back Channel.
2. As B, press **Decline**.
**Expected:** The prompt closes. A gets no message and no error — A's "Invite sent…" simply clears on
the next poll. The note "Declining sends no message. Back Channels are private." is shown to B.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-14 · Blocked members can't Back Channel
**Role:** member · **Surfaces:** all
**Precondition:** A has blocked B (or B has blocked A), and both are in the room.
**Steps:**
1. Look at whether the **Back Channel** action appears on the blocked member's tile.
2. (If you can force the request) call `POST /api/chyme/back-channel/invite` for that member.
**Expected:** The action is hidden on a blocked member's tile (either direction). A forced invite is
rejected server-side with `403` (`CHYME_BACK_CHANNEL_BLOCKED`). This is the same symmetric block rule
used across member-to-member surfaces.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-15 · Invite lapses when a party leaves; call survives; hang up
**Role:** member · **Surfaces:** all
**Steps:**
1. As A, invite B, then — before B accepts — have A leave the room. Watch B's prompt.
2. Start a fresh Back Channel and accept it. Then have one party leave the *room* (not the call).
3. Press **Hang up**.
**Expected:** A pending invite lapses (B's prompt disappears) within ~45s when a party leaves before
accepting. An already-accepted call is **not** ended by leaving the room — it keeps going until
someone hangs up. Hang up ends the call for both; no history or record remains anywhere. Every call
surface shows the Foundation note ("For calls with ServiceCredits attached, use Foundation instead") —
Back Channel itself never mentions or moves credits.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### CH-16 · Back Channel audio survives backgrounding (android)
**Role:** member · **Surfaces:** android only (needs a real EAS build, not Expo Go)
**Steps:**
1. On an Android device, get into a live Back Channel call (CH-12).
2. Press **Home** or switch apps. Keep talking on the other end.
**Expected:** The call audio keeps playing while the app is backgrounded (the Back Channel reuses the
Chyme foreground service). Returning to the app shows the call still live. This is the same class of
check as the room's CH-10 and the Android app script's AN-4 — a required release gate.
**Result:** android ☐ — notes:

---

### CH-17 · Private "Weavers of the Commons" room (contributor-gated)
**Role:** contributor-eligible member, non-eligible member, admin · **Surfaces:** web (mobile-responsive)
**Precondition:** the contributor channel is open (`contributor_access_config.channel_open = true`); one
test member is contributor-eligible, one is not, and one is an admin.
**Steps:**
1. Open Chyme. Confirm the rooms rail (a horizontal, left-to-right scroller of room cards at the top)
   shows two cards: **Main Room** and **Weavers of the Commons** (the latter with the badge + a lock).
2. As the **non-eligible** member, tap **Weavers of the Commons**.
3. As the **eligible** member (or an **admin**), tap **Weavers of the Commons**, then Join Room, unmute,
   send a chat message, and raise/lower your hand.
4. Confirm the private room's participants and chat are separate from the main room (a message sent in
   one room does not appear in the other).
**Expected:** The non-eligible member sees the "Weavers of the Commons" explainer (badge + "How it's
earned →") and no room content — no locked/absence wording, just the explainer (no-shaming). The
eligible member/admin joins the private room, hears audio, sends/reads its own chat, and raises a hand
— all scoped to `chyme-contributors-room` and never mixed with the main room. Tips and Back Channel are
intentionally absent in the private room (MVP). If the channel is closed, even an eligible member gets
the explainer (only an admin still enters).
**Result:** web ☐ mobile ☐ — notes:

### CH-18 · Delete and Edit your own room chat message
**Role:** two members (A and B) · **Surfaces:** web (mobile-responsive), android (native app, #1858)
**Precondition:** both in the same room (main or private); each has sent at least one chat message.
On Android, run it in the native app's Chyme Room Chat (open a room → Chat).
**Steps:**
1. As member A, confirm **Edit** and **Delete** show under your own messages but NOT under member B's.
2. Tap **Delete** on one of your messages, confirm the prompt.
3. Tap **Edit** on another of your messages, change the text in the composer, and send.
4. As member B, re-read the chat (refresh).
**Expected:** Delete removes your message (optimistically right away; it stays gone on B's next
refresh). Edit deletes the original and loads its text into the composer — there is no in-place edit;
the reposted message is a brand-new message with a new timestamp, not the original edited. Neither
action appears on another member's messages, and the server rejects deleting someone else's message
(403) — a member can only delete their own. This mirrors the Commons home chat.
**Android (#1858):** same behavior in the native app — Edit/Delete under your own messages only,
Delete is confirm-gated (system dialog), Edit loads the text into the composer and deletes the
original (delete + repost). Both call the same `DELETE /api/chyme/messages/[messageId]` route; the
optimistic remove restores the message and shows a "Delete failed" alert if the request fails.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### CH-19 · Rooms rail, no-disconnect room switch, and control placement
**Role:** contributor-eligible member (so both rooms are reachable) · **Surfaces:** web (mobile-responsive)
**Steps:**
1. Open Chyme on a phone-width screen. Confirm the top is a single compact horizontal rail of room
   cards that scrolls left-to-right — not a full-height card that repeats the room title. Confirm the
   room title now appears only once below the rail (no duplicate).
2. In the **Main Room**, Join Room and unmute so you are live (you hear yourself/others).
3. While still joined and speaking, tap the **Weavers of the Commons** card, then tap **Main Room**
   again. Confirm you were **not** disconnected — the main-room call stays connected the whole time
   (audio never drops, you do not have to re-Join).
4. Look at the joined room's layout top-to-bottom: participant avatars (On Stage), then the audio
   controls (Mute/Unmute · Raise Hand · Leave), then the room chat. Confirm the controls sit **below**
   the avatars and **above** the chat, and you can mute/unmute without scrolling.
5. Android-app card: on a non-Android browser, confirm a "Get the Android app" card shows in the rail
   and opens the repo's GitHub Releases page filtered to the mobile releases
   (`https://github.com/chargingthefuture/chargingthefuture/releases?q=mobile`), with the newest
   `mobile-v*` release and its APK at the top. On an Android device, confirm the card is hidden and
   the rail is just the list of rooms.
**Expected:** The rooms rail is one compact scrollable row; the title is not duplicated and no vertical
space is wasted. Switching rooms never tears down a live call — a member joined in one room stays
connected while viewing the other and when switching back. The in-room controls render between the
avatars and the chat. The Android-app card links to the GitHub Releases page on a non-Android
browser and is hidden on Android.
**Result:** web ☐ mobile ☐ — notes:

---

### CH-20 · Room cap, quota notice, and the paused actions
**Role:** member and admin · **Surfaces:** all
**Precondition:** the admin can set environment values on a test deployment (the caps have defaults
and read from `CHYME_MAX_PARTICIPANTS`, `CHYME_MAX_GUEST_LISTENERS`, `CHYME_RED_BAND_MAX_PARTICIPANTS`,
`STREAM_VIDEO_MINUTES_BUDGET`). Two member accounts.
**Steps:**
1. Open the room as a member and read the line under the room name.
2. Set `CHYME_MAX_PARTICIPANTS=1`. Join the room as member A. As member B, press **Join Room**
   (web) or tap the room card (android).
3. As member A, leave; as member B, join again.
4. Set `STREAM_VIDEO_MINUTES_BUDGET` low enough that the month-to-date minutes on `/admin/chyme`
   read between 70% and 85% (Yellow). Reload the room as a member on web and android.
5. Lower it again until the meter reads between 85% and 95% (Orange). Reload; as a signed-out
   visitor open the public page; as a member look for the Back Channel action on another member's
   tile and, in the app, try an invite anyway.
6. Lower it until the meter reads 95% or more (Red) with `CHYME_RED_BAND_MAX_PARTICIPANTS=2`.
   Reload the room.
**Expected:** Step 1 reads the plain count — "1 participant · Signed in as @you" — with no cap
named; the cap appears only from 80% of it ("40 of 50 participants · nearly full") and at it
("50 of 50 participants · full"), on web and on the Android room card alike (M is the cap in
force; 50 by default). Step 2: member B is refused with "This room is full right now (1 of 1 people). Try again
in a minute." — on web as the error banner with the Join button back, on android as the join alert
— and no Stream call was made for B. Step 3: B gets in (the spot freed on A's explicit leave, not
45 seconds later). Step 4: a yellow notice under the room header on web, and under the room card on
android, reading that live audio is getting close to its monthly limit and what pauses if it gets
closer; nothing is paused; the notice carries no percentages or minute counts. Step 5: the notice
says listening without an account and Back Channel calls are paused until next month; the public
page shows "The room is live — sign in to join it." with the paused reason and no Tap to listen
button; the Back Channel tile action is gone, and a forced invite is answered 503 with the paused
reason. Step 6: the notice turns red and names the cap ("the room holds 2 people at a time"); the
header reads "N of 2"; a third member is refused as in step 2. On every step the same server line
appears on web and android — neither platform has its own wording.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### CH-21 · The Join pill follows the live connection (web)
**Role:** member · **Surfaces:** web (mobile-responsive)
**Precondition:** a phone browser, joined to the room.
**Steps:**
1. Join the room. Read the pill on the Join row.
2. Turn on Airplane Mode for ten seconds, then turn it off; watch the pill and the line under the
   stage.
3. Lock the phone for two minutes; unlock it and return to the tab.
**Expected:** Step 1: "✓ Joined" (green). Step 2: within a few seconds the pill turns amber and reads
"Reconnecting…" with the same line under the stage ("Reconnecting to the live room… the room cannot
hear you until this clears"); once the network is back it returns to "✓ Joined" on its own. Step 3:
on return the pill reads either "✓ Joined" (the SDK reconnected) or red "Connection lost — leave and
rejoin" with the red line under the stage; it never sits on a green "✓ Joined" while the SDK reports
the call offline. Before 2026-09-19 the pill was set once on join and never changed, so a locked
phone read "Joined" after the call had dropped.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### CH-22 · Coming up on TI Radio (scheduled rooms MVP)
**Role:** member and signed-out visitor · **Surfaces:** all
**Precondition:** at least one booked slot on the TI Radio guide (`/ti-radio`) in the next seven
days, and one slot booked for the current 90 minutes if the "On air now" mark is to be checked.
**Steps:**
1. As a member, open Chyme and read under the rooms rail. Drag the schedule sideways.
2. Sign out and open the Chyme route; read under the room list. Drag the schedule sideways.
3. In the Android app, open Chyme and tap the **Upcoming** tab.
4. Release every booked slot on the guide, then refresh each of the three screens.
5. Open the app with the network off (or point it at a stopped server) and read the same places.
**Expected:** Steps 1–3 show "Coming up on TI Radio": the next booked slots (at most five) that have
not ended, soonest first, each as "Today · 2:00 PM – 3:30 PM" (or "Tomorrow", or "Mon, Sep 21") in
the phone's own timezone, the discussion title, and "Hosted by @handle"; the slot happening right
now sits first with an "On air now" mark and the accent border; a "Full guide →" link opens
`/ti-radio` on web. On both web screens the slots are a sideways rail of equal-width cards — the
same shape and scroll as the rooms rail above it — so five booked slots cost one card's height and
the rest is a drag to the right (owner directive, 2026-09-20); the Android **Upcoming** tab keeps
its stacked list, since there the schedule has a tab to itself. All three read the same route (`GET /api/ti-radio/guide`), so the three lists
agree. Step 4: each screen reads "Nothing is scheduled this week" and says any approved member can
book a slot — never an empty box. Step 5: "Couldn't read the TI Radio guide" with the reason, never
"nothing scheduled" when the read failed. Nothing here creates a room or joins one: the guide says
when, and the main room is where.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### CH-23 · Moderation: mute, remove, let back in, hand-raise mode
**Role:** admin and two members · **Surfaces:** all
**Precondition:** the admin and members A and B in the main room (any mix of web and android).
**Steps:**
1. As the admin, look under A's tile and at the control row. As A, look under the admin's tile.
2. As the admin, tap **Mute** under A while A is unmuted.
3. As the admin, tap the control-row switch from **Open mic** to **Hand-raise mode**. Watch A's and
   B's screens.
4. As A, tap **Raise Hand**. As the admin, tap **Let speak** under A; then, later, **Listening**.
5. As the admin, tap **Remove** under B and confirm. As B, press Join again. Open `/admin/chyme`
   as the admin, find B under **Removed members**, tap **Let back in**; as B, press Join again.
6. Switch the room back to **Open mic**. As A, look at the control row.
7. As the admin, with Stream unreachable (or after the call has ended), tap **Mute** under A.
**Expected:** Step 1: the admin sees Mute and Remove under every other member's tile and the speak-mode
switch reading "Open mic" in the control row; A sees neither under anybody's tile and no switch.
Step 2: A's microphone goes off within a second (their own Mute button flips to Unmute); in open
mode A can unmute again. Step 3: A and B both hear nothing from each other, their microphone control
is replaced by "Listening — raise your hand to ask to speak", and a notice under the room header
(web) or above the controls (android) explains the mode; the admin keeps speaking; the admin's tiles
for A and B now read **Let speak**. Step 4: within one room poll (15s) A's microphone control
returns and A can unmute; after **Listening** A's microphone is off again and the notice is back.
Step 5: B drops from the call and from the count at once; B's Join answers "An admin removed you
from this room. You can come back once an admin lets you back in." in place of the stage (web
error banner; android alert); the admin screen lists B with the room and time; after **Let back
in** B's Join works. Step 6: everyone's microphone control is back and A can unmute. Step 7: the
action is recorded and the control shows one amber line beginning "Recorded, but Stream did not
apply it in the call:" with Stream's reason — never a silent failure and never a 500. Every step
writes a row in `chyme_admin_audit_trail`.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### Account deletion clears the back-channel call log

**Expected:** Deleting the account removes every back-channel call row the member appeared on —
calls they started and calls they received. The call log is ephemeral and has no history screen, so
there is nothing member-facing to re-check afterward; this is verified by the deletion engine's
registry entries.

---

## Admin walkthrough

Chyme has one admin surface: the Live Audio Usage screen (`/admin/chyme`, since 2026-09-19).
Room/chat/join access is gated by the shared "approved user or admin" eligibility rule.

### CH-A1 · Access gate (approved-user or admin only)
**Role:** admin and non-approved member · **Surfaces:** web
**Steps:**
1. As an unauthenticated caller, hit a Chyme route.
2. As a signed-in but non-approved, non-admin member, hit a Chyme route.
3. As an admin (or approved member), open the room.
**Expected:** Unauthenticated is denied (401). A non-approved, non-admin member is denied (403) with a
readable message. An approved member or an admin reaches the room. No moderation or speaker-grant
controls exist yet (every joiner may speak — see Known gaps).
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### CH-A2 · Live Audio Usage screen
**Role:** admin · **Surfaces:** web (mobile-responsive)
**Precondition:** at least one member has been in the room today (so the meter has a row).
**Steps:**
1. Open `/admin` and tap **Chyme: Live Audio Usage**. Read the screen.
2. Tap **Copy as text**, then paste into a note.
3. As a non-admin member, open `/admin/chyme` directly and call `GET /api/chyme/admin/stream-usage`.
4. Sit one member in the room for five minutes, then tap **Refresh**.
**Expected:** Step 1: the month-to-date participant-minutes against the budget (333,000 by default),
the percent and the band with its color, today's minutes, the straight-line projection to month end,
"Right now" (the main room live or not, members, signed-out listeners, the caps in force, whether
guest listening and Back Channel are open or paused, and the exact notice members see when there is
one), the split by surface (Chyme main room, Chyme Weavers room, Chyme signed-out listeners, Chyme
Back Channel calls, Beacon broadcasts, PeerProgramming cohort calls, Foundation calls — the Chyme
lines from heartbeats, the rest from Stream's participant-left events as people leave a call), the last
seven days, and the settings with their environment names. A line says one person in the room all
day costs 1,440 minutes — about 13% of the budget over a month. Step 2: the pasted text carries all
of that in plain lines, readable without the screen. Step 3: the page redirects to `/apps/chyme`;
the route answers 403. Step 4: the main room's surface and today's minutes grew by about five
(the count is credited from the 35-second heartbeats, so it lags by up to one interval).
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### CH-A3 · Removed members on the Live Audio Usage screen
**Role:** admin · **Surfaces:** web (mobile-responsive)
**Precondition:** at least one member removed from a room (CH-23 step 5).
**Steps:**
1. Open `/admin/chyme` and scroll to **Removed members**.
2. Tap **Let back in** on a row.
3. As a non-admin, call `GET /api/chyme/admin/removals` and `POST /api/chyme/admin/lift-removal`.
**Expected:** Step 1: each removed member by handle, the room, when, and the reason if one was given;
"Nobody is removed from a room right now." when the list is empty. Step 2: the row disappears and
the member can join again; if Stream did not unblock them the amber line says so and the row is
still gone (the app's own record is lifted). Step 3: 403 for both.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For CH-1, CH-2, CH-4, and CH-6, the android app and the mobile-responsive web layout must behave the
same: same room state, same chat validation, same presence/leave, same tip rules. Note any drift here
rather than filing three separate bugs. Persistent raised-hand display for *other* members is now at
parity: both web and android poll room state and render it (CH-5, #1599).

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section (rewritten 2026-09-19). If you
hit one of these, it is already tracked, not a new bug:

- Full-account delete is request-first; the final completion depends on the shared
  account-deletion orchestrator, which is the account area's.
- Hand-raise mode is enforced in the Stream call only when `CHYME_GUEST_STREAM_ROLE` is set (it is,
  as of 2026-09-18); without it the apps enforce the mode alone. That role is the same listen-only
  role guests carry, and it is owned by code: if a listening member is dropped from the call instead
  of listening quietly, the role's grants on the `default` call type have drifted — run the
  "Stream — Guest Listener Setup" workflow in **check** mode (Actions tab, works on a phone) and
  then in **apply** mode, and do not file it as a moderation bug. A Stream outage during a
  moderation action is reported to the admin in the control, not retried.
- Multi-room is deferred by the owner (2026-09-19) beyond the schedule: Chyme shows what is coming
  up on the TI Radio guide (CH-22), but there is no room creation, no room per slot, no search, and
  no reactions.
- The minute meter is an estimate credited from heartbeats (good to one interval per participant
  per session) and covers only the Chyme surfaces; the Stream dashboard is the bill of record.
- A member whose Stream connection dropped still holds a room spot until their 45-second presence
  window lapses.
- The per-IP rate limiter on the public routes is per process (resets on deploy); the guest cap,
  which bounds Stream cost, is in Postgres and shared.
- Web presence needs a foreground tab: no browser holds a live call in a locked or backgrounded
  page. The pill says so now; the Android app's foreground service is the answer for a long sit.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._
