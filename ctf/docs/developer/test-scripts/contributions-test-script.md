# Contributions — Manual Test Script

> Generated from the feature inventory and command contracts; this is the runnable checklist for confirming the Contributions plugin works on real devices. Regenerate with:
> `pnpm --dir ctf test-script:generate -- contributions`

| Field | Value |
|---|---|
| **Plugin** | Contributions (`contributions`) |
| **Visibility** | Member (any authenticated member; no Unlock tier required) |
| **Roles to test** | member, admin |
| **Surfaces** | Web (`/apps/contributions`, `/admin/contributions`, fundraiser banner in Hub) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-contributions-feature-inventory.md` |
| **Generated** | 2026-08-06 (commit 4cfc88690) |

> **Android note:** The Android surface was removed 2026-07-20 (rule 105, PR #1742). This plugin is now web-only (installable PWA). All cases are web-only. The parity section documents this explicitly.

---

## How to run this

- Mark each result ✅ pass / ❌ fail / ⛔ blocked.
- A ❌ becomes a row in the Bug Reporting plugin — record the case ID, surface, what happened, and what was expected.
- Run **Core smoke** at the start of every test session before anything else.
- Run `pnpm --dir ctf seed:demo` once before the session to get the demo cycle and demo claims into a known state.

---

## Core smoke (every session)

These are the checks that must pass before any further testing is meaningful.

**1. Member can reach the contributions page**
Sign in as a member. Navigate to `/apps/contributions`. The page loads — it does not show a 404, a sign-in wall, or a loading spinner that never resolves.
web ☐

**2. Fundraiser progress is visible**
On `/apps/contributions`, collective totals are visible: USD raised, number of Quora comments, number of GitHub stars, and contributor count. These are aggregate numbers — no individual member names appear.
web ☐

**3. Admin can reach the admin dashboard**
Sign in as an admin. Navigate to `/admin/contributions`. The page loads showing at least a review queue section, a drive section, and a settings section.
web ☐

**4. Signed-out users cannot access member or admin routes**
Sign out. Navigate to `/apps/contributions`. The page does not render member content (redirect to sign-in or public shell only). Navigate to `/admin/contributions`. Same — no admin content renders.
web ☐

---

## Member walkthrough

### CONT-1 — Fundraiser snapshot loads with live credit valuations

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Seed has run. Signed in as a member.

**Steps:**
1. Navigate to `/apps/contributions`.
2. Find the section that shows how contributions are thanked (ServiceCredits).
3. Note the SC-per-dollar figure shown and the SC-per-comment-or-star figure shown.
4. In a separate tab, sign in as admin and go to `/admin/contributions` → Settings.
5. Note the "Credits per USD" and "Credits per comment or star" values in the admin settings.

**Expected:**
The member-facing copy shows the same numbers as the admin settings. If admin settings show 10 SC per USD and 10 SC per comment or star, the member page shows exactly those numbers — not hardcoded values that differ.

**Result:** web ☐

---

### CONT-2 — Submit a gift-card contribution claim

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Signed in as a member. A demo cycle with window covering today exists (seeded).

**Steps:**
1. Navigate to `/apps/contributions`.
2. In the "How would you like to help?" section, choose the gift card path (click "Choose this" or equivalent affordance on the gift card card).
3. Confirm the form appears directly below the cards (not at the bottom of the page).
4. Select "Amazon" as the card type.
5. Enter `25` in the amount field.
6. Enter a placeholder Signal contact (e.g. `https://signal.me/#p/test`).
7. Confirm there is a warning visible on the form that says never to post a gift-card code in the Commons.
8. Confirm there is no field in the form asking for a gift-card code.
9. Submit the form.

**Expected:**
- The form accepts the submission and moves to a confirmation screen.
- The confirmation screen shows the owner's Signal contact (either from the `ownerSignalUrl` field or the Signal instructions copy) and repeats the warning not to post the code in the Commons.
- No "code" field exists anywhere on the form or confirmation.

**Result:** web ☐

---

### CONT-3 — Gift-card form validation rejects out-of-range amounts

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Signed in as a member. Gift-card path is selected.

**Steps:**
1. Open the gift-card form.
2. Try submitting with amount `0`.
3. Try submitting with amount `501`.
4. Try submitting without a Signal contact.

**Expected:**
- Amount `0` is rejected with a validation error before submission reaches the server.
- Amount `501` is rejected with a validation error.
- Missing Signal contact is rejected with a validation error.
- In all three cases the form stays open and no claim is created.

**Result:** web ☐

---

### CONT-4 — Submit a Quora comment contribution claim

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Signed in as a member.

**Steps:**
1. Navigate to `/apps/contributions`.
2. Choose the Quora comment path.
3. Try submitting without a Quora post URL.
4. Confirm the form shows a help line directing members to ask in the Commons if they cannot find their link.
5. Enter a valid URL (e.g. `https://qr.ae/test123`).
6. Submit.

**Expected:**
- Submitting without a URL is blocked by a validation error.
- After entering a URL the submission succeeds and shows a confirmation.
- The help line referencing the Commons is visible before submission.

**Result:** web ☐

---

### CONT-5 — Submit a GitHub star contribution claim

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Signed in as a member whose account has no prior credited GitHub star (a fresh demo member, or a member whose seed data shows the star was rejected, not confirmed with credits).

**Steps:**
1. Navigate to `/apps/contributions`.
2. Choose the GitHub star path.
3. Confirm the GitHub star card/path is not grayed out (this member has no credited star).
4. Try submitting without a GitHub profile URL.
5. Confirm the form shows a help line directing members to ask in the Commons if they cannot find their profile link.
6. Enter a GitHub profile URL (e.g. `https://github.com/testuser`).
7. Submit.

**Expected:**
- Submitting without a URL is blocked by validation.
- After entering a URL the submission succeeds and shows a confirmation.

**Result:** web ☐

---

### CONT-6 — GitHub star path is grayed out after a credited star

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Signed in as a member who already has a confirmed GitHub star with `credits_granted > 0`. (The demo seed has a rejected star; for this case you need an admin to confirm a star submission with credits, or manually insert a confirmed row with credits > 0 in the dev DB.)

**Steps:**
1. Navigate to `/apps/contributions`.
2. Look at the GitHub star path/card.

**Expected:**
The GitHub star path is visually grayed out or disabled. Attempting to select it either does nothing or shows a message explaining the star has already been credited. The fundraiser snapshot field `githubStarAlreadyCredited` is `true` for this member.

**Result:** web ☐

---

### CONT-7 — GitHub star cannot be re-submitted via API after a credited star

**Role:** Member
**Surfaces:** Web (API)
**Precondition:** Member already has a confirmed GitHub star with `credits_granted > 0`.

**Steps:**
1. In browser DevTools (or a REST client using the session cookie), send:
   `POST /api/contributions/submission`
   with header `x-ctf-csrf: 1` and body `{"kind":"github_star","githubProfileUrl":"https://github.com/testuser"}`.

**Expected:**
The server returns HTTP 409 with error code `contributions_github_star_already_credited`. No new submission row is created.

**Result:** web ☐

---

### CONT-8 — Claim history shows member's own submissions

**Role:** Member
**Surfaces:** Web (`/apps/contributions`)
**Precondition:** Seed has run. Signed in as the demo member who has the three seeded claims (pending gift card, confirmed Quora comment, rejected GitHub star).

**Steps:**
1. Navigate to `/apps/contributions`.
2. Find the contribution history section (may be a tab labeled "My history" or a rail on desktop).
3. Review the list of claims.

**Expected:**
- Three claims are visible: one pending Amazon gift card, one confirmed Quora comment, one rejected GitHub star.
- Each shows its status clearly (pending / confirmed / rejected).
- No other member's claims appear.
- The `signalContact` value from the gift-card claim is not shown anywhere on the member view.

**Result:** web ☐

---

### CONT-9 — Fundraiser banner appears for authenticated member

**Role:** Member
**Surfaces:** Web (Hub, wherever the banner is integrated)
**Precondition:** Signed in as a member. Admin has banner enabled (default). Member has not snoozed the banner (fresh seed state).

**Steps:**
1. Navigate to the Hub (the main signed-in landing area).
2. Look for the fundraiser banner at the top of the Hub content area.

**Expected:**
The fundraiser banner is visible. It shows collective drive progress and a way to open the contributions page. A "Not now" or dismiss control is visible (the `SHOW_DISMISS_BUTTON` flag must be enabled for this case — if the button is hidden in the current build, note that and mark this case blocked ⛔).

**Result:** web ☐

---

### CONT-10 — Dismissing the banner on desktop hides it

**Role:** Member
**Surfaces:** Web (desktop width)
**Precondition:** Banner is visible. `SHOW_DISMISS_BUTTON` is enabled. Member has not snoozed.

**Steps:**
1. On a desktop-width browser window, locate the fundraiser banner in the Hub.
2. Click "Not now" (or the dismiss control).
3. Observe the banner area immediately.
4. Refresh the page.

**Expected:**
- After dismissing, the banner disappears on desktop. No emoji or strip remains in its place.
- After refresh, the banner is still gone (snooze is stored server-side, not just in memory).

**Result:** web ☐

---

### CONT-11 — Dismissing the banner collapses it to a 🎁 chip in the Commons chip row

**Role:** Member
**Surfaces:** Web (phone width)
**Precondition:** Banner is visible. `SHOW_DISMISS_BUTTON` is enabled. Member has not snoozed. Use a narrow browser window or real phone.

**Steps:**
1. At phone width, locate the fundraiser banner in the Hub.
2. Click "Not now".
3. Observe the banner area, the top bar, and the chip row above the message box.

**Expected:**
- The full banner collapses.
- A small 🎁 (gift emoji) chip appears in the Commons chip row, immediately after the 🔔 notifications chip.
- No 🎁 appears in the top bar.
- The chip is tappable and opens the contributions plugin.
- The large banner strip is no longer shown.

**Result:** web ☐

---

### CONT-12 — Unauthenticated user cannot submit a claim

**Role:** Signed-out
**Surfaces:** Web (API)
**Precondition:** Not signed in.

**Steps:**
1. Send `POST /api/contributions/submission` with header `x-ctf-csrf: 1` and body `{"kind":"quora_comment","quoraPostUrl":"https://qr.ae/test"}` — no auth cookie.

**Expected:**
The server returns 401 or 403. No submission is created.

**Result:** web ☐

---

### CONT-13 — Non-admin member cannot access admin routes

**Role:** Member (non-admin)
**Surfaces:** Web (API)
**Precondition:** Signed in as a regular member (not admin).

**Steps:**
1. Send `GET /api/contributions/admin/submissions` with header `x-ctf-csrf: 1` and the member's session cookie.

**Expected:**
The server returns 403. The `signalContact` values of other members are not returned.

**Result:** web ☐

---

## Admin walkthrough

### CONT-A1 — Admin review queue shows all pending submissions with Signal contact

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** Seed has run. At least one pending gift-card claim exists (seeded).

**Steps:**
1. Sign in as admin.
2. Navigate to `/admin/contributions`.
3. Open the review queue. If there is a status filter, leave it on "pending" or "all".
4. Find the seeded pending Amazon gift-card claim.
5. Inspect the details shown for that claim.

**Expected:**
- The queue shows pending claims.
- The gift-card claim row shows a Signal contact value (the placeholder from the seed).
- The Signal contact is visible only here, not on any member-facing page.
- No gift-card code field or column exists anywhere in the queue UI.

**Result:** web ☐

---

### CONT-A2 — Admin can filter the queue by status

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** Seed has run. Claims in mixed statuses exist.

**Steps:**
1. In the review queue, filter by "confirmed".
2. Check that only confirmed claims appear.
3. Filter by "rejected".
4. Check that only rejected claims appear.
5. Filter by "pending".
6. Check that only pending claims appear.

**Expected:**
Each filter shows only claims with the matching status. No cross-status leakage.

**Result:** web ☐

---

### CONT-A3 — Admin confirms a pending gift-card claim and credits are granted

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** At least one pending gift-card claim exists. (Use the seeded Amazon claim, or submit a new one as a member first.)

**Steps:**
1. Open the review queue and find a pending gift-card claim.
2. Click the confirm action.
3. Enter `20` as the confirmed USD amount.
4. Submit the confirmation.
5. Check the claim's status in the queue.
6. Navigate to the member's ServiceCredits wallet (in the ServiceCredits plugin or admin view) to verify credits were granted.

**Expected:**
- The claim status changes to "confirmed".
- `confirmedAmountUsd` is 20.
- `creditsGranted` = 20 × `creditsPerUsd` (e.g. 20 × 10 = 200 SC), unless clamped by the per-cycle cap.
- The `creditGovernanceEventId` field is populated (non-null) — confirming the ServiceCredits mint path ran.
- Attempting to confirm the same claim a second time is rejected (the review can only happen once).
- The audit row written for the confirm records the reviewed member as `targetUserId` in its metadata alongside the admin who acted (check `contributions_audit_log` if you are verifying the audit trail).

**Result:** web ☐

---

### CONT-A4 — Confirming a gift-card claim requires a confirmed amount

**Role:** Admin
**Surfaces:** Web (API)
**Precondition:** A pending gift-card claim exists. Admin is signed in.

**Steps:**
1. Send `POST /api/contributions/admin/submissions/<submissionId>/review` with header `x-ctf-csrf: 1`, body `{"action":"confirm"}` — no `confirmedAmountUsd`.

**Expected:**
The server returns 400 or 422 (missing required field). The claim stays pending.

**Result:** web ☐

---

### CONT-A5 — Admin confirms a Quora comment claim — amount defaults from config

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** A pending Quora comment claim exists.

**Steps:**
1. Find a pending Quora comment claim in the queue.
2. Confirm it without supplying a custom USD amount.
3. Check the resulting `confirmedAmountUsd` and `creditsGranted` on the claim.

**Expected:**
`confirmedAmountUsd` equals `nonMonetaryUnitValueUsd` from the config (default 1 USD). `creditsGranted` = 1 × `creditsPerUsd` (default 10 SC), unless clamped by cap.

**Result:** web ☐

---

### CONT-A6 — Admin rejects a pending claim — no credits granted

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** A pending claim exists.

**Steps:**
1. Find a pending claim in the queue.
2. Click the reject action. Optionally enter a review note.
3. Submit the rejection.
4. Check the claim's status and credits.

**Expected:**
- Status changes to "rejected".
- `creditsGranted` is 0.
- No ServiceCredits are minted.
- The claim cannot be reviewed again.
- The audit row for the rejection records the reviewed member as `targetUserId` in its metadata, same as the confirm path.

**Result:** web ☐

---

### CONT-A7 — Confirming an already-reviewed claim is rejected

**Role:** Admin
**Surfaces:** Web (API)
**Precondition:** A claim that is already confirmed or rejected exists.

**Steps:**
1. Send `POST /api/contributions/admin/submissions/<alreadyReviewedId>/review` with header `x-ctf-csrf: 1` and body `{"action":"confirm","confirmedAmountUsd":10}`.

**Expected:**
The server returns an error (400 or 409 — the claim is not pending). The existing status does not change. Credits are not double-granted.

**Result:** web ☐

---

### CONT-A8 — Per-cycle credit cap is enforced

**Role:** Admin
**Surfaces:** Web (API)
**Precondition:** A member has already received credits in the current cycle equal to or near the per-cycle cap (default 300 SC). Create this state: confirm enough gift-card claims for one member to reach ~290 SC for the cycle, then prepare one more pending claim for the same member.

**Steps:**
1. Confirm the additional claim that would push the member over 300 SC.
2. Check `creditsGranted` on the newly confirmed claim.

**Expected:**
`creditsGranted` is clamped so the member's total for the cycle does not exceed 300 SC. The claim still shows status "confirmed"; only the credit amount is reduced. If the cap was already exactly met, `creditsGranted` is 0 and the claim is still confirmed.

**Result:** web ☐

---

### CONT-A9 — Confirming a duplicate GitHub star grants 0 credits

**Role:** Admin
**Surfaces:** Web (API)
**Precondition:** A member already has one confirmed GitHub star with `credits_granted > 0`. A second GitHub star submission from the same member exists in the queue (submitted while the first was still pending, or forced into the DB for testing).

**Steps:**
1. Open `/apps/contributions` as any member and write down the "Stars" number on the drive progress bar.
2. Find the second GitHub star claim for that member in the admin queue.
3. Confirm it.
4. Reload `/apps/contributions` and read the "Stars" number again.

**Expected:**
- The claim status becomes "confirmed".
- `creditsGranted` is 0.
- The mint path is not called (no new `creditGovernanceEventId` from this claim).
- A review note or similar record explains the duplicate star rule.
- The "Stars" number on the progress bar is **unchanged** from step 1. The bar counts how many
  members starred, not how many star rows exist, so a member's second confirmed star must not move
  it. (A rise of 1 here is the bug fixed in #2143 coming back.)

**Result:** web ☐

---

### CONT-A10 — Admin creates a new fundraiser cycle

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** Signed in as admin.

**Steps:**
1. Navigate to `/admin/contributions` → Drive management section.
2. Create a new cycle with start date one month from today, end date four months from today, fiat goal 200 USD, Quora comment goal 100, GitHub star goal 50.
3. Save.
4. Verify the cycle appears in the drive list with the values entered.

**Expected:**
The new cycle is saved and displayed with correct start/end dates and all three goals. No error is shown.

**Result:** web ☐

---

### CONT-A11 — Cycle with end before start is rejected

**Role:** Admin
**Surfaces:** Web (API)
**Precondition:** Signed in as admin.

**Steps:**
1. Send `POST /api/contributions/admin/cycles` with header `x-ctf-csrf: 1` and body `{"startsAt":"2027-06-01T00:00:00Z","endsAt":"2027-05-01T00:00:00Z","fiatGoalUsd":100}`.

**Expected:**
The server returns 400 or 422. No cycle is created. The `ends_at > starts_at` constraint is enforced.

**Result:** web ☐

---

### CONT-A12 — Admin edits an existing cycle

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** At least one cycle exists (the seeded demo cycle works).

**Steps:**
1. Open the drive management section.
2. Edit the seeded cycle: change the fiat goal to 150 USD.
3. Save.

**Expected:**
The cycle shows the updated fiat goal (150 USD). Other fields are unchanged.

**Result:** web ☐

---

### CONT-A13 — Admin updates runtime configuration

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** Signed in as admin.

**Steps:**
1. Navigate to the Settings section of the admin dashboard.
2. Note the current "Credits per comment or star" control value.
3. Change it to a different value (e.g. if it shows 10, change to 20).
4. Save.
5. Navigate to `/apps/contributions` (member view) and check the credits-per-action figure shown.

**Expected:**
- Settings save without error.
- The member-facing page now shows the updated SC-per-comment-or-star value (matching the new setting).
- The admin settings display the helper line showing the underlying USD value that the control converts to before saving.
- The audit row written for this save names only the setting that was actually edited. Its metadata
  has a `changedKnobs` list holding just that one field, and the full set of values after the save
  sits separately under `resultingConfig` (check `contributions_audit_log` if you are verifying the
  audit trail). A `changedKnobs` list naming every setting means the row cannot tell an edit from a
  value that was simply carried over.

**Result:** web ☐

---

### CONT-A14 — Banner can be disabled via admin settings

**Role:** Admin
**Surfaces:** Web
**Precondition:** Banner is currently enabled.

**Steps:**
1. In admin settings, turn the banner off (set `bannerEnabled` to false). Save.
2. Sign in as a member (or open an incognito tab as the member).
3. Navigate to the Hub.

**Expected:**
The fundraiser banner does not appear. The 🎁 emoji also does not appear (banner is off entirely, not just snoozed). The member's contributions page still works normally.

**Result:** web ☐

---

### CONT-A15 — Admin sets custom Signal instructions copy

**Role:** Admin
**Surfaces:** Web (`/admin/contributions`)
**Precondition:** Signed in as admin.

**Steps:**
1. In admin settings, update the "Signal instructions" text to `"Send the gift card to @testowner on Signal."`.
2. Save.
3. As a member, submit a gift-card claim.
4. Check the post-submit confirmation screen.

**Expected:**
The confirmation screen shows the updated Signal instructions text (or the `ownerSignalUrl` if that env var is set — if both are present, the URL takes precedence and the instructions are fallback copy). No real contact details from seed data appear.

**Result:** web ☐

---

### CONT-A16 — Banner snooze months config is internal — not shown to member

**Role:** Admin / Member
**Surfaces:** Web
**Precondition:** Signed in as admin.

**Steps:**
1. In admin settings, change `bannerSnoozeMonths` to 1.
2. Save.
3. Sign in as a member and dismiss the banner.
4. Check — there is no countdown, no mention of "1 month", and no snooze-length copy anywhere on the member-facing surface.

**Expected:**
The snooze duration is never shown to the member. The banner simply disappears (desktop) or collapses to the emoji (phone width) with no guilt copy and no timer displayed.

**Result:** web ☐

---

### CONT-A17 — CSRF header is required for mutations

**Role:** Any authenticated user
**Surfaces:** Web (API)
**Precondition:** Signed in as a member.

**Steps:**
1. Send `POST /api/contributions/submission` with a valid session cookie and valid body `{"kind":"quora_comment","quoraPostUrl":"https://qr.ae/test"}` but **without** the `x-ctf-csrf: 1` header.

**Expected:**
The server returns 403 or 400. No submission is created.

**Result:** web ☐

---

## Parity check (web ↔ android)

The Android surface was **removed on 2026-07-20** (rule 105, PR #1742). The plugin is now web-only, delivered as an installable PWA. There is no Android parity to verify.

For completeness: the parity contract entry in `config/plugin-parity-contracts.json` still carries the `contributions` entry. Confirm that the entry's `webOnly` or equivalent flag reflects the removal — if it still declares Android parity as required, file a bug against the parity config, not against the plugin behavior.

| Case | Web | Android |
|---|---|---|
| All member and admin cases above | ✅ test on web | N/A — surface removed |

---

## Known gaps — do not file these as bugs

- **Confirmed seed claim has no ledger event.** The demo confirmed Quora comment claim shows `credits_granted = 10` but `credit_governance_event_id` is null because the seed does not run the real mint path. This is expected in demo data. Do not file a bug if the admin view shows a null governance event ID for that specific seeded row.
- **Metrics have no dashboard wiring.** The five `contributions_*` canonical metrics exist but are not connected to any visible dashboard. No bug to file.
- **Cycle window partial-edit validation.** Editing only one end of a cycle window is validated against the supplied value only, not the stored opposite end. The owner is the sole writer; this is an accepted limitation.
- **`getFundraiserSnapshot` records `last_shown_at` on read.** A read-path write happens on every fundraiser snapshot load. If this causes a performance concern, it is a known debt item, not a bug.
- **`SHOW_DISMISS_BUTTON` flag.** The "Not now" dismiss button on the fundraiser banner may be hidden in the current build (the flag defaults to hidden per the 2026-07-01 change log entry, then restored per 2026-07-18). If the button is not visible, cases CONT-9, CONT-10, and CONT-11 are blocked ⛔ — note the flag state and do not file the missing button as a bug unless the flag is confirmed to be set to show.
- **Mobile admin is read-only for drive and config.** Creating or editing a drive cycle and editing config knobs is done on the web admin dashboard only — but this gap is now moot since the Android surface has been fully removed.
- **`bannerSnoozeMonths` default migration.** If testing against a database that was created before 2026-07-19, the production config row may still carry the old 6-month default. A one-time migration was included in the change log; if the value shows as 6 in a freshly seeded environment, that is a seed/migration issue to investigate but is called out here as a known transition artifact.
