# Mutual Time — Manual Test Script

> Generated from the feature inventory and declared contracts; this is the runnable checklist for the Mutual Time plugin.
> Regenerate: `pnpm --dir ctf test-script:generate -- mutual-time`

| Field | Value |
|---|---|
| **Plugin** | Mutual Time (`mutual-time`) |
| **Visibility** | Member |
| **Roles to test** | Member, Admin |
| **Surfaces** | Web (`/apps/mutual-time`, `/mutual-time/[slug]`); mobile-responsive web (same URLs at phone width). No Android surface — out of scope per rule 105. |
| **Seed first** | `pnpm --dir ctf seed:mutual-time` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-mutual-time-feature-inventory.md` |
| **Generated** | 2026-07-21 (commit be96b48f); hand-edited 2026-07-22 for the code-review fixes (#1803–#1809): added MT-A12 (admin-list same-origin read guard) and clarified MT-11 (non-string pick → 400). |

---

## How to run this

- Mark each check ✅ pass / ❌ fail / ⛔ blocked.
- A ❌ becomes a row in the Bug Reporting plugin — include the case ID, surface, and what you saw.
- Run **Core smoke** at the start of every session before the walkthroughs.
- "Web" means a desktop browser. "Mobile" means the same URL loaded in a phone-width browser or device browser — there is no separate Android app for this plugin.

---

## Core smoke (every session)

Run the seed first: `pnpm --dir ctf seed:mutual-time`

1. **Admin can reach it; members can't (tile or route).** Mutual Time is **admin-only** (`ADMIN_ONLY_PLUGIN_SLUGS`): an admin finds it in the **admin area grid** (`/admin`) and their own apps launcher, and tapping opens `/apps/mutual-time`, which shows the **standard top nav** (back chevron + brand icon + title + bug/settings/avatar). A signed-in **non-admin member does NOT see a tile** and, if they open `/apps/mutual-time` directly, gets a **404** — members only reach an event via its shared link (`/mutual-time/<slug>`), never `/apps/mutual-time`. web ☐ mobile ☐

2. **Admin dashboard loads.** Sign in as an admin, navigate to `/apps/mutual-time`. The page renders without error and shows at least two events — "Weekly check-in" (open) and "Q3 onboarding" (closed). web ☐ mobile ☐

3. **Public event link loads unauthenticated.** Sign out entirely. Open the shareable link for the seeded open event (copy it from the dashboard or use the known fixed slug). The page renders the event title, the line saying where the meeting is (for example "We'll meet in Chyme") with a button to that plugin, a sign-in prompt, and below it a greyed-out preview of the voting form showing the days and times on offer — no error, no blank screen. web ☐ mobile ☐

4. **Closed event shows a result.** Open the shareable link for "Q3 onboarding" (seeded closed event) while signed out. The page shows the winning time and how many members can make it — no vote controls visible. web ☐ mobile ☐

5. **Approved member can reach the vote surface.** Sign in as an approved member, open the shareable link for the open event. Slot chips are visible and at least one is selectable. web ☐ mobile ☐

---

## Member walkthrough

### MT-1 — Sign-out / listen-in gate

**Role:** None (signed out)
**Surfaces:** Web, Mobile
**Precondition:** Seed run. Open event slug known.

**Steps:**
1. Sign out of the app completely.
2. Navigate to `/mutual-time/<open-event-slug>`.
3. Read the page.

**Expected:** The event title and description are visible. The page says something to the effect that the visitor can come listen in at whatever time is chosen. A sign-in prompt is shown. Below that prompt, the real voting form is shown greyed out as a preview under the line "Here are the times on offer — sign in to pick yours" — no live slot-picking controls, just a look at what is on offer.

Result: web ☐ mobile ☐

---

### MT-1b — The greyed-out preview cannot be used

**Role:** None (signed out)
**Surfaces:** Web, Mobile
**Precondition:** Seed run. Open event slug known. Signed out.

**Steps:**
1. Navigate to `/mutual-time/<open-event-slug>`.
2. Scroll to the greyed-out form below the sign-in prompt.
3. Tap several of the day chips and time buttons in it.
4. On a keyboard, press Tab repeatedly through the page.

**Expected:** Nothing in the preview responds to a tap — no time highlights, no day switches, no count changes. Tab focus moves from the sign-in button straight past the preview; no control inside it can be focused. The days and times shown match what an approved member sees on the live form.

Result: web ☐ mobile ☐

---

### MT-2 — Not-yet-approved (locked) member gate

**Role:** Member (signed in, Unlock tier below `approved_full`)
**Surfaces:** Web, Mobile
**Precondition:** A locked/pending member account exists.

**Steps:**
1. Sign in as a member whose Unlock tier is not yet `approved_full`.
2. Navigate to `/mutual-time/<open-event-slug>`.

**Expected:** The event is visible. The page shows a listen-in message and a prompt to complete approval, plus the same greyed-out preview of the form below it. The member cannot vote — nothing in the preview responds.

Result: web ☐ mobile ☐

---

### MT-3 — Approved member votes (up to 3 slots)

**Role:** Member (`approved_full`)
**Surfaces:** Web, Mobile
**Precondition:** Seed run. Signed in as an approved member. Open event available.

**Steps:**
1. Navigate to `/mutual-time/<open-event-slug>`.
2. Note your detected timezone label on the page.
3. Select one slot chip.
4. Select a second slot chip.
5. Select a third slot chip.
6. Attempt to select a fourth slot chip.
7. Save / submit the picks.

**Expected:**
- Slots are displayed as date chips grouped by Morning / Afternoon / Evening (or similar time-of-day groupings) in the detected local timezone.
- The fourth pick is rejected — the UI prevents selecting more than 3.
- After saving, the three selected chips appear highlighted / confirmed.
- No other member's picks are visible anywhere on the page.

Result: web ☐ mobile ☐

---

### MT-4 — Member revises picks

**Role:** Member (`approved_full`)
**Surfaces:** Web, Mobile
**Precondition:** MT-3 completed (member already has 3 picks saved for the open event).

**Steps:**
1. Navigate to `/mutual-time/<open-event-slug>` (or reload).
2. Confirm the 3 previously chosen slots are highlighted.
3. Deselect one slot.
4. Select a different slot.
5. Save.

**Expected:** The page reloads or updates to reflect the new set of 2–3 picks. The old pick that was deselected is no longer highlighted. The change is persisted — reloading the page shows the updated picks.

Result: web ☐ mobile ☐

---

### MT-5 — Member clears all picks

**Role:** Member (`approved_full`)
**Surfaces:** Web, Mobile
**Precondition:** Member has at least one pick saved for the open event.

**Steps:**
1. Navigate to `/mutual-time/<open-event-slug>`.
2. Deselect all highlighted slots (or use a clear button if present).
3. Save with zero picks.

**Expected:** The save succeeds (no error). Reloading the page shows no picks selected for this member.

Result: web ☐ mobile ☐

---

### MT-5b — The Clear button only appears when there is something saved to clear

**Role:** Member (`approved_full`)
**Surfaces:** Web, Mobile
**Precondition:** Member has never voted on this open event.

**Steps:**
1. Navigate to `/mutual-time/<open-event-slug>` and read the button under the grid before touching anything.
2. Select one time, then read the button again.
3. Save.
4. Deselect that time so nothing is selected, and read the button again.

**Expected:** On first load the button reads "Save my picks", is switched off, and the hint below it reads "Pick a time above, then save." — it never reads "Clear my picks" before anything has been picked. After selecting a time it reads "Save my picks" and is active. After saving and then deselecting everything it reads "Clear my picks" and is active, and pressing it removes the saved picks.

Result: web ☐ mobile ☐

---

### MT-6 — Vote rejected when event is closed

**Role:** Member (`approved_full`)
**Surfaces:** Web, Mobile
**Precondition:** Seed run. "Q3 onboarding" event is in closed status.

**Steps:**
1. Navigate to `/mutual-time/<closed-event-slug>`.
2. Observe the page.

**Expected:** The result view is shown (winning time, how many can make it, meeting link). No slot-picking controls are present. There is no way to submit a vote.

Result: web ☐ mobile ☐

---

### MT-7 — Result shown in viewer's timezone

**Role:** Member (`approved_full`) and signed-out visitor
**Surfaces:** Web, Mobile
**Precondition:** "Q3 onboarding" closed event with a known winning UTC slot.

**Steps:**
1. As a signed-out visitor, open `/mutual-time/<closed-event-slug>`.
2. Note the displayed winning time and the timezone label shown.
3. Sign in as an approved member whose timezone is different (or change the timezone selector if available).
4. Open the same link.
5. Compare the displayed winning time.

**Expected:** Both views show the same moment in time expressed in each viewer's own timezone. The UTC instant is the same; only the local rendering differs.

Result: web ☐ mobile ☐

---

### MT-8 — Timezone selector changes displayed slots

**Role:** Member (`approved_full`)
**Surfaces:** Web, Mobile
**Precondition:** Open event loaded. Member is on the vote surface.

**Steps:**
1. Navigate to `/mutual-time/<open-event-slug>`.
2. Note the auto-detected timezone label.
3. Change the timezone using the timezone selector (for VPN/travel use case).
4. Observe the slot chips.

**Expected:** The slot chips re-render with times expressed in the newly selected timezone. The set of underlying candidate UTC instants is unchanged — only the local display shifts.

Result: web ☐ mobile ☐

---

### MT-9 — Copy-link button

**Role:** Any (signed out, member, admin)
**Surfaces:** Web, Mobile
**Precondition:** Any event page loaded (`/mutual-time/<slug>` or the admin dashboard row).

**Steps:**
1. On the public event page, tap/click the Copy-link button.
2. Paste into a text field and verify the URL.
3. Repeat from the admin dashboard for the same event's Copy-link button.

**Expected:** Both copy operations place the correct `/mutual-time/<slug>` URL on the clipboard. The URL is the same in both places.

Result: web ☐ mobile ☐

---

### MT-10 — Meeting link shown after close

**Role:** Member (`approved_full`) and signed-out visitor
**Surfaces:** Web, Mobile
**Precondition:** "Q3 onboarding" closed event. Meeting plugin is Chyme, Peer Programming, or Beacon.

**Steps:**
1. Open `/mutual-time/<closed-event-slug>`.
2. Find the link to the meeting surface.
3. Confirm the link target.

**Expected:** A "Go to Chyme", "Go to Peer Programming", or "Go to Beacon" link (matching whichever plugin was configured) is visible. The winning time and the count of members who can make it are shown alongside it.

Result: web ☐ mobile ☐

---

### MT-11 — Vote endpoint rejects invalid slot

**Role:** Member (`approved_full`)
**Surfaces:** Web (API layer; can be tested via browser dev-tools or a REST client)
**Precondition:** Open event slug known. Member auth cookie in hand.

**Steps:**
1. Construct a POST to `/api/mutual-time/event/<slug>/vote` with the `x-ctf-csrf: '1'` header and a body containing a `slots` array with one entry set to an arbitrary timestamp that is not in the event's candidate window (e.g., a date outside the 7-day window).
2. Send the request.
3. Send a second request whose `slots` array contains a non-string element (e.g. `[null]` or `[123]`).

**Expected:** Step 2 returns HTTP 400 with code `invalidSlot` (well-formed but unknown slot). Step 3 returns HTTP 400 with code `invalidPayload` (malformed list — element is not a string). No vote is stored in either case.

Result: web ☐

---

### MT-12 — Where the meeting is, shown before the time is chosen

**Role:** None (signed out), then Member (`approved_full`)
**Surfaces:** Web, Mobile
**Precondition:** An open event whose meeting plugin is known (for example Chyme).

**Steps:**
1. Signed out, open `/mutual-time/<open-event-slug>` and look above the sign-in prompt.
2. Follow the button next to it.
3. Sign in as an approved member, reopen the same link, and look above the voting form.

**Expected:** Both views show "We'll meet in <plugin>" — for example "We'll meet in Chyme" — with a "Go to <plugin>" button beside it. The button opens that plugin's page in the app (for example `/apps/chyme`, which is `https://app.chargingthefuture.com/apps/chyme` in production). This shows before the survey closes, not only after.

Result: web ☐ mobile ☐

---

## Admin walkthrough

### MT-A1 — Create an event (Chyme, no close date)

**Role:** Admin
**Surfaces:** Web, Mobile
**Precondition:** Signed in as admin. On `/apps/mutual-time`.

**Steps:**
1. Click/tap the button to create a new event.
2. Leave title blank.
3. Enter a description: "Admin test event".
4. Choose "Chyme" as the meeting plugin.
5. Leave open/close date-times blank.
6. Submit.

**Expected:** The new event appears in the dashboard list with status "open" (or "scheduled" if opens_at defaults to now). A shareable link / slug is shown. The Copy-link button is present. Voter count is 0.

Result: web ☐ mobile ☐

---

### MT-A1b — "Where we'll meet" lists all three, and no field runs off the screen

**Role:** Admin
**Surfaces:** Web, Mobile
**Precondition:** Signed in as admin. On `/apps/mutual-time`, on a phone-width screen.

**Steps:**
1. Open the "Where we'll meet" dropdown.
2. Read every option in the list.
3. Pick "Beacon" and submit the form with everything else left blank.
4. Close the dropdown and look at the right edge of the "Survey opens" and "Survey closes" date-and-time fields.

**Expected:** The dropdown lists exactly three options — Chyme, Peer Programming, Beacon — and the event saves with Beacon. The two date-and-time fields end at the same right edge as the title box, the description box, and the dropdown above them; nothing sticks out past the edge of the card and the page does not scroll sideways.

Result: web ☐ mobile ☐

---

### MT-A2 — Create an event with a title and scheduled close time

**Role:** Admin
**Surfaces:** Web, Mobile
**Precondition:** Signed in as admin. On `/apps/mutual-time`.

**Steps:**
1. Click to create a new event.
2. Enter title: "Test with close time".
3. Choose "Peer Programming" as the meeting plugin.
4. Set a close date-time roughly 5 minutes in the future.
5. Submit.

**Expected:** Event appears in the dashboard with the title, status, and the configured close time visible. Status is "open" or "scheduled" (not "closed").

Result: web ☐ mobile ☐

---

### MT-A3 — Dashboard shows voter counts and status pills

**Role:** Admin
**Surfaces:** Web, Mobile
**Precondition:** Seed run. Admin dashboard open.

**Steps:**
1. Navigate to `/apps/mutual-time`.
2. Find "Weekly check-in" (open, seeded votes).
3. Find "Q3 onboarding" (closed).
4. Note the status pill and voter count for each.

**Expected:**
- "Weekly check-in" shows a status pill labeled "open" and a voter count greater than 0 (from seed).
- "Q3 onboarding" shows a status pill labeled "closed", the winning time, and the count of members who can make it.
- Each row has Copy-link and View buttons.
- "Weekly check-in" has a "Close and choose the time" button; "Q3 onboarding" does not (already closed).

Result: web ☐ mobile ☐

---

### MT-A4 — Manual close runs the algorithm and shows the winner

**Role:** Admin
**Surfaces:** Web, Mobile
**Precondition:** MT-A1 event exists and has at least two members' votes (cast manually via MT-3/MT-4 with different member accounts, or use the seeded open event with existing votes).

**Steps:**
1. On the dashboard, find an open event with votes.
2. Click "Close and choose the time".
3. Confirm any confirmation dialog.
4. Observe the dashboard row after close.
5. Open the public link for that event.

**Expected:**
- The dashboard row now shows status "closed", the winning time slot, and the count of members who can make it.
- The public link shows the result view: winning time in the viewer's timezone, count, and the meeting link.
- The "Close and choose the time" button is gone from the dashboard row.

Result: web ☐ mobile ☐

---

### MT-A5 — Close with no votes produces a graceful result

**Role:** Admin
**Surfaces:** Web, Mobile
**Precondition:** Create a fresh event (MT-A1 steps). Do not cast any votes for it.

**Steps:**
1. On the dashboard, click "Close and choose the time" for the new event with 0 votes.
2. Confirm.

**Expected:** The event closes without an error. The dashboard and public link show a graceful "no time could be chosen" or equivalent message — no unhandled exception, no blank result slot.

Result: web ☐ mobile ☐

---

### MT-A6 — Auto-close at the configured close time

**Role:** Admin (observing); approved member (verifying the result link)
**Surfaces:** Web, Mobile
**Precondition:** MT-A2 event exists with close time set ~5 minutes in the future. At least one member vote cast.

**Steps:**
1. Wait until the configured close time passes.
2. As admin, navigate to `/apps/mutual-time` (the GET triggers auto-close of due events).
3. Check the status of the MT-A2 event.
4. Open the public link for that event.

**Expected:** The event status has changed to "closed". The public link shows the result view with the winning time. No manual close action was needed.

Result: web ☐ mobile ☐

---

### MT-A7 — Non-creator admin cannot close another admin's event

**Role:** Admin (different account from the event creator)
**Surfaces:** Web (API layer)
**Precondition:** An event exists created by Admin A. Signed in as Admin B.

**Steps:**
1. As Admin B, send a POST to `/api/mutual-time/events/<eventId>/close` with the `x-ctf-csrf: '1'` header.

**Expected:** The server returns HTTP 404 (ownership check). The event remains open.

Result: web ☐

---

### MT-A8 — Non-admin member cannot create an event

**Role:** Member (`approved_full`)
**Surfaces:** Web (API layer)
**Precondition:** Signed in as a non-admin approved member.

**Steps:**
1. Send a POST to `/api/mutual-time/events` with the `x-ctf-csrf: '1'` header and a valid event body (meetingPlugin: "chyme").

**Expected:** The server returns HTTP 403 (`forbiddenRole`). No event is created. The admin dashboard does not list a new event.

Result: web ☐

---

### MT-A9 — CSRF guard blocks mutations without the required header

**Role:** Admin
**Surfaces:** Web (API layer)
**Precondition:** Signed in as admin.

**Steps:**
1. Send a POST to `/api/mutual-time/events` **without** the `x-ctf-csrf: '1'` header.
2. Send a POST to `/api/mutual-time/event/<slug>/vote` **without** the header (use an approved member session).

**Expected:** Both requests return HTTP 403. No data is written in either case.

Result: web ☐

---

### MT-A10 — Public read is rate-limited per IP

**Role:** None (anonymous)
**Surfaces:** Web (API layer)
**Precondition:** Open event slug known.

**Steps:**
1. In rapid succession (script or manual repeated reload), send more GET requests to `/api/mutual-time/event/<slug>` from the same IP than the rate limit allows.

**Expected:** After the threshold is crossed, the server returns HTTP 429. Earlier requests below the threshold returned 200.

Result: web ☐

---

### MT-A11 — Individual votes are never exposed in the public read

**Role:** None (anonymous) and Admin
**Surfaces:** Web (API layer)
**Precondition:** Open event with at least one vote cast.

**Steps:**
1. As a signed-out visitor, call `GET /api/mutual-time/event/<slug>`.
2. Inspect the full JSON response.
3. Sign in as admin and repeat the request.

**Expected:** Neither response contains a list of who voted or which slots individual members chose. The response includes only the voter count (aggregate), the candidate slots, and — for the closed case — the winning slot. A signed-in approved member's own picks may appear in a `viewer` field, but no other member's picks are present.

Result: web ☐

---

### MT-A12 — Admin event-list read rejects a cross-origin request

**Role:** Admin
**Surfaces:** Web (API layer)
**Precondition:** Signed in as admin (valid session cookie).

**Steps:**
1. Send a `GET /api/mutual-time/events` from the app itself (same-origin, or with no `Origin` header) — the normal dashboard load.
2. Send a `GET /api/mutual-time/events` with an `Origin` header set to a different host (e.g. `https://evil.example`) while carrying the admin session cookie.

**Expected:** Step 1 returns HTTP 200 with the admin's event list (a missing or same-origin `Origin` passes). Step 2 returns HTTP 403 with code `csrfDenied` — the admin's slugs and voter counts are not returned to a cross-origin caller.

Result: web ☐

---

## Parity check (web ↔ mobile)

The following cases must behave identically in a desktop browser and a phone-width browser. Layout may reflow (single column, scrollable date chips) but all controls and data must be present and functional.

| Case | What to verify is the same |
|---|---|
| MT-1 | Listen-in gate and sign-in prompt render correctly at phone width |
| MT-3 | Slot chips are horizontally scrollable; selecting up to 3 and saving works |
| MT-6 | Result view is readable; winning time and meeting link are accessible |
| MT-9 | Copy-link button is tappable and copies the correct URL |
| MT-A1 | Event creation form is usable at phone width; all fields reachable |
| MT-A3 | Dashboard rows readable; status pills, voter counts, and action buttons all visible without horizontal overflow |
| MT-A4 | "Close and choose" flow completes on mobile without layout breakage |

---

## Known gaps — do not file these as bugs

1. **Target meeting week is derived, not configured.** The candidate window is always 7 days from when voting opens. There is no admin control to pick a specific target week separately from the survey open/close times. This is a documented follow-up item.
2. **Full 24-hour candidate grid.** All 48 half-hour starts per day are candidates. The admin cannot restrict the daily hour range. A future refinement may add daily hour bounds.
3. **No reminder or notification when a time is chosen.** Members must re-open the link themselves to see the result. A push/notification tie-in is a possible follow-up, not a current feature.
