# PeerProgramming — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- peer-programming`

| | |
|---|---|
| **Plugin** | PeerProgramming (`peer-programming`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-peer-programming-feature-inventory.md` |
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

Member role unless noted.

1. **Room loads.** Open PeerProgramming. The cohort room renders — header, message stream, and the
   running-cohorts list — not a spinner or a "Failed to load room" error. → web ☐ mobile ☐ android ☐
2. **Member can post.** As a cohort member, post a top-level message. It appears in the stream with
   your name (not "Anonymous"). → web ☐ mobile ☐ android ☐
3. **Listener cannot post.** Open another running cohort with `?cohortId=`. You can read it, but the
   composer is replaced by a "you're listening in" notice. → web ☐ mobile ☐ android ☐
4. **Denied write is readable.** Try to post into a cohort you are not a member of. The denial is a
   plain message, not a raw error code. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### PP-1 · Room state and topic guidance
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Precondition:** signed-in member who is in a cohort.
**Steps:**
1. Open PeerProgramming and read the room header.
2. Read the cohort participation summary and the member roster.
**Expected:** Header shows the current week's topic guidance (title + guidance text). The roster lists
cohort-mates by name (`@username`, or a short `Member <id>` fallback). The member count matches what is
shown.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### PP-2 · Post a message and a threaded reply
**Role:** member · **Surfaces:** all
**Precondition:** member of an open cohort.
**Steps:**
1. Post a top-level message.
2. Open it and post a reply on its thread.
**Expected:** Both appear in order, attributed to you. The reply is nested under its parent, not at the
top level. An over-long body (past the message limit) is refused with a readable message. A reply
whose parent id does not exist, or belongs to a different cohort (crafted request), is refused with
404 `peer_programming_thread_not_found` — no orphan reply row is created.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### PP-3 · Persistence across reload
**Role:** member · **Surfaces:** all
**Steps:**
1. Post a message, then fully reload the room (or reconnect).
**Expected:** The message and any replies are still there — the timeline persists and recovers across
reconnects.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### PP-4 · Listen in on another cohort (read-only)
**Role:** member · **Surfaces:** all
**Precondition:** at least one running cohort the member is not placed in.
**Steps:**
1. From the running-cohorts list, pick a cohort you are not in and open it with "Listen in".
2. Try to post.
**Expected:** You can read that cohort's messages. A "listening in — read-only" banner shows, and the
composer is replaced by a "you're listening in" notice. The post path is refused server-side, not just
hidden. In the list, the cohort you are currently viewing reads "Viewing" (not clickable); other
cohorts read "Listen in."
**Result:** web ☐ mobile ☐ android ☐ — notes:

### PP-4b · Own cohort shows once; count reads members
**Role:** member · **Surfaces:** web (desktop) · web (mobile-responsive)
**Precondition:** signed-in member who is in a cohort (e.g. the single standing Cohort 1).
**Steps:**
1. Look at the top "Join Session" card for your cohort, then scroll to the "Other running cohorts" list.
**Expected:** Your own cohort appears **once** — the top card — and is **not** repeated in the list
below (no redundant second button). The list is titled "Other running cohorts" and holds only cohorts
you are not in; when your cohort is the only one, the list section is absent. The top card's count reads
the real member count ("2 members"), not "0 participants." You reach your cohort's conversation from the
Direct Line tab.
**Result:** web ☐ mobile ☐ android — — notes:

### PP-5 · Join the live session
**Role:** member · **Surfaces:** all
**Precondition:** member of a cohort; Stream is configured in the environment.
**Steps:**
1. Open the Session tab and tap "Join Session".
**Expected:** A live per-cohort video call joins — one tile per participant, with mute/camera/leave
controls. Each participant's video fills its tile and is centered (center-cropped), **not** zoomed into
a corner or a magnified fragment. A member with no cohort sees a "you're not in a cohort yet" notice
(404). When Stream is not configured, a "live video unavailable" notice (503) shows instead. A listener
viewing another cohort sees a read-only note, not a join button. (Live video needs a real device build,
not Expo Go.)
**Result:** web ☐ mobile ☐ android ☐ — notes:

### PP-7 · Desktop sidebar shows only "How It Works"
**Role:** member · **Surfaces:** web (desktop)
**Steps:**
1. On the desktop web layout, look at the left sidebar next to the icon rail.
**Expected:** The sidebar shows the "How It Works" info panel only. There is **no** cohort filter list
(All Cohorts / My Cohort / Forming / Active / By Skill) and **no** "Search cohorts…" box — those were
removed because they were never wired (see inventory change log; future implementation tracked in issue
\#1306). The mobile-responsive web layout and android use their own top tab bar and never show this
sidebar.
**Result:** web ☐ mobile — android — — notes:

### PP-6 · Submit feedback
**Role:** member · **Surfaces:** all
**Steps:**
1. From the cohort room, open the feedback form.
2. Pick an issue type and a suggestion category, add a note, and submit.
**Expected:** The feedback is accepted and recorded. An over-long note (past the feedback limit) is
refused with a readable message. A crafted request with a `releaseSurface` other than `web` or
`android` is refused with 400 (the value is never persisted); omitting it still records `web`.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

### PP-8 · Refresh the room (header button / pull-to-refresh)
**Role:** member · **Surfaces:** all
**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open
   PeerProgramming and tap the refresh icon in the header.
2. On android, open the Cohorts tab and pull down on the list.
3. In another session, post a message in the cohort room, then refresh as above.
**Expected:** On web the refresh icon spins while loading; on android the pull-to-refresh spinner
shows. The room re-pulls (messages, cohorts, roster) and the new message appears without closing and
reopening the app. Refreshing never clears the current screen to the full-screen loading state.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### PP-A1 · Set and publish the weekly topic
**Role:** admin · **Surfaces:** web (admin surface), android (admin screen)
**Steps:**
1. Open `/admin/peer-programming`.
2. Set a weekly topic (week start, title, guidance), then publish it.
3. Open the member room and confirm the topic shows in the header.
**Expected:** The topic saves and publishes for the chosen week. The member room reads the current
week's published topic. A non-admin reaching the admin screen sees an access notice, not the form.
A week start that is not a real `YYYY-MM-DD` date or not a Monday is refused with a readable
message (`invalid week key`) — a topic keyed to a mid-week date would never be found by room loads.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### PP-A2 · Run weekly cohort assignment
**Role:** admin · **Surfaces:** web (admin surface), android (admin screen)
**Steps:**
1. From the admin screen, run the weekly cohort assignment.
2. Re-run it once more.
**Expected:** The run forms cohorts (or, in single standing Cohort 1 mode, ensures the one standing
cohort and joins active members into it). Re-running does not double-form cohorts or double-send
assignment notifications — the run is idempotent per week. The manual user-id override path accepts an
explicit list.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### PP-A3 · Manage cohorts after the week rolls over
**Role:** admin · **Surfaces:** web (admin surface), android (admin screen)
**Steps:**
1. Open the admin "Cohorts" list.
2. Pick a cohort formed on an earlier day and open its room via the link.
**Expected:** The list shows cohorts across recent weeks (not only the current week), each with a "Week
of <date>" label, live member count, the open flag, and a roster. The link opens that cohort's room.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### PP-A4 · Single standing Cohort 1 mode toggle
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Read the "Single standing Cohort 1 mode" control — note the status badge and the source label
   (admin setting / env flag / default).
2. Turn it on, then off, then clear the override.
**Expected:** The control reports the effective mode and where it resolves from. Setting it to on/off
is the admin's explicit choice and supersedes the env flag; clearing it reverts to the env flag, then
the built-in default (on). Each change re-reads and shows the new state. A non-admin cannot reach this
control.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For PP-1, PP-2, PP-4, and PP-5, the android app and the mobile-responsive web layout must behave the
same: same room state and roster, same post/reply result, same read-only listen-in behavior, same
live-session join outcome. Note any drift here rather than filing separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- Partial-cohort packing (when the active-member count is not divisible by 5) is best-effort; product
  sign-off on the edge cases is pending.
- A richer per-session presence signal (who is actually in the room right now) is not built; fallback-open
  is derived from the live roster (open when fewer than 2 members), which is enough for the basic
  "too small to be a group" rule.
- The weekly assignment cron is off until `CRON_SECRET` and the app URL are set in the repository's
  Actions secrets; until then it skips with a visible warning and admins form cohorts from the admin
  screen.
- Live Stream video on Android needs a real device build (not Expo Go), and there is no automated test
  harness for live calls — that check is manual.
