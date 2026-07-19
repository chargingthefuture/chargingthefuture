# Beacon — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- beacon`

| | |
|---|---|
| **Plugin** | Beacon (`beacon`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-beacon-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.
- A real go-live needs the owner's Stream dashboard setup (call-type/recording config + webhook
  registration). When Stream is unconfigured, every surface should stay in its calm idle state and
  nothing should throw — that itself is a valid check.

---

## Core smoke (every session)

One-way admin broadcast; public watch, sign-in to chat. Member role unless noted.

1. **Idle state loads — and Beacon is reachable from the app list.** The Apps launcher shows a
   Beacon tile (database registry row, nav rank 230) that opens `/apps/beacon`. Broadcast copy
   says "from Farah" (single operator), never "from the team". When nothing is live, a calm "No
   live event right now" screen renders ("When Farah goes live, it will appear here"), with the
   last replay if one exists. No spinner stuck, no error. → web ☐ mobile ☐ android ☐
2. **Anyone can watch, no sign-in.** Sign out and open `/apps/beacon`. The viewer surface still loads
   over the public path (HLS); there is no phone-number or account wall to watch. → web ☐ mobile ☐ android ☐
3. **Chat is gated to members.** As a signed-out viewer, confirm chat is read-only / shows a "sign in
   to chat" prompt — you cannot post. → web ☐ mobile ☐ android ☐
4. **"Live and public" indicator.** During (or simulating) a live event, an unmistakable on-screen
   marker states the broadcast and chat are public. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### BCN-1 · Watch the idle / replay state
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Precondition:** seed inserts one past `ended` event ("State of the TI Skills Economy") with a
recording URL.
**Steps:**
1. Open `/apps/beacon` with no live event.
2. Open the last replay.
**Expected:** The idle screen shows "No live event right now" plus the last replay. Opening the replay
plays the recording. On android the HLS player runs only in an EAS dev/production build (not Expo Go).
Admins see the shared Admin pill in the member shell header, and the admin screen header shows a
"Member view" pill opening `/apps/beacon`.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### BCN-2 · Watch a live broadcast (public)
**Role:** signed-out viewer · **Surfaces:** all
**Precondition:** an admin has gone live (BCN-A2).
**Steps:**
1. Open `/apps/beacon` with the link, signed out.
**Expected:** The live broadcast plays over HLS with no sign-in (native HLS on Safari/iOS, `hls.js`
elsewhere). The "live and public" indicator is visible. You can watch but the chat shows a
"sign in to chat" prompt.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### BCN-3 · Member live chat and reactions
**Role:** member · **Surfaces:** all
**Precondition:** a live event in progress.
**Steps:**
1. Sign in and open the live event.
2. Post a chat message and send a reaction.
**Expected:** A signed-in member requests a chat token and can post messages and reactions in real
time. The live chat is ephemeral (Stream only, not stored in our database). Every message is tied to
the member's real account.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### BCN-4 · Replay appears in the Commons
**Role:** member · **Surfaces:** all
**Precondition:** an event has ended and its recording is ready.
**Steps:**
1. After the event ends, check the Commons feed.
**Expected:** A "🔴 Live now" entry appeared on go-live (linking to `/apps/beacon`), and a
"▶️ Watch the replay" entry appears once the recording is ready. The replay is posted only once
(never double-posted).
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### BCN-A1 · Create an event
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Open `/admin/beacon`.
2. Create an event with a title and description.
**Expected:** The event is created as a `draft`. A non-admin cannot reach the admin controls (admin
commands are deny-by-default).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### BCN-A2 · Go Live (both input paths)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. For a phone demo: read the per-event RTMP ingest URL + stream key and push the phone screen from a
   mobile broadcaster app.
2. For a desktop demo: use "Share screen" to capture a desktop screen/window in the browser.
3. Press Go Live.
**Expected:** Go Live flips the event out of backstage to `live` and auto-posts the "live now" notice
to the Commons. The host stage mounts after go-live; HLS + recording start once a host is actually
publishing (the in-browser screen-share triggers `start-broadcast`). Only the host can publish —
viewers never can. On error, the underlying Stream message is surfaced, not a generic text.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### BCN-A3 · Moderate the chat
**Role:** admin · **Surfaces:** web (admin surface)
**Precondition:** a live event with member chat.
**Steps:**
1. Mute a member.
2. Ban a member from the event chat.
3. Enable slow-mode.
**Expected:** Each action takes effect in the live chat and is recorded in the admin audit trail. The
admin is the channel moderator.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### BCN-A4 · End the event
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Press End on the live event.
**Expected:** The broadcast stops and the call ends reliably (so Stream billing stops); status flips
to `ended`. When the recording is ready, the replay auto-posts to the Commons (idempotent).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### BCN-A5 · Event history
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Open the event history list.
**Expected:** Past events and their recordings are listed, including the seeded past event.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For BCN-1, BCN-2, and BCN-3, the android viewer and the mobile-responsive web layout must behave the
same: the same three states (live HLS player + "live and public" indicator, replay, idle), the same
member-chat gate (signed-in posts; anonymous sees a sign-in-to-chat prompt and still watches), and the
same 15-second poll of the current event. Admin broadcasting is **web-only** — there is no android
admin surface by design (the admin pushes the phone screen through a third-party RTMP app). Note any
viewer drift here rather than filing separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit
one of these, it is already tracked, not a new bug:

- Beacon has no manual refresh control (the app-wide refresh rollout deliberately skipped it): the
  viewer already polls the current-event state every 15 seconds on web and android, so live/idle/replay
  transitions appear on their own. Do not file a missing refresh button or pull-to-refresh as a bug.
- The exact Stream `livestream` role/permission config for host vs viewer (Stream dashboard call-type
  setup) is documented alongside the build, not enforced by this script.
- Whether anonymous viewers see the live chat read-only or just a "sign in to chat" panel — leaning
  read-only so the room feels alive.
- Replay hosting links to Stream's recording URL rather than re-hosting, for now.
- Android viewer parity shipped; android admin broadcasting is intentionally out of scope.
