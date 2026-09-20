# SkillsHunt — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Generated from the SkillsHunt feature inventory and declared contracts; this is the runnable checklist for a human tester on a real device.
> To regenerate: `pnpm --dir ctf test-script:generate -- skills-hunt`

| Field | Value |
|---|---|
| **Plugin** | SkillsHunt |
| **Visibility** | Member |
| **Roles to test** | member, admin/moderator |
| **Surfaces** | Web (`/apps/skills-hunt`, `/admin/skills-hunt`) · Android (`SkillsHunt.tsx`, `AdminSkillsHunt.tsx`) |
| **Seed first** | `pnpm --dir ctf seed:skills-hunt` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-skills-hunt-feature-inventory.md` |
| **Generated** | 2026-08-27 (hand-updated: team leaderboard removed — SH-8; report flow removed — SH-13, SH-A13; flag reversal + re-add after remove — SH-A6, SH-A6b; taken-down URL refused — SH-A6c; unflag — SH-A6; admin list hides nothing — SH-A6d; restore a removed row — SH-A6e) · 2026-08-29 manual update: the cross-referenced LevelUp plugin is now SkillUp (tables `skill_up_*`, routes `/api/skill-up/*`); this plugin's own steps are unchanged · 2026-09-17 manual update: SH-2 now checks that the nomination is really written, not only acknowledged on screen — the submission INSERT listed 18 columns against 19 values and Postgres refused every nomination · 2026-09-17 manual update: SH-A10b and SH-A10c cover the named-skill mission goal, the mission Edit control and Recompute progress; SH-9 now says how to read a count against its title · 2026-09-18 manual update: SH-9 expects a count capped at its target, and points the mis-pointed-mission check at the admin Missions tab · 2026-09-20 manual update: SH-9b covers the missions picture control, which moved to the admin Missions tab the same day and now shows the picture on that screen rather than handing the file off · 2026-09-20 manual update: SH-A4c covers the paged moderation queue (25 a page, Previous/Next, filter change returns to page 1) |

---

## How to run this

- Run `pnpm --dir ctf seed:skills-hunt` before starting any session. The seed is idempotent — re-running it is safe.
- Mark each surface checkbox as you confirm it: ✅ pass · ❌ fail · ⛔ blocked.
- A ❌ on any checkbox becomes a row in the Bug Reporting plugin. Record: case ID, surface, exact step that failed, what you saw vs what was expected.
- Run **Core smoke** at the start of every session, even if you are only testing one walkthrough section.
- Web base URL: wherever the CTF Next.js app is running locally or on staging.
- Android: use the installed APK on a physical or emulated Android device pointed at the same backend.

---

## Core smoke (every session)

**CS-1 — Rounds list loads for a signed-in member**
Open `/apps/skills-hunt` (web) and the SkillsHunt screen (Android). Confirm at least one seeded round appears with a name and status visible. No error state, no blank screen.
web ☐

**CS-2 — Scout tab / nomination form is reachable**
From the rounds list, tap or click into the active round. Navigate to the Scout tab. The "Nominate a Survivor" form renders with fields: Full name, Bio, Quora URL (required — marked with *), a skills picker, and a location block (Country — required, State/region and City — optional). On web the Country field is a dropdown; on Android it is a button that opens a searchable country list.
web ☐

**CS-3 — Leaderboard tab loads**
Switch to the Leaderboard tab on the same round. A ranked list appears (seeded data). No fabricated figures — every visible number comes from the API.
web ☐

**CS-4 — Admin moderation shell is reachable by an admin**
Sign in as an admin. Navigate to `/admin/skills-hunt` (web) and the `skills-hunt-admin` screen (Android). A submissions table or list renders; a round selector is visible.
web ☐

**CS-5 — A non-admin is blocked from the admin surface**
Sign in as a plain member. Navigate to `/admin/skills-hunt` (web). Expect a redirect, 403, or "admins only" notice — not a working admin table. On Android, attempting to reach the admin screen shows the "admins only" notice.
web ☐

---

## Member walkthrough

### SH-0q — The Quora profile URL is required by the form, not only by the server

**Role:** member (scout) · **Surfaces:** web
**Precondition:** Signed in, a round is open and inside its dates.

**Steps:**
1. Open the Scout tab and fill in a full name, at least one skill and a country. Leave the Quora Profile URL empty.
2. Look at the Submit control.
3. Paste any text that is not a Quora profile link into the URL field and submit.
4. Replace it with a real Quora profile URL and submit.

**Expected:**
- The Quora Profile URL label carries the required marker.
- At step 2 Submit does not act on an empty URL field. Before this was fixed the button was live, the nomination went out, and the refusal came back from the server instead of from the form.
- At step 3 Submit stays live — a half-typed or malformed link does not disable it — and the refusal names the field and shows the expected shape of the link.
- At step 4 the nomination is accepted.
- A deleted or emptied Quora account is still a valid URL and is accepted. Being unbanned is not a condition; the link resolving is.

Result: web ☐

---

### SH-1 — Round discovery: active, upcoming, and closed rounds are visible

**Role:** member · **Surfaces:** web, android

**Precondition:** Seed has run. At least one active, one upcoming (draft or future start), and one closed round exist in seed data.

**Steps:**
1. Sign in as a member.
2. Open `/apps/skills-hunt` (web) / SkillsHunt screen (Android).
3. Observe the round list.

**Expected:** All three round states are represented. Each round card shows a name and its status. Closed rounds are visible but not selectable for new submissions.

Result: web ☐

---

### SH-1b — A round past its end date says nominations have closed instead of showing the form

**Role:** member · **Surfaces:** web

**Precondition:** One round with `status = 'active'` whose `ends_at` is in the past, and no other active round. (In the database: `UPDATE skills_hunt_rounds SET ends_at = NOW() - INTERVAL '1 day' WHERE id = '<round>';` — nothing in the app moves a round's status when its dates run out, which is the situation being tested.)

**Steps:**
1. Sign in as a member.
2. Open `/apps/skills-hunt` and stay on the Scout tab.
3. Read what is on screen; do not try to submit.
4. Open the Leaderboard tab, then My finds.

**Expected:** The Scout tab shows a panel reading "Nominations for *round name* have closed", naming the date the round ran until and saying an admin opens the next round. No nomination form and no submit button. This is not the "No active round right now" panel — the round exists and is named. The Leaderboard and My finds tabs still load that round's data.

**Regression guard:** before 2026-09-12 this drew a working nomination form. Filling it in and pressing Submit returned "Round is not currently active." after the fact, which read as the form being broken. If the form appears here, the client and the server have gone back to disagreeing about what "active" means.

Result: web ☐

---

### SH-2 — Submission: happy path with taxonomy skills

**Role:** member · **Surfaces:** web, android

**Precondition:** An active round exists (seeded). Member is signed in.

**Steps:**
1. Navigate to the active round → Scout tab.
2. Fill in:
   - Full name: `Amara Williams` (letters and spaces, within 2–100 chars)
   - Bio: `A software engineer focused on climate tech.` (under 280 chars)
   - Quora URL: a valid-format Quora profile URL (e.g. `https://www.quora.com/profile/seed-test-user`)
   - Country: `United States` (required). State: `California`. City: `Oakland`.
   - Select 2 taxonomy skills from the accordion/picker.
3. Also confirm the **keyword skill search** (web and android): type part of a skill name in the "Search skills by keyword…" box above the sector accordion. The accordion is replaced by a flat, cross-sector list of matching skills; selecting one adds it just like the accordion. Clear the search (✕) to restore the accordion. A no-match query shows the "add it as a free-text skill" hint.
4. Submit.

**Expected:** Submission succeeds. A confirmation message or pending status appears, and **no red banner** — in particular nothing reading "Unable to create submission". Then reload the page and open My Finds again: the nomination is still there. Reloading is the part that matters, because it is the only step that proves a row was written rather than a message shown. On 2026-09-13 the submission INSERT named 18 columns and supplied 19 values, so Postgres refused every nomination and nothing was ever written. The submission shows up in the My Finds tab / "My Finds" section with status "pending". When this submission is later accepted (SH-A3) the generated Directory profile carries the same country/state/city. The keyword search behaves the same on web and android (flat filtered results replace the accordion while a query is present).

Result: web ☐

---

### SH-2b — Submission validation: country is required, state/city optional

**Role:** member · **Surfaces:** web, android

**Precondition:** Active round exists. Member is signed in.

**Steps:**
1. Navigate to the Scout tab.
2. Fill Full name, Bio, Quora URL, and at least one skill validly, but leave Country unset. Leave State and City blank.
3. Attempt to submit.
4. Set Country to a non-US country (e.g. `Nigeria`). Confirm the State field becomes a free-text region box rather than the US-state list. Leave State and City blank.
5. Submit.

**Expected:**
- Step 3: submit is blocked while Country is empty (button disabled or an error naming Country).
- Step 4: for a non-US country the State control is free text; for `United States` it is a searchable state list.
- Step 5: submission with a country but no state/city succeeds — state and city are optional.

Result: web ☐

---

### SH-2c — The Quora URL is required, and every refusal names its rule

**Role:** member · **Surfaces:** web

**Precondition:** An active round inside its dates.

**Steps:**
1. Sign in and open the Scout tab.
2. Fill in a full name and a country, pick one skill, and leave the Quora Profile URL field empty.
3. Read the Quora field's label and look at the Submit button.
4. Paste a link that is not a Quora profile (e.g. `https://example.com/someone`) and submit.
5. Paste a real Quora profile URL and submit.
6. Now provoke each refusal in turn and read the message: clear the skills and submit; clear the country and submit; set the full name to a single letter and submit.

**Expected:** Step 3 — the label reads **"Quora Profile URL *"** with the accent-colored required marker and no "highly recommended" hint, and Submit is disabled while the field is empty (same treatment as Country). Step 4 is refused with "A Quora profile URL is required — paste the link to their profile…" — a blank field and a non-Quora link read the same sentence. Step 5 succeeds. Each refusal in step 6 names its own rule and its limit ("Pick at least one skill, and no more than 10 in total.", "Country is required…", "Full name must be 2–100 characters…"). None of them reads "Invalid submission payload."

**History:** this case asserted the opposite until 2026-09-13 — the field was presented as optional and the input validation accepted a blank value, though `createSubmission` refused it anyway with "Invalid Quora profile URL.", so the two layers disagreed. The owner settled it as required; the label, the Submit gate, the input validation, and the command contract now all say the same thing. `lib/skills-hunt/submission-input.test.ts` holds the blank and non-Quora cases in code.

Result: web ☐

---

### SH-2d — A submit failure the route cannot name still says something usable

**Role:** admin, then member · **Surfaces:** web

**Precondition:** An active round inside its dates, and a way to force a raw failure inside `createSubmission` — for example, rename `skills_hunt_submissions` in a scratch database so the insert throws, then rename it back.

**Steps:**
1. As an admin, fill in a valid nomination and submit.
2. Read the banner.
3. Repeat as a non-admin member.
4. Find the matching row in the error report and compare it to what was on screen.

**Expected:** Neither banner reads "Unable to create submission." on its own. The admin sees that sentence followed by the reason the database gave. The member sees the plain sentence plus a short reference, and that same reference appears on the error-report row, so a screenshot of the banner can be tied to the log line behind it.

**Note:** the seven deliberate refusals are not part of this case — round not active, duplicate, taken down, weekly limit and the rest keep their own sentences and carry no reference. This covers only the catch-all, which before 2026-09-12 answered every unrecognized error with four words and dropped the reason.

Result: web ☐

---

### SH-3 — Submission: member without a Clerk username can still submit

**Role:** member (no Clerk username set) · **Surfaces:** web

**Precondition:** A test account exists that has never set a Clerk username (username field is null). An active round exists.

**Steps:**
1. Sign in as the username-less member.
2. Navigate to Scout tab of the active round.
3. Fill in a valid Full name, Bio, Quora URL, and at least one taxonomy skill.
4. Submit.

**Expected:** Submission succeeds. The gate does not block for missing username. In the admin table the submitter is shown as `user-<id>` (not a blank or raw ID slice).

Result: web ☐

---

### SH-4 — Submission validation: field length and character constraints

**Role:** member · **Surfaces:** web, android

**Precondition:** Active round exists. Member is signed in.

**Steps:**
1. Navigate to the Scout tab.
2. Attempt to submit with Full name = `A` (1 character — below 2-char minimum).
3. Observe error.
4. Replace with a Full name containing HTML: `<script>alert(1)</script>`.
5. Observe error.
6. Enter a valid Full name. Set Bio to a string longer than 280 characters.
7. Observe that either the counter prevents submission or the server rejects it.

**Expected:**
- Step 3: error message referencing "Full name" and the character requirement.
- Step 5: error rejecting HTML/script-like content.
- Step 7: submission is blocked or the counter turns red beyond 280 chars.

Result: web ☐

---

### SH-5 — Submission validation: dead Quora URL is rejected

**Role:** member · **Surfaces:** web

**Precondition:** Active round exists. A Quora URL that returns 404/410 is available for testing (or configure a known dead URL in the seed).

**Steps:**
1. Navigate to the Scout tab of the active round.
2. Fill all fields validly except the Quora URL — use a URL that resolves to 404 (e.g. `https://www.quora.com/profile/does-not-exist-xyzzy99`).
3. Submit.

**Expected:** The API rejects the submission with a message indicating the profile URL could not be verified (liveness check failed). The submission is not created.

Result: web ☐

---

### SH-6 — Submission validation: a Quora URL can only be nominated once

**Role:** member · **Surfaces:** web

**Precondition:** An active submission (pending or accepted, not rejected) already exists for a specific Quora URL — SH-2 above satisfies this.

**Steps:**
1. Navigate to the Scout tab of the same active round.
2. Submit the same Quora URL again but with a **different** set of skills.
3. If a second round is open, also try submitting the same Quora URL in that other round.

**Expected:** Both attempts are blocked with a duplicate-submission message — a Quora URL uniquely identifies a person, so at most one active submission may exist for it, regardless of the skills chosen or the round. A second submission row is not created. (A previously *rejected* submission for that URL would not block a fresh nomination.)

Result: web ☐

---

### SH-6c — The same person written another way is still the same person

**Role:** member · **Surfaces:** web

**Precondition:** an active submission exists for a Quora URL, as in SH-6.

**Steps:**
1. Nominate the same person again in the same round, but write the URL differently each time: drop
   the `www.`, add a trailing slash, change the casing of the name, paste the share link with
   `?ch=…` on the end, or use a language subdomain such as `es.quora.com`.
2. Try a nomination whose URL is on a look-alike domain, e.g. `https://evil-quora.com/profile/Name`.
3. As an admin, accept one nomination for that person, then have a second scout nominate the same
   person with a differently-written URL and accept that too. Compare the points each scout received.

**Expected:** Step 1: every spelling is recognized as the person already nominated and refused with
the duplicate message — before 2026-09-18 each spelling counted as a different person. Step 2:
refused as an invalid Quora URL; only quora.com and its subdomains are accepted, and a host merely
*ending* in "quora.com" is not one. Step 3: only the first accepted nomination for that person earns
the first-match bonus; the second scout gets the match points without it. This holds for nominations
made before the fix too: what refuses a duplicate is a read of the stored normalized URL under a lock
on that URL (not the per-round signature index behind it), and the migration re-keyed that column —
so an older nomination written in another spelling still blocks a new one. Use
`ctf/scripts/sql/quora-duplicate-links-directory-skills-hunt.sql` to see any person who was nominated
more than once before the fix.

Result: web ☐

---

### SH-6b — Admins are exempt from the submission rate limit

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as an admin. An active round exists.

**Steps:**
1. As the admin, submit nominations past the point where a regular member would hit the weekly cap (each with a distinct Quora URL).
2. Confirm each submission is accepted, not blocked by "Submission rate limit exceeded" or "need admin pre-approval".
3. As a comparison, a non-admin member hitting the same volume is still blocked by the cap.

**Expected:** The admin can keep submitting (distinct Quora URLs) without the rolling weekly cap or the reputation pre-approval gate blocking them. The active-round window and the one-per-Quora-URL duplicate guard still apply to the admin (a repeat URL is still blocked). A non-admin still hits the cap.

Result: web ☐

---

### SH-7 — Proposed (free-text) skills can be added alongside taxonomy skills

**Role:** member · **Surfaces:** web, android

**Precondition:** Active round exists. Member is signed in.

**Steps:**
1. Navigate to the Scout tab.
2. Select 1 taxonomy skill from the picker.
3. Type a free-text skill not in the taxonomy (e.g. `Regenerative Finance`) into the proposed-skill input and add it.
4. Confirm it appears as a yellow/differently-styled chip.
5. Submit the full form.

**Expected:** Submission succeeds. The proposed skill is stored and visible in My Finds as a chip. The total skills + proposed skills count does not exceed 10. A proposed skill becomes a real taxonomy skill only after the owner approves it — an `addSkill` entry appended to the taxonomy change list (`ctf/scripts/lib/taxonomyChange.mjs`) and applied by the owner-run apply workflow.

Result: web ☐

---

### SH-8 — Leaderboard ranks scouts by accepted points

**Role:** member · **Surfaces:** web

**Precondition:** Seeded data includes accepted submissions with points.

**Steps:**
1. Navigate to the Leaderboard tab on an active or closed round.
2. Confirm the list shows ranked entries with: rank, handle/name, score.
3. Confirm there is **no Scouts/Teams toggle** — there is one board.

**Expected:**
- Entries are ordered by score descending, with first_match_count as the tie-break; no fabricated numbers.
- The title reads "Scout Leaderboard".
- If the signed-in member is in the top-100 their row is highlighted; if outside the top-100, their rank still appears.
- The team view was removed 2026-08-27: it regrouped the same nominations by the nominee's claimed profession, not by any team of members, and every row had fallen into a single "Unspecified" bucket once the form stopped collecting professions.

Result: web ☐

---

### SH-9 — Missions tab displays progress

**Role:** member · **Surfaces:** web, android

**Precondition:** Seeded data includes at least one active mission with a goal.

**Steps:**
1. Navigate to the Missions tab.
2. Observe the mission list.
3. Each mission should show a title, progress bar, and a "Scout Now" or equivalent CTA.

**Expected:** Missions load from the real API (not stubbed). Progress bars reflect actual submission counts. Archived missions are not shown. **A count never reads past its target** (owner decision 2026-09-18): a mission whose stored count is 82 against a target of 1 shows "1/1 complete", matching the bar, which has always stopped at full width. The stored count is untouched — only what a member reads is capped.

So a mis-pointed mission no longer announces itself here. Check it on the **admin** Missions tab instead, where each row names what it counts ("Every accepted nomination, whatever the skill") with its sector or skill beside it; a mission named for one trade that reads "every accepted nomination" is the one to correct with SH-A10c.

Result: web ☐

---

### SH-9b — The missions picture appears on the admin screen, and the screen never moves

**Role:** member, admin · **Surfaces:** web · installed app (iOS, added to the home screen)

**Precondition:** An active round with at least two active missions, one of them archived or locked,
and one member account that is not an admin. For the installed-app run, add the site to the iOS home
screen and open it from that icon, so it runs with no browser chrome — that is the case this step
exists for.

**Steps:**
1. Sign in as the non-admin member, open the Missions tab, and read it top to bottom.
2. Sign in as an admin, open `/admin/skills-hunt`, pick the round, and open the **Missions** tab.
3. Press **Show these missions as one picture**. Watch what happens while it draws, and look at
   where you are when it finishes.
4. On the phone, press and hold the picture and save it to your photos.
5. Press **Share**, close the share sheet without choosing anything, then press it again and send
   the picture to another app.
6. Read the picture: check each active mission in it against the admin Missions list, along with
   the archived or locked one. Then press **Done**.

**Expected:** Step 1 — the member Missions tab carries no such control anywhere; it shows the
heading, the subtitle and the mission cards, nothing else. Step 2 — the control sits above the
mission list, under the auto-mission panel, with a short note saying what it does. Step 3 — the
button reads "Drawing the picture…" while it works, and when it finishes the picture is **on the
admin Missions tab**, under the button, scaled to the width of the card. **The screen never
moves.** Nothing navigates: no page showing a PNG icon with a file name and an "Open in…" link, no
"Safari can't open the page" with a WebKitBlobResource error, no screen without a back control, and
never a need to force the app closed — those were the two defects on 2026-09-20, from a plain link
to the route and then from a share-then-blob handoff. Step 4 — the picture reaches the photo
library from press-and-hold alone. Step 5 — the sheet opens (it is its own press, so it is never
refused), closing it says nothing and leaves the picture on screen, and sending it works. Step 6 —
one tall picture with the round's name and dates at the top, every active mission as its own card
carrying a title, a description, what the mission asks for in plain words ("3 accepted nominations
with a Health skill"), and its bonus points where it pays any. The archived or locked mission is
**not** in it, and no progress bar, count or "x/y complete" appears anywhere: the picture is made to
be posted in public, and one member's counts are not an advertisement. The goal type's internal name
(`count_skills_in_sector`) never appears. **Done** puts the picture away and brings the button back.

**If it fails:** a sentence in red under the button, with the screen still there. Never a blank page
and never a dead file view.

Result: web ☐ installed app ☐

---

### SH-10 — My Finds tab shows own submissions and achievements

**Role:** member · **Surfaces:** web, android

**Precondition:** Member has at least one submission (from SH-2). Seeded data may include a seeded achievement.

**Steps:**
1. Navigate to the My Finds tab.
2. Observe the submissions list: each entry shows full name, status (pending/accepted/rejected), and relative date.
3. Observe the achievements/badges row — seeded badges (e.g. First Finder) appear if awarded.

**Expected:** Only the signed-in member's own submissions appear. Statuses are accurate. Achievement codes shown match the 5 named badges: First Finder, Diversity Champion, Rare Talent Scout, Quality Contributor, Leaderboard Champion. **Diversity Champion** is awarded for accepted nominations spanning 3+ distinct taxonomy sectors, resolved from the submitted skills — it counted claimed professions until 2026-08-27, a field the nomination form no longer collects, which made it unearnable. The nomination form asks for skills, never professions.

Result: web ☐

---

### SH-11 — Status panel (notifications): unread entries are accented, mark-read works

**Role:** member · **Surfaces:** web, android

**Precondition:** Member has at least one notification (e.g. after an admin accepts a submission in SH-A2).

**Steps:**
1. Open the Status panel — on web: click the bell icon in the icon rail; on Android: tap the bell in the top bar.
2. Observe that unread notifications are visually distinct (accented).
3. Confirm there is no unread count badge/dot on the bell icon itself.
4. Click/tap an unread notification.

**Expected:**
- The notification is marked as read (accent removed or style changes).
- No numeric dot/count badge appears on the bell icon at any point.
- The panel polls automatically; waiting ~30 seconds and then triggering a new notification (from admin review) should surface it without a page reload.

Result: web ☐

---

### SH-12 — Feature reward card is visible on the Directory page

**Role:** member · **Surfaces:** web

**Precondition:** The seed has run. The reward card is configured (seed should set this up) or the default card is shown.

**Steps:**
1. Navigate to the Directory page (`/apps/directory`).
2. Look for the SkillsHunt feature reward card in the sidebar or pinned area.
3. Click the CTA button on the card.

**Expected:** The card shows a title, description, and a CTA button. Clicking the CTA navigates to `/apps/skills-hunt?tab=scout` (the Scout/nomination form).

Result: web ☐

---

### SH-14 — Community-generated Directory profile shows correct labels

**Role:** member · **Surfaces:** web

**Precondition:** Seeded community-generated profile exists at `@community-seed01`.

**Steps:**
1. Navigate to `/apps/directory/@community-seed01`.
2. Observe the profile page.

**Expected:**
- A "Community-generated profile" label or pill is visible (purple, per design).
- The `@community-seed01` handle is shown in monospace.
- "Nominated by @<scout-handle>" attribution appears.
- There is no placeholder headline ("SkillsHunt contributor" text does not appear).
- Skills that are not yet in the taxonomy appear as muted "pending review" chips.

Result: web ☐

---

### SH-15 — GDPR self-delete removes member's submissions

**Role:** member · **Surfaces:** web

**Precondition:** Member has at least one submission (from SH-2).

**Steps:**
1. While signed in as the member, send a DELETE request to `/api/account/skills-hunt-profile` (or use the UI affordance if present).
2. Navigate to My Finds tab.
3. Sign in as an admin and check `/admin/skills-hunt` submissions table.

**Expected:**
- The DELETE returns a JSON body with `deleted: N` where N ≥ 1.
- My Finds shows no submissions for the deleted member.
- The admin table no longer shows the deleted member's submissions.
- The audit log retains a `skills-hunt.profile.delete` entry (verifiable via the admin audit-events endpoint).

Result: web ☐

---

### SH-16 — Refresh re-pulls the data without reopening the app

**Role:** member · **Surfaces:** web, android

**Steps:**
1. Open SkillsHunt, then in a second session change data that affects it (e.g. an admin accepts a pending submission so the leaderboard and My Finds change).
2. Web / mobile-responsive: tap the refresh icon (desktop header right side; phone header next to the top actions).
3. Android: open the Leaders, Missions, or My Finds tab and pull down on the list.

**Expected:**
- On web the refresh icon spins while the re-pull is in flight; on android the pull-to-refresh spinner shows.
- The rounds, leaderboard, missions, and My Finds data re-fetches and the change from the other session appears without closing and reopening the app.
- Refreshing never clears the screen to the full-screen loading state — the current content stays visible until the new data lands.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), and the admin screen header shows a "Member view" pill opening `/apps/skills-hunt`.

Result: web ☐

---

## Admin walkthrough

### SH-A1 — Create a round (web only)

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as admin. On `/admin/skills-hunt`.

**Steps:**
1. Navigate to the Rounds tab of the admin shell.
2. Fill in: Name (e.g. `Test Round Alpha`), start date (today), end date (7 days from now), status `active`.
3. Set `rewardCreditsPerAccept` to `5` and `rewardPerUserRoundCap` to `20`.
4. Save.

**Expected:** The new round appears in the admin rounds list with status `active` and the configured reward values. The member-facing `/apps/skills-hunt` rounds list also shows the new round.

Result: web ☐

---

### SH-A2 — Update a round (partial update; only supplied fields change)

**Role:** admin · **Surfaces:** web

**Precondition:** The round created in SH-A1 exists.

**Steps:**
1. Open the round created in SH-A1 for editing.
2. Change only the name to `Test Round Alpha — Updated`. Leave all other fields blank/untouched in the form.
3. Save.

**Expected:** The round name changes to the new value. The start date, end date, status, and reward config remain exactly as set in SH-A1 — they are not reset to defaults.

Result: web ☐

---

### SH-A2b — Manual leaderboard rebuild button

**Role:** admin · **Surfaces:** web, android

**Precondition:** A round with at least one accepted submission exists.

**Steps:**
1. In the admin Rounds tab (web) / on the admin screen with the round selected (Android), find the round's "Rebuild leaderboard" button and tap/click it; confirm the prompt.
2. Open that round's Leaderboard tab and check the standings.

**Expected:** The button shows a busy state, then a success notice ("Leaderboard rebuilt…" on Android). The Leaderboard reflects the current accepted submissions — a scout whose accepted submission was removed/rejected out-of-band no longer carries its points. A non-admin cannot reach this action. On Android the button sits in a "Leaderboard" card under the selected round and sends `x-ctf-csrf: '1'`.

Result: web ☐

---

### SH-A3 — Review a submission: accept, then verify leaderboard rebuild and notification

**Role:** admin/moderator · **Surfaces:** web, android

**Precondition:** At least one pending submission exists (created in SH-2 or from seed). The round has `rewardCreditsPerAccept > 0` (set in SH-A1 or use a seeded paid round).

**Steps:**
1. On the admin shell (web: Moderation tab; Android: moderation screen), select the active round.
2. Filter to "pending" submissions.
3. Accept one submission.
4. On web, observe the Reward column on that row.
5. On Android, observe the accepted submission card.

**Expected:**
- The submission status changes to "accepted".
- The row shows a "✓ Paid N ServiceCredits" indicator (where N = rewardCreditsPerAccept).
- The leaderboard for that round rebuilds — navigate to the Leaderboard tab and verify the submitter's score increased.
- The submitter receives a `submission-accepted` notification (check the Status panel as the member, waiting up to 30s for the next poll).

Result: web ☐

---

### SH-A4 — Review a submission: reject with reason

**Role:** admin/moderator · **Surfaces:** web, android

**Precondition:** At least one pending submission exists in the active round.

**Steps:**
1. In the admin submissions view, select a pending submission.
2. Click/tap Reject.
3. Select a canned reason (e.g. "inaccurate") or enter free-text.
4. Confirm.

**Expected:**
- Submission status changes to "rejected".
- Review notes are stored (visible in the submission detail or admin table).
- The submitter receives a `submission-rejected` notification (check Status panel as member, up to 30s).
- The leaderboard does not increase for this submitter; participation_points (+1) are awarded internally but the member's score reflects the reject correctly.

Result: web ☐

---

### SH-A4b — Remove (soft-delete) a submission without penalising the scout

**Role:** admin · **Surfaces:** web, android

**Precondition:** Any submission exists (any status). Ideally an accepted one so you can see the leaderboard change.

**Steps:**
1. In the admin submissions table (web) / on each submission card (Android), tap/click "Remove" on a row and confirm the prompt.
2. Re-open the round's Leaderboard and, as the affected scout, open the Scout tab and My Finds.

**Expected:** The row disappears from the admin list (soft-deleted). The leaderboard no longer counts it. Crucially, unlike Reject, it does **not** add to the scout's rejection rate — a scout removed this way is not pushed toward the restricted/pre-approval state. It is gone from the scout's My Finds. No ServiceCredits are reversed by this action (that is a separate admin burn). A non-admin cannot reach the Remove action. On Android the "Remove" button shows on every submission card (any status) and sends `x-ctf-csrf: '1'`.

Result: web ☐

### SH-A4c — The moderation queue is paged, not endless

**Role:** admin/moderator · **Surfaces:** web · web (mobile-responsive, ~390px)

**Precondition:** A round with more than 25 nominations in it. The seed does not make that many, so
add them, or pick the round that has them on a real environment.

**Steps:**
1. Open `/admin/skills-hunt` → **Moderation** and pick that round. Scroll to the bottom of the list.
2. Count the nominations on screen, and read the line between the two controls under them.
3. Press **Next**, then **Previous**.
4. With a multi-page list showing, move to page 2 or later, then change the status filter.
5. Pick a round or filter that holds 25 or fewer, and look under the list again.

**Expected:** Step 2 — at most **25** nominations, and under them "Previous — Page 1 of N — Next"
where N matches how many the round holds. The list ends; it is not an endless scroll, which is what
it was until 2026-09-20. Step 3 — Next loads the following 25 and the line reads Page 2 of N; both
controls are dead while a page is loading, so a double press cannot skip one; Previous brings the
first page back. Step 4 — the filter change returns you to **page 1**, and the rows shown match the
filter. It never leaves you on a page number the shorter list does not have, which would read as
"No submissions matching this filter" when there are plenty. Step 5 — no Previous/Next at all: one
page holds everything, so the control hides itself.

**If the list fails to load:** the red line under the filters carries the reason the route gave,
not a bare "Failed to load" — this is an admin screen (rule 137).

Result: web ☐ mobile ☐

---

### SH-A5 — Bulk review: accept multiple pending submissions at once

**Role:** admin/moderator · **Surfaces:** web

**Precondition:** Three or more pending submissions exist in the same round.

**Steps:**
1. Navigate to the Moderation tab on `/admin/skills-hunt`.
2. Filter to "pending".
3. Select all visible pending submissions using the checkboxes.
4. Click "Bulk Accept".
5. Confirm the count shown in the confirmation dialog matches the selected submissions.
6. Confirm.

**Expected:** All selected submissions change to "accepted" status sequentially. The leaderboard reflects each accepted submission. The confirmation dialog shows the count of pending submissions before firing.

Result: web ☐

---

### SH-A6 — Flag a submission

**Role:** admin/moderator · **Surfaces:** web, android

**Precondition:** A pending submission exists.

**Steps:**
1. In the admin submissions view, locate a pending submission.
2. Use the Flag action.
3. Switch the status filter to **Flagged**. Confirm all four status chips are visible and reachable at phone width — none is cut off at the right edge.
4. Confirm the submission appears there with three ways out — **Unflag**, **Accept** and **Reject** — and a line saying Unflag puts it back in Pending unchanged while Accept or Reject decides it now.
5. Use **Unflag**. Confirm the row leaves the Flagged filter and is back under **Pending**, with its full Accept / Reject / Flag / Remove actions, as though it had never been flagged.
6. Flag it again, then use Accept (or Reject). Confirm the row leaves Flagged and appears under the status you chose.

**Expected:** Flagging moves the submission out of Pending and into Flagged. From Flagged it can go back to Pending untouched, or on to a verdict — flag is a holding state for a second look, not a dead end and not a forced decision. The action requires a confirm gesture on Android.

Notes:
- Steps 3–6 are the fix for a reported bug: every non-pending status used to render the same terminal row (status label plus Remove), so a flagged submission had no way back at all. The Flagged chip could also sit off the right edge of a phone-width column, because the status row did not wrap. Unflag arrived a day later — the first fix offered only Accept and Reject, which clears a flag by deciding the submission, and flag exists so a moderator does not have to decide yet.
- **Step 5 is a regression check, not a formality.** Unflag shipped as a visible button that always returned 400 "Invalid review payload.": the review action list was written out in three places and the repository validator's copy never gained `unflag`. If this step ever fails that way again, the cause is the list having been duplicated — it now lives once, in `SKILLS_HUNT_REVIEW_ACTIONS` in `lib/skills-hunt/types.ts`, with `SkillsHuntReviewAction` derived from it.
- No row is terminal. Since 2026-08-28 every row offers Accept, Reject, Flag-or-Unflag and Remove-or-Restore whatever state it is in, so an accepted row can be rejected and a removed one acted on directly.

Result: web ☐

---

### SH-A6e — A removed submission can be restored

**Role:** admin · **Surfaces:** web

**Precondition:** A submission exists in the active round.

**Steps:**
1. Flag it, then use **Remove** on it.
2. On the **All** or **Removed** filter, find the row. Confirm it reads "Removed *date* · was flagged · accepting or rejecting it also restores it", that its select box is **enabled**, and that it offers the full set — Accept, Reject, Flag/Unflag, and **Restore**.
3. Use **Restore**. Confirm the row loses its Removed badge and comes back as **flagged** — not pending, not accepted.
4. Use **Unflag**. Confirm it lands in **Pending** with its full actions.
5. Remove it again, then use **Accept** directly on the removed row. Confirm it becomes accepted, live (no Removed badge), and carries its points — a verdict is never blocked behind a restore.
6. Repeat steps 1–2 with a different nomination, but before restoring it, nominate that same person again as a member. Then use **Restore** on the removed row.

**Expected:**
- Steps 3–4: restore undoes the removal and nothing else. The status it had when it was removed is the status it comes back with, so an admin is never forced into a verdict to undo a removal.
- Step 5: accepting a removed row restores it as part of the decision.
- Step 6: the restore is **refused**, with a message saying the person was nominated again and to reject or remove the newer one first. Rejecting the newer nomination and retrying then succeeds. Accepting the removed row instead of restoring it is refused the same way, for the same reason.

Notes:
- This is the fix for a reported bug: with removed rows visible at last, the row was on screen and marked Removed with no action available on it and a disabled select box. Remove was a one-way door, the same dead end flag had. On the admin page every row now offers every action and every select box works — there is no terminal state.
- The refusal in step 6 is not a bug: removing a submission frees its Quora URL for a fresh nomination, so a restore can collide with one. Two live nominations for one person is what `uq_skills_hunt_submissions_round_signature_live` prevents.
- Restoring an **accepted** submission returns its points to the leaderboard and its mission progress with them. It does **not** re-mint a ServiceCredits reward, because removing it did not reverse one.

Result: web ☐

---

### SH-A6d — The admin list hides nothing, and the refusal says what is blocking

**Role:** admin, then member · **Surfaces:** web

**Precondition:** A pending nomination exists in the active round.

**Steps:**
1. Confirm the filter chips read **All · Pending · Accepted · Rejected · Flagged · Removed**, that all six are reachable at phone width, and that **All** is selected when the tab opens.
2. Flag the nomination, then use **Remove** on it.
3. On **All**, confirm the row is still listed, carries a **Removed** badge beside the name, and its action area reads "Removed <date> · was flagged" with no buttons.
4. On **Flagged**, confirm the row still appears — removal does not hide it from its own status filter.
5. On **Removed**, confirm it appears alongside any other removed rows.
6. Confirm the row's select box is disabled, so bulk accept and bulk reject cannot pick it up.
7. Sign in as the member who submitted it and open My Finds. Confirm the removed nomination is **not** shown.
8. As a member, nominate someone who already has a live nomination (pending, accepted or flagged) in any round. Read the refusal message.

**Expected:**
- Steps 3–5: an admin list hides nothing. A removed nomination stays visible and marked, under All, under its own status filter, and under Removed.
- Step 7: a member never sees a removed nomination. The filter is applied to members, not to admins.
- Step 8: the message names the round the blocking nomination is in and what state it is in — for example, *"This person is already nominated in the round "2026 SkillsHunt", where that nomination is waiting for review."* — so the admin knows where to go.

Notes:
- This is the fix for a reported bug: the Flagged filter read "No submissions matching this filter" while the flagged nominee still could not be re-submitted, because the row had been removed and every admin query carried an unconditional `deleted_at IS NULL`.
- The rule is written down in `.claude/rules/131-admin-surface-design-and-build-rules.mdc`: filter for members, never for admins. Pickers and scoring are excluded — an admin should not be able to tag a record with a retired skill, and a removed submission must not earn points.
- The duplicate guard is deliberately **cross-round** — one person, one Quora URL, across every round — so the blocking nomination can be in a round you are not looking at. The message used to say "in this round", which was wrong in exactly that case.

Result: web ☐

---

### SH-A6c — A taken-down person cannot be nominated, and cannot be paid for

**Role:** admin, then member · **Surfaces:** web

**Precondition:** A community-generated Directory profile exists (from an accepted nomination).

**Steps:**
1. In the **Directory** admin screen, use "Remove at the person's request" on that profile. Give a reason. Confirm their Quora URL appears in the "Taken-down Quora URLs" panel.
2. As a member, open SkillsHunt Scout and nominate that same person again — same Quora profile URL.
3. Back in the Directory admin screen, use "Allow again" to lift the block. Then repeat step 2.

**Expected:**
- Step 2: the nomination is **refused** with a message saying the person asked to be removed from the directory. Nothing is created, so no moderator sees it and no points or ServiceCredits are ever in play.
- Step 3: after the block is lifted, the same nomination is accepted normally.

Notes:
- Until 2026-08-27 step 2 succeeded, a moderator could accept it, the scout was paid points and the round's ServiceCredits reward, and no directory profile was generated — the check only ran at the very end of the accept, where it skipped the profile and let everything else stand.
- There is a second refusal at accept time, for the case where the takedown happens **after** a nomination is already sitting in the queue. To exercise it: nominate someone, then take their profile down in Directory, then try to accept the pending nomination. It is refused with a message telling the moderator to reject or remove it instead; no points and no reward are paid.
- SkillsHunt has no takedown surface of its own and should not grow one. It only reads Directory's block list.

Result: web ☐

---

### SH-A6b — A removed submission frees the person to be nominated again

**Role:** admin/moderator, then member · **Surfaces:** web

**Precondition:** A submission exists for a nominee whose Quora URL you can re-enter.

**Steps:**
1. In the admin submissions view, use **Remove** on that submission.
2. As a member, open Scout and nominate the same person again — same Quora profile URL and the same skills.

**Expected:** The nomination is accepted. Removing a submission voids it, so the person can be nominated again in the same round.

Notes:
- This was broken until 2026-08-27: the table carried a blanket `UNIQUE (round_id, signature_hash)` with no predicate, so a removed row held its slot for the rest of the round and the re-add failed with "Duplicate submission signature for this round" — even though the insert path's own rule says a removed row must not block a re-nomination. The constraint is now a partial index carrying that same rule.
- A **pending, accepted or flagged** submission still blocks a duplicate. Un-flag it (SH-A6) rather than re-adding.
- A **rejected** submission also no longer blocks a re-nomination.

Result: web ☐

---

### SH-A7 — Generate a Directory profile from an accepted submission

**Role:** admin/moderator · **Surfaces:** web

**Precondition:** An accepted submission exists that does not yet have a linked Directory profile.

**Steps:**
1. In the admin moderation view, locate an accepted submission.
2. Trigger "Generate Directory Profile" (button or action on the row/detail).
3. Navigate to the Directory and search for the generated profile.

**Expected:**
- A new unclaimed Directory profile is created with `source = 'community-generated'`.
- The profile URL is `@community-<hex>` (reserved prefix).
- The profile shows "Nominated by @<scout-handle>" attribution.
- Attempting to generate a second profile for the same accepted submission returns an error (projection_already_exists).

Result: web ☐

---

### SH-A8 — Reward banner and summary visible in admin submissions view

**Role:** admin/moderator · **Surfaces:** web, android

**Precondition:** A round with `rewardCreditsPerAccept > 0` exists and has at least one accepted submission that was paid.

**Steps:**
1. Open the admin submissions view for the paid round.
2. Observe the reward banner/summary area.

**Expected:**
- Banner shows: `N ServiceCredits per accepted nomination` and the optional per-scout cap.
- Summary shows: "Paid so far: X ServiceCredits across Y nominations" (from `totalCreditsPaid` / `rewardedSubmissionCount`).
- Amounts are shown in full words ("ServiceCredits"), never as a fiat equivalent or bare "SC".

Result: web ☐

---

### SH-A9 — Admin round create/edit is web-only; Android admin has no round creation UI

**Role:** admin · **Surfaces:** android

**Precondition:** Signed in as admin on Android.

**Steps:**
1. Open the `skills-hunt-admin` screen on Android.
2. Look for any "New Round" or "Create Round" button or affordance.
3. Look for any "Delete Round" button or affordance.

**Expected:** Neither a round-create nor a round-delete affordance exists on the Android admin screen. Only the moderation actions (accept/reject/flag) are available.

Result:

---

### SH-A10 — Missions: admin can create and list missions for a round

**Role:** admin · **Surfaces:** web

**Precondition:** An active round exists.

**Steps:**
1. Navigate to the Missions tab of the admin shell.
2. Select the active round.
3. Create a new mission: enter a title, a goal count, and optionally a `colorHex` value.
4. Confirm the form asks for nothing else — there is **no Status field**. A mission is always created active.
4a. In Goal target and Bonus points, select the existing digit and delete it. The box must go empty and accept a fresh number typed straight in — no typing the new number in front of the old one. Leaving a box empty and clicking away puts the field's minimum back (1 for Goal target, 0 for Bonus points). Repeat in the four auto-mission settings fields above.
5. Save.
6. Observe the mission appears in the admin list.

**Expected:** Mission is created and listed, and its row shows no status word (the label appears only when a mission is not active). Navigate to the member-facing Missions tab (`/apps/skills-hunt` → Missions) — the new mission appears immediately, with a progress bar at 0% and the configured color.

**Why there is no status picker:** missions have no draft state (owner directive 2026-08-27). The round already carries its own draft/active lifecycle, and a mission created as draft could only ever be archived — never shown to members.

Result: web ☐

---

### SH-A10b — Missions: a mission can ask for one named skill

**Role:** admin, then member · **Surfaces:** web

**Precondition:** An active round. At least two accepted nominations by the same scout, only one of which carries the taxonomy skill you are about to name.

**Steps:**
1. On the admin Missions tab, press **+ New mission**. Read the Goal type list: each option is a sentence saying what it counts, not a bare identifier, and the identifier it stores is shown underneath.
2. Choose **Accepted nominations carrying one named skill**. A Skill name box appears. Leave it empty and press Create mission.
3. Fill in the Skill name with the exact taxonomy skill one of the accepted nominations carries. Set Goal target to 1. Create.
4. Read the new row in the admin list.
5. Open the member Missions tab.

**Expected:** Step 2 refuses with a sentence naming the skill rule, not a generic failure — an unnamed skill would count nothing and could never be completed. After step 3 the row reads "Accepted nominations carrying one named skill — <the skill>", so the list says what the mission counts without opening it. On the member tab the mission shows 1 of 1, not the scout's whole accepted total.

**Why this exists:** until 2026-09-17 there was no goal type about a single trade, so a mission titled "Find a mechanic" was stored as "every accepted nomination, whatever the skill" and read "82/1 complete" for a scout who had nominated no mechanic (owner report).

Result: web ☐

---

### SH-A10c — Missions: re-point a wrongly-typed mission, then recompute

**Role:** admin, then member · **Surfaces:** web

**Precondition:** The round from SH-A10b, plus a mission created with goal type **Every accepted nomination, whatever the skill** and a target of 1, titled for a single trade (e.g. "Find a mechanic"). At least one accepted nomination exists, so that mission reads complete.

**Steps:**
1. On the member Missions tab, note the number the mission shows — it is the scout's whole accepted total over a target of 1, and reads Complete.
2. On the admin Missions tab, press **Edit** on that row.
3. Change Goal type to **Accepted nominations carrying one named skill**, clear the Skill name, and press Save mission.
4. Put the correct skill in and save.
5. Re-check the member Missions tab **without** pressing anything else.
6. Back on the admin Missions tab, press **Recompute progress**.
7. Re-check the member Missions tab.

**Expected:** Step 3 is refused with a sentence naming the skill rule (the same rule as SH-A10b, checked here against the merged row rather than the fields sent). Step 4 saves, and the admin row now names the skill. **Step 5 still shows the old number** — this is the point of the case: changing a goal does not move a stored count, because progress is only recomputed when a nomination is reviewed. Step 6 reports how many scouts were recomputed. Step 7 shows the corrected count. A mission a scout had genuinely completed earlier stays marked complete — a recompute never clears an earned completion.

**Note on step 1:** since 2026-09-18 the member card caps its count at the target, so an over-counting mission reads "1/1 complete" rather than "82/1". Pick the mission to correct from the admin row's goal description, not from the member card.

Result: web ☐

---

### SH-A9b — Round form fits the phone-width column

**Role:** admin · **Surfaces:** web

**Precondition:** On `/admin/skills-hunt` → Rounds, editing an existing round.

**Steps:**
1. On a phone (or a narrow window), scroll the round edit form top to bottom.
2. Look at Status, Starts and Ends, and at the two ServiceCredits fields below them.

**Expected:** Every field sits fully inside the column — nothing is cut off at the right edge and the page never scrolls sideways. The date fields each take a full row rather than sharing one. (Starts used to run off-screen: `datetime-local` reports a wide intrinsic size on iOS Safari and grew its grid track.)
### SH-A10b — Completing a mission moves the scout up the leaderboard

**Role:** admin + member · **Surfaces:** web

**Precondition:** An active round with a mission carrying a bonus above 0, and a scout close to finishing it.

**Steps:**
1. Note the scout's current score and rank on the round leaderboard, and on the all-time view.
2. Accept enough nominations to complete the mission for that scout.
3. Re-read both leaderboards.
4. Archive the completed mission, then rebuild the leaderboard for that round.
5. Re-read the leaderboard again.

**Expected:**
- Step 3: the score has risen by exactly the mission's bonus points, in the round leaderboard **and** the all-time view, and the rank reflects it — a scout on fewer submission points can now sit above one with more. The rise shows on the same review that completed the mission, not the next one.
- Step 5: the score does **not** change. Earned is earned — the leaderboard reports a round, so archiving closes a mission to new completions but never takes back points already earned. (A member starts a fresh points count in a new round.)
- **No ServiceCredits move at any point.** Points are a ranking figure and have no connection to credits.

Result: web ☐

---

### SH-A11 — Missions: archive (soft-delete) removes mission from member view

**Role:** admin · **Surfaces:** web

**Precondition:** The mission created in SH-A10 exists.

**Steps:**
1. In the admin Missions tab, select the mission created in SH-A10.
2. Archive it (DELETE/archive action).
3. Navigate to the member-facing Missions tab.

**Expected:** The archived mission no longer appears to members. It may still be visible in the admin view with `status=archived` — it is not hard-deleted.

**Then bring it back:** on that archived row the button now reads **Activate**. Press it (no confirmation — activating is the harmless direction) and re-check the member Missions tab: the mission appears again, with any progress members had already earned intact. Archiving stays confirm-gated because it takes a mission away from members.

Result: web ☐

---

### SH-A12 — Feature reward card: admin can update it

**Role:** admin · **Surfaces:** web

**Precondition:** Signed in as admin. On `/admin/skills-hunt`.

**Steps:**
1. Navigate to the Reward Card tab of the admin shell.
2. Change the title to `Join the Skills Hunt`, set `isActive = true`, and save.
3. Navigate to the Directory page as a member.

**Expected:** The reward card on the Directory page now shows the updated title. The CTA still links to `/apps/skills-hunt?tab=scout`.

Result: web ☐

---

### SH-A14 — Audit log tab shows every admin action, and says what changed

**Role:** admin · **Surfaces:** web

**Precondition:** Several moderation actions have been performed in the session — at minimum an accept, a flag, a remove and a restore (SH-A3, SH-A6, SH-A4b, SH-A6b).

**Steps:**
1. Open `/admin/skills-hunt` and select the **Audit log** tab.
2. Read the newest rows.
3. Find the row for a submission you accepted while it was flagged and removed (flag it, remove it, then accept it from the admin list if you have not already).
4. Open the Missions tab, press **Run now** on the auto-mission panel, then return to the Audit log tab and press **Refresh**.
5. Create a round (SH-A1) and rebuild a leaderboard (SH-A2b), then refresh the Audit log again.

**Expected:**
- Step 2: rows are newest first, at most 200, each naming the action in plain words ("Reviewed a nomination", "Removed a nomination", "Restored a nomination"), the actor, what it was done to, and the local date and time. A denied action carries a red chip with its policy status.
- Step 3: the review row reads `accepted · flagged → accepted · also restored it from removed` — it says the status the row came from, the status it went to, and that the accept brought the removed row back. A plain accept on a pending row shows only `accepted · pending → accepted`.
- Step 4: a new "Auto-mission run" row appears with the number opened and updated.
- Step 5: "Created a round" and "Rebuilt the leaderboard" rows appear. Nothing an admin did in this session is missing from the list.

Result: web ☐

---

### SH-A15 — Round-ending-soon notification cron endpoint is admin-gated

**Role:** member (should fail), then admin (should succeed) · **Surfaces:** web

**Precondition:** An active round ending within 24 hours exists (adjust seed dates or create one in SH-A1 with an end date set to a few hours from now).

**Steps:**
1. Signed in as a plain member, POST to `/api/skills-hunt/admin/notifications/round-ending-soon` with the CSRF header (`x-ctf-csrf: 1`).
2. Observe the response.
3. Sign in as admin, repeat the POST.
4. Open the Status panel as a member who has submissions in the ending round.

**Expected:**
- Step 2: 401 or 403.
- Step 3: 200 success.
- Step 4: A `round-ending-soon` notification appears for relevant members (up to 30s poll delay). Each member receives this notification at most once per round (idempotent).
- After step 3, the admin **Audit log** tab shows a "Sent round-ending notifications" row with how many were sent.

Result: web ☐

---

### SH-A16 — Skill-proposal pipeline: a paused classification API loses no proposals and says why

**Role:** owner / operator · **Surfaces:** operational (scheduled workflow, no UI)

**Precondition:** At least one accepted nomination proposes a free-text skill that is not in the taxonomy (run SH-7, then accept it in SH-A3), and that skill has no `skill-proposal` issue yet.

**Steps:**
1. With the Anthropic API unavailable (paused for lack of funds, or run `node ctf/scripts/proposeSkillPromotions.mjs` locally with an invalid `ANTHROPIC_API_KEY`), trigger the `Skills Hunt — Propose Skill Promotions` workflow.
2. Read the run log and the job's result.
3. On the workflow run page, read the error annotation at the top and the job summary — without opening the log.
4. Query `skills_hunt_proposed_skill_promotions` for that skill.
5. Restore a working key with credit and run the workflow again.
6. Run it a third time with nothing else changed.

**Expected:**
- Step 2: the run stops at the first candidate instead of trying the rest, and the job **fails** — a run that files nothing must never report success. The log names which state it is (`no_credit`, `key_rejected`, `access_denied`, `rate_limited`, `vendor_down`, or `unclassified`), quotes the vendor's own sentence with the HTTP status, says nothing is broken and no proposal is lost, and says what to do. The state is read from the vendor's `error.type`, so a `permission_error` and a `billing_error` — which share HTTP 403 — never get the same label. For an unfunded account that reads as "add funds whenever suits; nothing in this repo needs changing".
- Step 3: the annotation reads like `Skill proposals paused — the Anthropic account is out of credit (not a code failure).`, and the job summary repeats the state, the vendor sentence, what to do, and "Are the proposals lost? No." The point of this step: a person seeing the red run weeks later can tell it is a funding state, not a defect, without reading the log or the code.
- Step 4: no row carrying an `issue_number` for that skill. A leftover claim row (no issue number) does not block it: the next run re-claims it after 30 minutes.
- Step 5: one `skill-proposal` issue is filed per distinct proposed skill, each with a suggested sector and occupation (or "needs manual mapping"), and the run succeeds. Nothing had to be re-entered by the member.
- Step 6: `no new proposed skills to process` — no duplicate issue for a skill that already has one.

**Also check that a non-funding failure never reads as a funding one** (the point of the named states). With the API answering:
- a 403 `permission_error` → `access_denied`, and the text says outright it is NOT a funding problem;
- a 403 with no readable error type → `unclassified`, "NOT a known funding or throttling state — do not read it as 'the account needs topping up'";
- a plain 400 `invalid_request_error` (a malformed request, i.e. a real defect) → no state label at all: it fails per-skill, the run ends `every candidate in this run failed`, and nothing claims the account is out of credit.

**And that a funding pause leaves no ticket behind.** After a run blocked by an outside state, trigger `Github Workflows — Health Check` and read its triage issue (label `ci-health`).

**Expected:** the paused workflow appears under "Paused, not broken — no ticket, no fix" with its reason, and is not counted among the failing ones — so if nothing else is red the issue closes (or never opens). A run blocked as `unclassified` is the opposite: it carries no marker, so it counts as failing and belongs on the triage list.

Result: web ☐

---

### SH-A17 — Auto missions: Workforce gap missions open per round, capped and idempotent

**Role:** admin · **Surfaces:** web

**Precondition:** Skills Taxonomy has active sectors with a positive `workforce_share` (otherwise the generator refuses to run — expected, not a bug).

**Steps:**
1. Open the admin Missions tab. Above the mission list, find the "Auto missions from Workforce gaps" panel; confirm it loads the current settings (enabled, minimum sector gap, max per round, goal target, bonus points).
2. Create a new active round (SH-A9 flow). Return to the Missions tab and select it.
3. Observe up to "max per round" missions titled `Scout the [sector] sector`, each carrying the `auto` pill and a "from [sector] gap" line, matching the sectors with the largest Workforce gaps (compare against the Workforce dashboard's Top Training Gaps).
4. Press "Run now". Expect "every active round already has its gap missions" (or 0 opened) — nothing duplicates.
5. Archive one auto mission, press "Run now" again.
6. In the panel, turn the kill switch off, save, create another round.

**Expected:**
- Step 3: missions open at round creation without any admin action; members see them in the Missions tab like any other mission.
- Step 4: re-runs open nothing new for a round already at its cap (one live auto mission per round + sector, database-enforced).
- Step 5: the freed slot is refilled with the next largest-gap sector (which may be the same sector again).
- Step 6: the new round gets no auto missions while disabled; manual mission creation still works throughout.

Result: web ☐

---

### SH-A18 — Auto-mission settings reach missions that are already open

**Role:** admin · **Surfaces:** web

**Precondition:** An active round with at least one auto mission (SH-A17), ideally one already at the per-round cap.

**Steps:**
1. On the admin Missions tab, set Bonus points to 3 and press **Save settings**. Read the confirmation.
2. Press **Run now** and read the result line.
3. Look at the auto missions in the list below.
4. Press **Run now** a second time without changing anything.

**Expected:**
- Step 1: the confirmation says the settings apply on the next run and points at Run now — saving alone does not rewrite missions already open.
- Step 2: the result names how many missions were updated (e.g. "updated 3 missions to these settings"), not just how many were opened.
- Step 3: every live auto mission now reads `+3 pts`. This is the reported bug: before this change a round already at its cap kept the settings it was created with, so the new number appeared nowhere.
- Step 4: the run reports nothing updated and nothing opened — a run that changes nothing says so.

**Points are not credits.** A mission's bonus points are a leaderboard ranking figure; completing a mission sends no ServiceCredits, and no balance should move. (Today they do not reach the leaderboard either — see the inventory Gaps.)

Result: web ☐

---

## Parity check (web ↔ android)

The following cases must produce identical behavior on both surfaces. Rerun them back-to-back on web and Android and confirm they match.

| Case | What to match |
|---|---|
| SH-1 | Round list shows same rounds with same statuses |
| SH-2 | Submission happy path succeeds and shows in My Finds |
| SH-2b | Country required, state/city optional; US shows a state list, other countries a free-text region |
| SH-4 | Full name and bio validation errors fire on the same conditions |
| SH-7 | Proposed-skill chips appear and are submitted correctly |
| SH-8 | Leaderboard rankings match (same data, same order) |
| SH-9 | Missions list shows same missions with same progress |
| SH-10 | My Finds shows same submissions and achievement codes |
| SH-11 | Status panel shows same notifications; mark-read works |
| SH-A3 | Accept action changes status and triggers notification on both |
| SH-A4 | Reject action changes status and triggers notification on both |
| SH-A6 | Flag action changes status on both |
| SH-A8 | Reward banner and per-submission paid indicator visible on both |

**Android-only behavior that intentionally differs from web:**
- Round creation and editing is web-only (SH-A9).
- Missions admin CRUD and the Reward Card editor are web-only (issue #660).
- Each accept/reject/flag on Android requires an explicit confirm gesture before firing.

---

## Known gaps — do not file these as bugs

1. **Admin pre-approval pathway for restricted submitters is disabled.** A user whose rejection rate exceeds the threshold gets a 403 (`SKILLS_HUNT_PRE_APPROVAL_REQUIRED`) but there is no UI for an admin to manually pre-approve them. This is intentional in the current scope.
2. **URL liveness check has no finalized SLO.** A submission with a live Quora URL that happens to time out or return a transient error may behave unpredictably. The 5-second HEAD-check is best-effort; do not file a bug if a valid URL occasionally fails the check.
3. **The team leaderboard no longer exists.** It was removed 2026-08-27: it grouped by each nominee's free-text claimed profession rather than by any team of members, and every row had collapsed into one "Unspecified" bucket once the nomination form stopped collecting professions. Do not file its absence as a bug.
4. **There is no Reports queue, and no way to report a profile.** Both were removed 2026-08-27, along with test cases SH-13 and SH-A13 (their numbers are left unused rather than renumbering every case after them). Nothing could ever file a report — the member route had no button anywhere in the app — and resolving one only flipped a status column without deleting a profile or blocking anything. Taking down a community-generated profile is Directory's job and always was: in the Directory admin screen, an unclaimed community-generated profile carries an amber "Remove at the person's request" control that asks for a reason, deletes the profile, and blocks its Quora URL from being listed again until an admin lifts the block from the "Taken-down Quora URLs" panel on the same screen.
