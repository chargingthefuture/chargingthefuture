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
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) |

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
**Expected:** The normal message posts and persists. An empty/whitespace-only message is rejected
(the `chyme.message.send` contract requires 1 to 1000 characters after trimming). A message over
1000 characters is rejected by the same bound, not silently cut.
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
1. Join the call and stay in it for over a minute.
2. Press leave.
**Expected:** While in the call you keep counting as present (the heartbeat refreshes your row every
35 seconds). On leave, your row is dropped and you disappear from the participant list — and any
raised hand clears. The room shows "Live" only while at least one fresh member is present.
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
1. Sign out. Open the Chyme plugin route.
2. Listen to the live room; look for any speak control.
**Expected:** You see the public view and can listen to the live room, joined muted with no speak
control. The view shows marketing/empty-state content only — no private or per-user data, and the
room list is an honest empty state. Sign-in and join point at the hosted sign-in URL. When the room
is not live, there is no listen audio.
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
audio room connect normally.
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
logged for retry/backfill — the account is still deleted.
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

## Admin walkthrough

Chyme has no plugin-specific admin UI in this build. Room/chat/join access is gated by the shared
"approved user or admin" eligibility rule, so the only admin-relevant check is access enforcement.

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

## Parity check (web ↔ android)

For CH-1, CH-2, CH-4, and CH-6, the android app and the mobile-responsive web layout must behave the
same: same room state, same chat validation, same presence/leave, same tip rules. Note any drift here
rather than filing three separate bugs. Persistent raised-hand display for *other* members is now at
parity: both web and android poll room state and render it (CH-5, #1599).

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- Full-account delete is request-first; the final completion still depends on the broader
  account-deletion workflow.
- No Chyme-specific admin or moderation tools in this build (out of MVP scope).
- Speaker-vs-listener moderation (request-to-speak) is not built on either platform — every joiner
  may speak.
- Multi-room is unbuilt: one hardcoded shared room only. No create-room, room list, scheduling,
  search, reactions, or speaker/audience promotion routes exist.
- Account/data deletion has no in-app entry point after the Chyme buttons were removed; the deletion
  endpoints still work but a designed account-settings surface to call them is not built.
- Guest listen-only is enforced on the server only when `CHYME_GUEST_STREAM_ROLE` and the matching
  Stream role are configured; until then it is client-only enforcement.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._
