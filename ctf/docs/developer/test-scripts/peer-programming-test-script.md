# PeerProgramming — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Generated from the feature inventory and command contracts for `peer-programming`; this is the runnable checklist for a human tester on a real device. Regenerate with: `pnpm --dir ctf test-script:generate -- peer-programming`

| Field | Value |
|---|---|
| **Plugin** | PeerProgramming |
| **Visibility** | member |
| **Roles to test** | member, admin |
| **Surfaces** | web (`/apps/peer-programming`, `/admin/peer-programming`) · android (`PeerProgramming.tsx`, `AdminPeerProgramming.tsx`) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-peer-programming-feature-inventory.md` |
| **Generated** | 2026-07-18 (commit 34badcbb) |

---

## How to run this

- Mark each surface checkbox as **✅ pass**, **❌ fail**, or **⛔ blocked**.
- A ❌ on any checkbox becomes a row in the Bug Reporting plugin — record the case ID, surface, steps, and what you actually saw.
- Run **Core smoke** at the start of every test session before any other section.
- "web" means the Next.js app in a desktop browser unless stated otherwise. "android" means the React Native app on a physical Android device or EAS dev build — Expo Go will not work for live video cases.
- The seed must complete without error before you start.

---

## Core smoke (every session)

PeerProgramming puts members into a small group each week and gives that group a room to meet in:
a live video call where the cohort sees and hears each other, and a text conversation that carries on
between calls for whoever could not make it. What has to work is being placed in a cohort, being told
about it, being able to join the call, and being able to post and reply whenever you get to it. A
quiet text room is not by itself a failure. While the community is small this normally runs as one
standing room, Cohort 1, that everyone joins (inventory Intent and Outcome, 2026-08-18).

Session timing is ad hoc by decision: a cohort holds as many or as few calls as it wants, whenever
its members want them. There is no scheduled meeting hour and no reminder, so the absence of one is
not a bug to file.

These are the checks that must pass before anything else is worth testing.

**1. Room loads for a seeded member**
Sign in as a seeded member. Navigate to `/apps/peer-programming` (web) or open the PeerProgramming screen (android). The room loads without an error banner. A cohort or the "you're not in a cohort yet" / empty state is visible within a few seconds.
web ☐

**2. Admin page loads for a seeded admin**
Sign in as a seeded admin. Navigate to `/admin/peer-programming` (web) or open the Admin PeerProgramming screen (android). The admin surface renders — topic form and cohort-assignment controls are visible, not a blank page or access-denied notice.
web ☐

**3. Non-admin is blocked from the admin surface**
While signed in as a regular member, navigate to `/admin/peer-programming` (web) or open the Admin screen (android). You must not see admin controls. Expect a redirect, access-denied notice, or the screen is not reachable.
web ☐

**4. Seed data is present**
After the seed, the admin cohort list shows at least one cohort and the topic form shows a topic for the current week (or a recent week).
web ☐

**5. The cohort's video call opens**
Signed in as a cohort member, open the Session tab and press "Join Session." The call opens with your
own camera tile, and mute, camera, and leave controls are visible; leaving returns to the Session tab
without an error. If live video is not configured in this environment, the readable "live video
unavailable" notice counts as a pass here — the full walkthrough covers both paths in PP-10 and
PP-11. On android this needs an EAS dev build, not Expo Go.
web ☐

---

## Member walkthrough

### PP-1 — Room header shows topic guidance and cohort info

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a seeded member who is in a cohort. Seed has been run.

**Steps:**
1. Open `/apps/peer-programming` (web) or the PeerProgramming screen (android).
2. Look at the room header area.

**Expected:** The weekly topic title and guidance text are displayed. A participation summary (member count or cohort label such as "C1") is also visible. No placeholder or "undefined" text appears. On web, the header back chevron returns to the page you came from (falling back to All Apps when the screen was opened directly), and an admin viewing the member shell sees the "Admin" pill in the header; the admin screen header shows a "Member view" pill opening `/apps/peer-programming`.

Result: web ☐

---

### PP-2 — Cohort member posts a message

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a seeded member who is a member of a cohort (not just a listener). The room has loaded.

**Steps:**
1. On web: go to the Direct Line / Session tab and find the message composer. On android: go to the Session tab.
2. Type a short message, e.g. "Test post from manual run".
3. Tap/click Send.

**Expected:** The message appears in the message list attributed to your username (e.g. `@alice` or a short member label). The composer clears after sending. No error message is shown. Each message's stamp shows **both a date and a time** (e.g. "Jul 21, 09:21 PM"), not a time alone, so messages from different days can be told apart. In single standing Cohort 1 mode, simply opening the room (or the live session) is what enrolls you in Cohort 1 so you can post — a member who has opened PeerProgramming at least once can post; a pure listen-in / read never enrolls anyone.

Result: web ☐

---

### PP-2b — A cohort message notifies the other members

**Role:** member · **Surfaces:** web

**Precondition:** Two seeded members (A and B) are in the same cohort. Sign in as A in one session; B is the recipient under test.

**Steps:**
1. As member A, post a message in the cohort's Direct Line.
2. Sign in as member B and open the 🔔 Notifications tab in the Commons (the bell chip next to @ and 📣).

**Expected:** B sees a "New message in your PeerProgramming cohort." notification whose "Open" deep-links to the cohort room. A (the sender) does **not** get a notification for their own message. Posting the same message once produces at most one notification per other member. If B has turned on the "Community" device-push toggle (in the 🔔 tab's "Manage what pings your device"), B's device also gets a ping.

Result: web ☐

---

### PP-3 — Message composer is hidden for a listen-in viewer

**Role:** member (listening in on another cohort) · **Surfaces:** web, android

**Precondition:** Signed in as a member. Single standing Cohort 1 mode is OFF (or there are multiple cohorts). Open a cohort you are not a member of using "Listen in" or `?cohortId=<other-id>`.

**Steps:**
1. On web: in the Cohorts tab, click "Listen in" on a cohort you do not belong to.
2. On android: tap "Listen in" on a cohort in the running cohorts list.
3. Switch to the Session / Direct Line tab.

**Expected:** No message composer is visible. A "you're listening in — read-only" notice or similar is shown instead. You can read existing messages but there is no input field or send button.

Result: web ☐

---

### PP-4 — Threaded reply on an existing message

**Role:** member · **Surfaces:** web

**Precondition:** Signed in as a cohort member. At least one message exists in the room (post one via PP-2 if needed).

**Steps:**
1. Find an existing message in the Direct Line / chat area.
2. Open its reply thread (click the reply icon or thread link).
3. Type a reply, e.g. "This is a reply".
4. Submit the reply.

**Expected:** The reply appears nested under or linked to the parent message. The reply is attributed to your username. No error is shown. Refreshing the page still shows the reply (persistence check).

Result: web ☐

---

### PP-5 — Non-member cannot post a message (server enforcement)

**Role:** member (listener) · **Surfaces:** web

**Precondition:** You have a second browser session or can use browser dev tools. Sign in as a member who is NOT in cohort X. Obtain cohort X's ID from the URL or cohort list.

**Steps:**
1. In browser dev tools (Network tab or fetch console), send a POST to `/api/peer-programming/messages` with body `{ "cohortId": "<cohort-X-id>", "body": "unauthorized post" }` and headers `Content-Type: application/json`, `x-ctf-csrf: 1`.
2. Check the response status and body.

**Expected:** The server returns a non-2xx response (403 or similar). The message does not appear in cohort X's message list.

Result: web ☐

---

### PP-6 — Running cohorts list and listen-in navigation

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member. Seed has produced at least one cohort. (In single standing Cohort 1 mode, your own cohort is the only one, so the "Other running cohorts" section will be empty — skip the listen-in sub-step and just confirm your own cohort shows correctly once.)

**Steps:**
1. Open the Cohorts tab (web) or the cohorts list area (android).
2. Confirm your own cohort shows a member count and is labeled as your cohort (an "Enter" button on web; the current cohort view on android).
3. If another cohort is listed, tap/click "Listen in."
4. Confirm a read-only view of that cohort opens with a "Listening in" notice.
5. Return to your own cohort using the back/leave control.

**Expected:** Your own cohort is shown once (not duplicated). The member count matches the roster visible elsewhere. Listen-in opens the other cohort read-only. Returning to your own cohort restores the full member view.

Result: web ☐

---

### PP-7 — Member roster shows usernames

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member in a cohort that has at least two members (seeded).

**Steps:**
1. Open the Cohorts tab or cohort detail area.
2. Look at the member list for your cohort.

**Expected:** Each member is shown as `@username` or a short fallback like `Member <short-id>`. No raw UUID strings are displayed as the primary label. "Anonymous" is not used for all entries.

Result: web ☐

---

### PP-8 — Feedback submission (only after your cohort has ended)

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a member of a cohort that an admin has ended (see PP-A11). Turn single standing Cohort 1 mode OFF first — the standing cohort can never be ended, so the box never appears while that mode is on.

**Steps:**
1. While the cohort is still running, open the Cohorts tab and scroll to the bottom.
2. Have an admin end that cohort (PP-A11), then reload the Cohorts tab.
3. Type a note in the "Session Feedback" box and submit it.

**Expected:** At step 1 there is **no** "Session Feedback" box — feedback is only asked for once the cohort is over. At step 2 the box appears, headed "Session Feedback" with the line "Your cohort has ended. Tell us how it went." At step 3 a success confirmation is shown, no error banner appears, and the note field clears.

Result: web ☐

---

### PP-8b — Feedback box stays hidden when listening in on someone else's ended cohort

**Role:** member · **Surfaces:** web

**Precondition:** Signed in as a member whose own cohort is still running. Another cohort has been ended (PP-A11) and you can reach it via its "Open room →" / listen-in link.

**Steps:**
1. Open the ended cohort you are not a member of.
2. Scroll to the bottom of the Cohorts tab.

**Expected:** No "Session Feedback" box. The box is only for reviewing your own cohort, so listening in on someone else's ended cohort never offers it.

Result: web ☐

---

### PP-9 — Feedback rejects an invalid release surface

**Role:** member · **Surfaces:** web

**Precondition:** Signed in as a member. Have a cohort ID ready.

**Steps:**
1. In dev tools, send `POST /api/peer-programming/feedback` with body `{ "cohortId": "<id>", "issueType": "bug", "suggestionCategory": "ux", "releaseSurface": "desktop" }` and the CSRF header.
2. Check the response.

**Expected:** The server returns 400. The feedback is not saved.

Result: web ☐

---

### PP-10 — Join Session (live video) — cohort member

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a cohort member. Stream Video is configured in the environment (if not, expect a 503 — see PP-11). On android, this requires an EAS dev build, not Expo Go.

**Steps:**
1. Open the Session tab.
2. Click/tap "Join Session."
3. Allow camera and microphone permissions if prompted.

**Expected:** A video call UI appears with your own camera tile. Controls for mute, camera toggle, and leave are visible. Leaving the call returns to the Session tab without an error.

Result: web ☐

---

### PP-11 — Join Session returns a clear error when Stream is not configured

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a cohort member. Stream Video is NOT configured (no API key/secret in env), or simulate by sending the request directly.

**Steps:**
1. Open the Session tab and click/tap "Join Session."

**Expected:** A readable error message is shown — e.g. "live video unavailable" or similar — not a raw error code or blank screen. The room does not crash.

Result: web ☐

---

### PP-12 — Member with no cohort sees empty state, not a crash

**Role:** member · **Surfaces:** web, android

**Precondition:** Sign in as a member account that has never been assigned to a cohort and is not in single standing Cohort 1 mode (or clear their membership from the DB). Alternatively, use a fresh account before the weekly assignment runs.

**Steps:**
1. Open `/apps/peer-programming` (web) or the PeerProgramming screen (android).

**Expected:** An empty state is shown — e.g. "you haven't been assigned to a cohort yet" or a prompt to check back. No crash, no blank white screen, no unhandled error.

Result: web ☐

---

### PP-13 — Pull-to-refresh / refresh button reloads room without full-screen flash

**Role:** member · **Surfaces:** web, android

**Precondition:** Signed in as a cohort member. Room is loaded.

**Steps:**
1. On web: click the Refresh button in the room header.
2. On android: pull down on the cohort tab's scroll view.

**Expected:** The room content reloads (messages and cohort data refresh). The full-screen loading spinner does not appear — the refresh happens in the background while the existing content stays visible.

Result: web ☐

---

### PP-14 — Auto-join to standing Cohort 1 in single standing mode

**Role:** member · **Surfaces:** web, android

**Precondition:** Single standing Cohort 1 mode is ON (the default). Sign in as a member who has NOT previously opened PeerProgramming. (Create a fresh test account or use one not in any cohort.)

**Steps:**
1. Open `/apps/peer-programming` (web) or the PeerProgramming screen (android).

**Expected:** The member is placed into Cohort 1 automatically — no "assign me" button needed. The room loads with cohort C1 visible and the member can post.

Result: web ☐

---

## Admin walkthrough

### PP-A1 — Set or update the weekly topic

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. The admin surface is open.

**Steps:**
1. On web: go to `/admin/peer-programming` and find the topic form. On android: open Admin PeerProgramming and find the topic section.
2. Enter a title (e.g. "Manual test topic") and guidance body.
3. Set the week start date to the current Monday's date in `YYYY-MM-DD` format.
4. Save / publish.

**Expected:** A success indicator is shown. Switching to the member room view (as a member) shows the updated topic title in the room header.

Result: web ☐

---

### PP-A2 — Topic form rejects a non-Monday week start date

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as an admin on `/admin/peer-programming`.

**Steps:**
1. In the topic form, enter a `weekStartDate` that is not a Monday (e.g. a Wednesday).
2. Submit the form.

**Expected:** The server returns 400 with an error indicating an invalid week key. The topic is not saved. An error is displayed in the UI (or the raw response if testing via dev tools).

Result: web ☐

---

### PP-A3 — Run weekly cohort assignment manually

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. There is at least one active (logged-in within 7 days, unlock-approved) member in the seed data.

**Steps:**
1. On web: find the "Run assignment" control in `/admin/peer-programming`. On android: find the equivalent control in Admin PeerProgramming.
2. Click/tap Run (without a manual user-ID override).
3. Wait for the response.

**Expected:** A success message is shown with a count of users selected and cohorts created (or "1 cohort" in single standing Cohort 1 mode). Running the same action a second time does not create duplicate cohorts or duplicate notifications — the run is idempotent.

Result: web ☐

---

### PP-A4 — Run assignment with manual user-ID override

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as an admin. The admin assignment form has an optional user-ID override field.

**Steps:**
1. Enter one or two specific user IDs in the override field.
2. Run the assignment.

**Expected:** The assignment runs against only those specified users. A success response is returned. The cohort list in the admin surface shows the newly formed or updated cohort with those members.

Result: web ☐

---

### PP-A5 — Admin cohort list shows all cohorts across weeks

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. Seed data includes cohorts from at least one prior week (the seed script creates them).

**Steps:**
1. On web: view the "Cohorts" section in `/admin/peer-programming`. On android: view the "Active cohorts" list in Admin PeerProgramming.
2. Check whether cohorts from prior weeks appear.

**Expected:** Cohorts from prior weeks are listed (up to 84 days back, capped at 200). Each row shows a "Week of <date>" label, member count, and fallback-open flag. Cohorts do not disappear after the week rolls over.

Result: web ☐

---

### PP-A6 — Admin cohort list shows member roster with usernames

**Role:** admin · **Surfaces:** web, android

**Precondition:** Signed in as an admin. At least one cohort has two or more members.

**Steps:**
1. Open the admin cohort list.
2. Expand or inspect a cohort that has members.

**Expected:** Each member is listed as `@username` or `Member <short-id>`. No raw UUID is the primary display. "Anonymous" is not used.

Result: web ☐

---

### PP-A7 — Read the single standing Cohort 1 mode toggle

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as an admin on `/admin/peer-programming`. No admin setting has been explicitly saved yet (fresh seed).

**Steps:**
1. Find the "Single standing Cohort 1 mode" control.
2. Read the displayed status.

**Expected:** The status shows "ON" (the built-in default). The source label reads "default" (or "env_flag" if `PEER_PROGRAMMING_SINGLE_OPEN_COHORT` is set in the environment). The four fields `enabled`, `source`, `adminSetting`, and `envFlagEnabled` are reflected in what the UI shows.

Result: web ☐

---

### PP-A8 — Turn the single standing Cohort 1 mode toggle OFF, then clear it

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as an admin. The toggle is currently at its default (no admin setting saved).

**Steps:**
1. Click "Turn off" on the Single standing Cohort 1 mode control.
2. Observe the updated status — source should now read "admin_setting", enabled should read "OFF".
3. Click "Clear override."
4. Observe the updated status — source should revert to "default" (or "env_flag") and enabled should return to ON.

**Expected:** Each step shows a success indicator. The status badge and source label update without a page reload. An audit row is written (not directly visible here, but no error is shown either).

Result: web ☐

---

### PP-A9 — Admin can open any cohort room via cohort link

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as an admin. The admin cohort list shows at least one cohort.

**Steps:**
1. In the admin cohort list, click the link for a cohort (the inventory states each cohort links to `/apps/peer-programming?cohortId=<id>`).
2. The room opens.

**Expected:** The room loads for that cohort. The admin's `access` level is `admin` (the room does not show the listen-in / read-only banner for admin access). The admin can read messages in the cohort.

Result: web ☐

---

### PP-A10 — Admin "Member feedback" inbox

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as an admin. At least one member feedback entry exists (submit one via PP-8 if needed).

**Steps:**
1. Navigate to `/admin/peer-programming`.
2. Find the "Member feedback" panel.

**Expected:** The panel lists recent feedback, newest first — each row shows the author (a resolved name or a short `Member <id>` fallback), the time, and the note text, and nothing else. In particular there are **no** category labels next to the author: the feedback box has no category picker, so `issue_type` and `suggestion_category` are the fixed string "general" on every row and used to print "general general" on each one. With no feedback it shows "No feedback yet." A load failure leaves the panel empty without breaking the rest of the admin page. (The admin-landing tile shows a "new to review" dot when feedback arrived since you last opened this area; opening the area clears it.)

Result: web ☐

---

### PP-A11 — Admin ends a cohort; it becomes read-only

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as an admin. The admin Cohorts list shows at least one active, non-standing cohort (turn single standing Cohort 1 mode OFF and run the weekly assignment first if needed — the standing Cohort 1 has no "End cohort" button).

**Steps:**
1. In the admin Cohorts list, click "End cohort" on an active cohort and confirm the prompt.
2. Watch the list refresh.
3. Open that cohort's room (via its "Open room →" link) and look at the Direct Line composer.

**Expected:** The cohort row now shows an "Ended" badge and no "End cohort" button. A success notice appears. In the room, the Direct Line shows "This cohort has ended — the conversation is read-only" with no message composer. On the Cohorts tab, a member of that cohort sees an "Ended" badge (not "Active") on their own cohort card, no "Join Session" button, and the "Session Feedback" box now appears. The ended cohort no longer appears in a member's "Other running cohorts" list. The standing Cohort 1 never shows an "End cohort" button.

Result: web ☐

---

### PP-A12 — Posting into an ended cohort is rejected server-side

**Role:** member (of an ended cohort) · **Surfaces:** web

**Precondition:** A cohort has been ended (PP-A11). You can post as a member of that cohort using browser dev tools.

**Steps:**
1. In dev tools, POST to `/api/peer-programming/messages` with `{ "cohortId": "<ended-cohort-id>", "body": "post after end" }` and headers `Content-Type: application/json`, `x-ctf-csrf: 1`.
2. Check the response.

**Expected:** The server returns 409 with code `peer_programming_cohort_ended` and the message is not stored — the read-only state is enforced on the server, not just hidden in the UI.

Result: web ☐

---

## Parity check (web ↔ android)

These cases must produce the same user-visible outcome on both surfaces. If the result differs, file a bug with both surface results.

| Case | What must match |
|---|---|
| PP-1 | Room header shows topic title and cohort info |
| PP-2 | Cohort member can post a message and it appears with their username |
| PP-3 | Listener sees read-only view with no composer |
| PP-6 | Cohorts list shows own cohort once; listen-in opens read-only |
| PP-7 | Member roster shows `@username` not raw UUIDs |
| PP-8 | Feedback form is hidden until your cohort ends, then submits successfully |
| PP-10 | Join Session launches video call (EAS build required on android) |
| PP-12 | Member with no cohort sees empty state, not a crash |
| PP-13 | Refresh reloads room without full-screen loading flash |
| PP-14 | Fresh member auto-joins Cohort 1 in single standing mode |
| PP-A3 | Admin can run weekly assignment and see the result count |
| PP-A5 | Admin cohort list shows cross-week cohorts with week labels |
| PP-A6 | Admin cohort roster shows usernames |

---

## Known gaps — do not file these as bugs

1. **Partial-cohort packing edge cases.** Cohorts are formed at a target size of 12 (participation is voluntary, so roughly 5 are expected to actively take part). When the active-user count is not evenly divisible by 12, cohort sizes are filled by best-effort packing. The exact split behavior in edge cases (e.g. 13 users → one cohort of 12 + one of 1, or a more even split?) has not received final product sign-off. Do not file bugs about the specific distribution when the count is awkward.

2. **Fallback-open is roster-based, not presence-based.** The room shows fallback-open when the cohort has fewer than 2 members in its roster, not based on who is actively in the room right now. A richer real-time presence signal is a possible future refinement — do not file bugs about the absence of live presence detection.

3. **Weekly cron requires `CRON_SECRET` to be configured.** The `PeerProgramming — Weekly Cohort Assignment` GitHub Actions workflow skips with a visible warning rather than failing when `CRON_SECRET` or `NEXT_PUBLIC_APP_URL` is not set in repository Actions secrets. Admins form cohorts manually from the admin screen until those secrets are configured. Do not file this as a bug.

4. **Live video on android requires an EAS dev/production build.** The Stream Video SDK needs native code. Live video cases (PP-10, PP-11) cannot be tested in Expo Go — the test will be ⛔ blocked on that runtime. No automated test harness exists for live Stream calls on device; verification is manual only.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._
