# Beacon — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

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
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
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
   last replay if one exists. No spinner stuck, no error. → web ☐ mobile ☐
2. **Anyone can watch, no sign-in.** Sign out and open `/apps/beacon`. The viewer surface still loads
   over the public path (HLS); there is no phone-number or account wall to watch. → web ☐ mobile ☐
3. **Chat is gated to members.** As a signed-out viewer, confirm chat is read-only / shows a "sign in
   to chat" prompt — you cannot post. → web ☐ mobile ☐
4. **"Live and public" indicator.** During (or simulating) a live event, an unmistakable on-screen
   marker states the broadcast and chat are public. → web ☐ mobile ☐

---

## Member walkthrough

### BCN-1 · Watch the idle / replay state
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Precondition:** seed inserts one past `ended` event ("State of the Skills Economy") with a
recording URL.
**Steps:**
1. Open `/apps/beacon` with no live event.
2. Open the last replay.
**Expected:** The idle screen shows "No live event right now", a "Missed it? Watch the recordings"
button, and the last replay. The button opens the blog's streams page in a new tab. Signed out on a
phone, scrolling to the bottom moves the button and the replay clear of the invite cards in the corner.
Opening the replay plays the recording. On android the HLS player runs only in an EAS dev/production build (not Expo Go).
Admins see the shared Admin pill in the member shell header, and the admin screen header shows a
"Member view" pill opening `/apps/beacon`.
**Result:** web ☐ mobile ☐ — notes:

### BCN-2 · Watch a live broadcast (public)
**Role:** signed-out viewer · **Surfaces:** all
**Precondition:** an admin has gone live (BCN-A2).
**Steps:**
1. Open `/apps/beacon` with the link, signed out.
**Expected:** The live broadcast plays over HLS with no sign-in (native HLS on Safari/iOS, `hls.js`
elsewhere). The "live and public" indicator is visible. You can watch but the chat shows a
"sign in to chat" prompt.
**Result:** web ☐ mobile ☐ — notes:

### BCN-3 · Member live chat and reactions
**Role:** member · **Surfaces:** all
**Precondition:** a live event in progress.
**Steps:**
1. Sign in and open the live event.
2. Post a chat message and send a reaction.
**Expected:** A signed-in member requests a chat token and can post messages and reactions in real
time. The live chat is ephemeral (Stream only, not stored in our database). Every message is tied to
the member's real account.
**Result:** web ☐ mobile ☐ — notes:

### BCN-4 · Replay appears in the Commons
**Role:** member · **Surfaces:** all
**Precondition:** an event has ended and its recording is ready.
**Steps:**
1. After the event ends, check the Commons feed.
**Expected:** A "🔴 Live now" entry appeared on go-live, and a "▶️ Watch the replay" entry appears
once the recording is ready. Both entries show the full web address
`https://app.chargingthefuture.com/apps/beacon` — a tappable link, not a bare `/apps/beacon` path —
and tapping it opens the Beacon viewer. The replay is posted only once (never double-posted).
**Result:** web ☐ mobile ☐ — notes:

---

### BCN-4b · Every replay is listed publicly and in the podcast feed
**Role:** signed-out visitor · **Surfaces:** web
**Precondition:** at least one event has ended with its recording ready (BCN-4).
**Steps:**
1. Signed out, open `https://chargingthefuture.github.io/chargingthefuture/streams`.
2. Press play on the newest entry.
3. Open `https://app.chargingthefuture.com/api/beacon/replays/feed` and add it to a feed reader.
4. Open `https://app.chargingthefuture.com/api/beacon/replays/not-an-id/recording`.
**Expected:** Step 1 lists every recorded broadcast, newest first, 20 to a page, with the range shown
and the page number in the address. Step 2 plays the recording with no sign-in. Step 3 is accepted
by the reader and shows one item per replay, newest first, each with a playable attachment. Step 4
answers "No recorded broadcast has that id." with a 404. A draft or live event never appears in the
list or the feed.
5. After the next run of the Actions workflow "Beacon — Keep a copy of each recording" (or run it by
   hand), open the `beacon-recordings` release in the repository and repeat step 2.
**Expected (step 5):** the release holds `<eventId>.mp4` for each recorded broadcast, the run summary
lists each one as copied, and the player plays it; the recording address now sends the player to
the release file.
**Result:** web ☐ — notes:

---

### BCN-DEL · Account deletion clears the member's Stream chat copy (privacy)
**Role:** member · **Surfaces:** api/data. **Precondition:** a test member who has sent at least one
message in a Beacon event's live chat; access to the Stream dashboard for the app behind `STREAM_API_KEY`.
**Steps:**
1. As that member, chat in a live Beacon event, then delete the entire account
   (`DELETE /api/account/full-account`, or delete the user in Clerk to exercise the webhook path — both
   run the deletion orchestrator, which now includes a Beacon registry entry).
2. In the Stream dashboard, look up the member's Stream user `beacon-<userId>` and their messages in the
   Beacon event chat channel.
**Expected:** The member's Stream user `beacon-<userId>` is hard-deleted with messages marked deleted —
their live-chat copy no longer lingers on Stream. Beacon stores no per-member Postgres rows, so nothing
is removed from Beacon tables; `beacon_events` (public broadcast history) and the admin audit trail are
retained by design. If Stream is down at delete time, the deletion still succeeds and the failure is
logged for retry.
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

### BCN-A1 · Create an event
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Open `/admin/beacon`.
2. Create an event with a title and description.
**Expected:** The event is created as a `draft`. A non-admin cannot reach the admin controls (admin
commands are deny-by-default).
**Result:** web ☐ mobile ☐ — notes:

### BCN-A1b · Delete a draft (and confirm broadcast history cannot be deleted)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Open `/admin/beacon` and create a throwaway draft, e.g. "Delete me".
2. In Event history, find that row and press `Delete`. The button should change to `Confirm delete`
   with a `Cancel` beside it.
3. Press `Cancel` first — the row must still be there, untouched.
4. Press `Delete` again, then `Confirm delete`.
5. Now look at any `ended` event in the same list.
**Expected:** After step 4 the draft disappears from Event history and the page shows "Draft deleted."
A single click never deletes anything — step 3 proves the first click only arms it. In step 5 the
`ended` event has **no** Delete button at all: broadcast history is not deletable from the app. If you
call `DELETE /api/beacon/<id>` directly against a `live` or `ended` event it must come back 409
(`beacon_conflict`) and leave the row in place, and that refused attempt is written to
`beacon_events_admin_audit_trail` with `policy_status = 'deny'`. A successful draft delete is written
there too, with `policy_status = 'allow'`.
**Result:** web ☐ mobile ☐ — notes:

### BCN-A1c · Event history shows Eastern Time and recovers a missed recording
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Open `/admin/beacon` and look at Event history.
2. Find an `ended` event and read the line under its title.
3. If it shows `recording ready`, press `Replay`.
4. Find an `ended` event that showed no recording before, reload the page, and read its line again.
**Expected:** Every row shows a time in Eastern Time after its status, e.g.
`ended · Oct 6, 2026, 3:05 PM ET`: when the event went live, or when it was created for a draft.
Step 3 opens `/api/beacon/replays/<id>/recording` and plays the recording. In step 4, if Stream holds
a recording for that event, the row now reads `recording ready`, a `Replay` button appears, and the
replay is posted to the Commons once (a second reload posts nothing more). If Stream holds none, the
row reads `no recording found`.
5. On that row, open `Log`, then press `Copy log` and paste it into a note.
**Expected (step 5):** The Log's first line starts `Recording:` and says what Stream answered: no
recording for the call, recordings with no file yet, or the error the lookup hit. Below it, each
logged broadcast step with its time in ET (went live, the feed and recording asked to start, Stream
started / stopped / failed the recording, recording file ready, ended); a failed step carries its
reason after a dash. An event broadcast before this change may show `No broadcast steps were logged
for this event.` The pasted text starts with the event title and matches what the Log shows.
**Result:** web ☐ mobile ☐ — notes:

### BCN-A2 · Go Live (both input paths)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Press Go Live. The RTMP ingest URL + stream key do not exist before this press — they are minted
   by it, so there is nothing to copy until Go Live has succeeded.
2. For a phone demo: copy the per-event RTMP ingest URL + stream key and push the phone screen from a
   mobile broadcaster app. Setup detail is in `ctf/docs/developer/BEACON_PHONE_STREAMING_GUIDE.md`.
3. For a desktop demo: use "Share screen" to capture a desktop screen/window in the browser.
**Expected:** Go Live flips the event out of backstage to `live` and auto-posts the "live now" notice
to the Commons. The host stage mounts after go-live; HLS + recording start once a host is actually
publishing — either the in-browser screen-share posting to `start-broadcast`, or Stream's
`call.session_participant_joined` webhook when a phone's RTMP feed joins the call. Only the host can
publish — viewers never can. On error, the underlying Stream message is surfaced, not a generic text.
Opening the call must succeed on the first press: Beacon asks Stream to record at 720p, and a
missing recording size is what previously made every Go Live come back with `(400)` and
`recording quality is required when audio_only is false and recording is enabled`. Seeing that
message again means the recording settings sent on call creation regressed.
**Result:** web ☐ mobile ☐ — notes:

### BCN-A2b · A failed Go Live says which step failed
**Role:** admin · **Surfaces:** web (admin surface)
**Precondition:** a draft event. To force a failure, point the app at a Stream app whose Video product
is unavailable (or temporarily set a wrong `STREAM_API_SECRET`); with Stream fully unset you get the
not-configured case in the expectation below instead.
**Steps:**
1. Open the draft and press Go Live.
2. Read the red banner at the top of the admin screen.
**Expected:** The banner names the step that failed and carries the reason behind it — "Could not load
the event: …", "Broadcast input unavailable — preparing the host failed: …", or "Broadcast input
unavailable — opening the broadcast call failed: …" with Stream's own text plus the HTTP status and
endpoint (for example `failed (403)`). With Stream not configured at all the banner reads "Live video
is not configured." No banner ever shows a bare "Broadcast input unavailable." with no reason, and no
API key or stream key appears in it. A Stream Chat problem alone (the host's chat registration) must
not stop the broadcast: the event still goes live and only the host's chat name/moderator role is
missing.
**Result:** web ☐ mobile ☐ — notes:

### BCN-A2c · A phone-only broadcast reaches viewers and produces a replay
**Role:** admin · **Surfaces:** web (admin surface + public viewer)
**Precondition:** a phone with a broadcaster app set up per
`ctf/docs/developer/BEACON_PHONE_STREAMING_GUIDE.md`. **No computer touches the broadcast** — this
case exists to prove the phone path completes on its own, so do not click "Share screen" anywhere
during it.
**Steps:**
1. Create an event and press Go Live on the phone.
2. Copy the RTMP URL + stream key into the broadcaster app and start sending.
3. Open `/apps/beacon` signed out, on a different device, and wait up to a minute.
4. Stop the broadcaster app and press End broadcast.
5. Check the Commons after the recording is delivered.
**Expected:** Video appears for the signed-out viewer without anyone sharing a screen. Behind it,
Stream's `call.session_participant_joined` webhook fires when the phone's RTMP feed joins, the route
starts HLS and the recording for that `live` event, and `GET /api/beacon/current` begins returning an
`hlsPlaybackUrl`. After the event ends, `call.recording_ready` arrives and the replay is posted to the
Commons. If the webhook does not arrive, the live page starts them instead: within about 15 seconds
of the phone connecting, while the admin page or any viewer page is open. The event's Log in Event
history then shows `Live page asked to start the feed and recording` (with Stream's reason if it
failed) instead of `Broadcaster joined; …`. An empty player after a minute means neither worked;
open the event's Log for the reason. Before 2026-08-10 this case failed by design: only an in-browser
screen-share started egress.
**Result:** web ☐ mobile ☐ — notes:

### BCN-A2c2 · A phone broadcast in demo mode still records
**Role:** admin with demo mode on · **Surfaces:** web (admin surface)
**Steps:**
1. With demo mode on for your account, repeat BCN-A2c steps 1, 2 and 4.
2. Wait a minute, reload `/admin/beacon`, and open the event's Log in Event history.
**Expected:** The Log shows `Phone feed connected; feed and recording asked to start` or
`Broadcaster joined; …` with `ok (staging Stream app)`, then `Stream started recording`, and after the
end `Recording file ready`; the row reads `recording ready`. A `Stream message refused` line means a
delivery's signature matched neither app's secret: the secret saved for that app differs from the
one in the Stream dashboard.
**Result:** web ☐ mobile ☐ — notes:

### BCN-A2d · A refused start-broadcast is shown on the host stage
**Role:** admin · **Surfaces:** web (admin surface, desktop)
**Precondition:** a live event, opened in the admin screen, with Stream set up so the refusal can be
forced (for example a Stream app whose recording or HLS is turned off).
**Steps:**
1. Press Share screen and pick a window.
2. Read the line next to the Stop sharing button.
**Expected:** When start-broadcast is refused, the line reads "The public broadcast and recording did
not start:" followed by the route's reason, in red, instead of "Your screen is live to the
broadcast." Stopping and sharing again retries. When it succeeds the line reads "Your screen is live
to the broadcast." as before.
**Result:** web ☐ mobile ☐ — notes:

### BCN-A2e · A screen-share broadcast produces a recording, and the event chat accepts messages
**Role:** admin · **Surfaces:** web (admin surface, desktop)
**Precondition:** a draft event, and the "Check — Stream Chat Settings" workflow last ran green.
**Steps:**
1. Press Go Live, then Share screen and pick a window. Leave it live for at least a minute.
2. Type a message in the event chat and send it.
3. Press End. Wait a few minutes, then reload the admin screen and read the event's line in Event
   history.
**Expected:** Step 1: the line next to Stop sharing reads "Your screen is live to the broadcast." Step
2: the message posts. It must not show "Message Failed · Unauthorized" or "pending messages not
enabled for this app"; that text means "Mark Messages Pending" is on again for the `livestream`
channel type, and the workflow with fix ticked turns it off. Step 3: the line reads `recording ready`
with a Replay button, and the replay is posted to the Commons once. `no recording found` minutes after
the end means recording never started. Until 2026-10-06 every event ended that way, because
recording was requested with a second go-live instead of Stream's start-recording request.
**Result:** web ☐ mobile ☐ — notes:

### BCN-A3 · Moderate the chat
**Role:** admin · **Surfaces:** web (admin surface)
**Precondition:** a live event with member chat.
**Steps:**
1. Mute a member.
2. Ban a member from the event chat.
3. Enable slow-mode.
**Expected:** Each action takes effect in the live chat and is recorded in the admin audit trail. The
admin is the channel moderator.
**Result:** web ☐ mobile ☐ — notes:

### BCN-A4 · End the event
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Press End on the live event.
**Expected:** The broadcast stops and the call ends reliably (so Stream billing stops); status flips
to `ended`. When the recording is ready, the replay auto-posts to the Commons (idempotent).
**Result:** web ☐ mobile ☐ — notes:

### BCN-A5 · Event history
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Open the event history list.
**Expected:** Past events and their recordings are listed, including the seeded past event.
**Result:** web ☐ mobile ☐ — notes:

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

## Meter check (2026-09-19)

After a publisher leaves a Beacon call, `/admin/chyme` (Live Audio Usage) shows the minutes under
"Beacon broadcasts (publishers)" within a minute — credited from Stream's
`call.session_participant_left` event through this plugin's webhook route. Viewers on the public
HLS feed never join the call and never appear there.

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

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._
