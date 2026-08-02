# LevelUp — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Generated from the LevelUp feature inventory and declared contracts; this is the runnable hand-test checklist for the `level-up` plugin. Regenerate with:
> `pnpm --dir ctf test-script:generate -- level-up`

| Field | Value |
|---|---|
| **Plugin** | LevelUp (`level-up`) |
| **Visibility** | Member |
| **Roles to test** | member, admin (trainer role tested via admin walkthrough) |
| **Surfaces** | web (`/apps/level-up`, `/admin/level-up`) · android (LevelUp screen, Admin LevelUp screen) |
| **Seed first** | `pnpm --dir ctf seed:level-up` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-level-up-feature-inventory.md` |
| **Generated** | 2026-07-20 (commit eca128e5) |

---

> Status spelling: since 2026-07-31 every stored status reads `canceled` (US spelling); if a step shows the British form anywhere, that is a bug.

## How to run this

- Mark each surface checkbox as you go: ✅ pass · ❌ fail · ⛔ blocked
- A ❌ on any checkbox becomes a row in the Bug Reporting plugin — note the case ID, surface, and what you actually saw
- Run **Core smoke** at the start of every test session before anything else

---

## Core smoke (every session)

**Seed before starting:** `pnpm --dir ctf seed:level-up`

1. Sign in as the seed **member** (trainee 1). Open the LevelUp app. The cohort browse screen loads without error and shows at least one cohort card.
   web ☐

2. Sign in as the seed **admin**. Open `/admin/level-up`. The admin panel loads and shows KPI cards and a cohort overview table.
   web ☐

3. Sign in as the seed **member** (trainee 1). Open the Wallet tab. The balance shown is **500 ServiceCredits** (the seeded starting balance).
   web ☐

4. Sign out. Open the LevelUp public/marketing page (`/apps/level-up` unauthenticated). The page loads and does **not** display a cohort enroll button or any balance figure.
   web ☐

---

## Member walkthrough

### LU-1 — Cohort browse and filters

**Role:** member · **Surfaces:** web, android
**Precondition:** Signed in as seed trainee 1. Seed cohort is visible.

**Steps:**
1. Open the LevelUp app.
2. Note how many cohort cards are shown with no filter applied.
3. Apply the `track` filter that matches the seed cohort's track (check seed script for the value).
4. Apply the `status` filter set to `open`.
5. Clear all filters.

**Expected:**
- Without filters, at least the seed cohort card appears.
- Filtering by matching track narrows the list to include the seed cohort; filtering by a track that matches nothing shows an empty state (no error).
- Filtering by `status: open` shows the seed cohort (seeded as open).
- Clearing filters restores the original count.
- No network error banners appear at any step.

Result: web ☐

---

### LU-2 — Cohort detail view

**Role:** member · **Surfaces:** web, android
**Precondition:** Signed in as seed trainee 1. Seed cohort visible in browse.

**Steps:**
1. Tap or click the seed cohort card.
2. Inspect the detail view.

**Expected:**
- The detail view shows the cohort title, track, and at least the two seeded milestones.
- A deposit or enrollment affordance is visible (the seed cohort requires 300 credits).
- No fields labeled `trainerName`, `tags`, or `milestoneCount` appear with placeholder/mock data; if they are absent entirely that is correct.

Result: web ☐

---

### LU-3 — Enrollment with deposit and escrow

**Role:** member · **Surfaces:** web, android
**Precondition:** Signed in as seed trainee 1 (500 SC balance). Seed cohort is open with required deposit 300. Trainee 1 is **not** yet enrolled.

**Steps:**
1. Open the seed cohort detail.
2. Initiate enrollment.
3. Confirm the deposit of 300 credits when prompted.
4. Check the wallet balance after the enrollment completes.

**Expected:**
- Enrollment succeeds; a confirmation is shown (enrollment ID or success message).
- Wallet balance decreases by 300 (now shows 200 SC spendable) and the LevelUp escrow total reflects 300 held.
- The cohort card or dashboard shows the trainee as enrolled.

Result: web ☐

---

### LU-3b — Enrollment on a free (0 SC) cohort

**Role:** member · **Surfaces:** web
**Precondition:** Signed in as a member. An **open, free** cohort is visible — one whose card shows **Cost 0 SC** (e.g. an auto-created cohort: `allow_no_deposit = true`, `required_credits = 0`). Member is not yet enrolled in it.

**Steps:**
1. On the cohort browse screen, tap **Enroll** on the 0 SC cohort.

**Expected:**
- Enrollment succeeds — the button flips to "✓ Enrolled" and **no** "Invalid LevelUp payload." error banner appears.
- Wallet balance is unchanged and no escrow is held (a free cohort deposits nothing).
- The Enrolled stat count increases by one.

Result: web ☐

---

### LU-4 — Enrollment blocked for trainer-only account

**Role:** trainer · **Surfaces:** web
**Precondition:** Signed in as the seed trainer account. Seed cohort is open.

**Steps:**
1. Open the seed cohort detail.
2. Attempt to initiate enrollment.

**Expected:**
- Enrollment is blocked. The UI either hides the enroll button or returns an error after attempting it.
- The trainer is not enrolled in the cohort.

Result: web ☐

---

### LU-5 — Enrollment idempotency (duplicate attempt)

**Role:** member · **Surfaces:** web
**Precondition:** Signed in as seed trainee 1, already enrolled in the seed cohort (complete LU-3 first).

**Steps:**
1. Attempt to enroll in the same cohort a second time using the same idempotency key (re-submit the enrollment form immediately or replay the request with the same key).

**Expected:**
- The second attempt does not create a second enrollment or deduct credits a second time.
- The response is consistent (returns the existing enrollment ID or a "already enrolled" notice).

Result: web ☐

---

### LU-6 — Dashboard wallet view

**Role:** member · **Surfaces:** web, android
**Precondition:** Signed in as seed trainee 1, enrolled in seed cohort (LU-3 done). Wallet tab open.

**Steps:**
1. Open the Wallet tab/section.
2. Inspect the balance overview cards.
3. Inspect the transaction history list.
4. Switch through the All / Earned / Escrow filter tabs.

**Expected:**
- Balance overview shows: current spendable balance, total earned through LevelUp, and escrow held.
- Transaction history includes the enrollment deposit entry (grant or escrow hold visible).
- Escrow filter tab shows the 300 SC held for the seed cohort enrollment.
- No "Spend", "Transfer", or "Send credits" button appears anywhere on this screen — the wallet is read-only.
- No "Total Spent" or "running balance per row" columns appear (known real-data deviation; absence is correct).

Result: web ☐

---

### LU-7 — Achievements — earned and locked buckets

**Role:** member · **Surfaces:** web, android
**Precondition:** Signed in as seed trainee 1 (has "First Milestone" badge earned). Achievements tab open.

**Steps:**
1. Open the Achievements tab/section.
2. Inspect the Earned bucket.
3. Inspect the Locked bucket.

**Expected:**
- "First Milestone" badge appears in the **Earned** bucket with its name and icon visible.
- "Cohort Graduate" and "Peer Mentor" badges appear in the **Locked** bucket.
- Stats row shows at least 1 earned badge and 3 total badge definitions.
- There is no "buy badge" or "spend credits" affordance anywhere on the screen.
- No "In Progress" bucket with progress fractions appears (not backed; absence is correct).

Result: web ☐

---

### LU-8 — Achievements — unearned user sees all locked

**Role:** member · **Surfaces:** web, android
**Precondition:** Signed in as seed trainee 2 (no earned badges).

**Steps:**
1. Open the Achievements tab/section.

**Expected:**
- Earned bucket is empty or shows a meaningful empty state (no badges earned yet).
- All 3 seeded badge definitions appear in the Locked bucket.

Result: web ☐

---

### LU-9 — Trainers directory browse

**Role:** member · **Surfaces:** web, android
**Precondition:** Signed in as seed trainee 1.

**Steps:**
1. Open the Trainers tab/section.
2. Inspect the trainer cards shown.
3. On web, check the stats row at the top.
4. Apply a `track` filter for `Tech`.

**Expected:**
- The seed trainer profile appears with display name, headline, bio, and tracks (`Tech`, `Finance`).
- Stats row (web) shows trainer count, tracks covered, and active-cohort count.
- Filtering by `Tech` keeps the seed trainer visible.
- Filtering by a track with no trainers shows an empty state.
- No rating, handle, learners count, or SC-released figure appears (not backed; absence is correct).

Result: web ☐

---

### LU-10 — Dispute open flow

**Role:** member · **Surfaces:** web
**Precondition:** Signed in as seed trainee 1, enrolled in seed cohort (LU-3 done).

**Steps:**
1. Navigate to the dispute open flow (from the enrollment or milestone view).
2. Fill in a title and description.
3. Submit the dispute.

**Expected:**
- Dispute is created; a dispute ID or success message is returned.
- The form accepts optional attachment metadata without error (entering a URL in an attachment field should not cause a failure; not entering one should also be fine).

Result: web ☐

---

### LU-10b — Dispute open blocked on an enrollment you are not party to

**Role:** member · **Surfaces:** web (API)
**Precondition:** Signed in as seed trainee 2. Have trainee 1's seed-cohort `enrollmentId` (from LU-3); trainee 2 is not enrolled in and not the trainer of that cohort.

**Steps:**
1. Call `POST /api/level-up/disputes` with trainee 1's `enrollmentId`, a title, a description, and an idempotency key (include the `x-ctf-csrf: 1` header).

**Expected:**
- The request is rejected with **403** (`level_up_forbidden`) — trainee 2 is neither the learner nor the assigned trainer on that enrollment.
- No dispute row is created, and trainee 1's milestone validations are unchanged (none flipped to `disputed`).
- The same open request succeeds when made by trainee 1 (the learner), the assigned trainer, or an admin.

Result: web ☐

---

### LU-11 — Public shell copy accuracy (unauthenticated)

**Role:** unauthenticated · **Surfaces:** web, android
**Precondition:** Signed out.

**Steps:**
1. Open the LevelUp marketing/public page.
2. Read the subheading and any bullet points describing how credits are earned.

**Expected:**
- Copy says that **learners** earn credits via **badges and completion bonuses** (not "complete milestones to earn credits").
- Copy says **trainers** earn a credit split for validating milestones.
- There is no implication that passing a milestone mints new credits for the learner.

Result: web ☐

---

### LU-12 — Pull-to-refresh (Android) and refresh button (web)

**Role:** member · **Surfaces:** web, android
**Precondition:** Signed in as seed trainee 1. Cohort browse visible.

**Steps:**
1. **Android:** Pull down on the cohort list to trigger a refresh.
2. **Web:** Click the refresh button in the section header.

**Expected:**
- The list reloads without a full-screen loading flash (background refresh).
- Data shown after refresh is consistent with what was shown before (no errors, no blank screen).

Result: web ☐

---

### LU-13 — Self-transfer rejected

**Role:** member · **Surfaces:** web
**Precondition:** Signed in as seed trainee 1. Access to the transfers endpoint.

**Steps:**
1. Attempt `POST /api/level-up/transfers` with `recipientUserId` equal to the signed-in user's own ID, amount 10, and a valid idempotency key.

**Expected:**
- The server returns HTTP 400.
- No transfer record is created.

Result: web ☐

---

## Admin walkthrough

### LU-A1 — Admin KPI cards and cohort overview

**Role:** admin · **Surfaces:** web
**Precondition:** Signed in as seed admin. At least one cohort exists (from seed).

**Steps:**
1. Open `/admin/level-up`.
2. Inspect the KPI cards at the top.
3. Inspect the cohort overview table below.

**Expected:**
- KPI cards show enrollments, completions, and avg days to first trainer payout (values may be 0 for a fresh seed; they must not be blank or "undefined").
- Cohort overview table shows title, track, status, seats open, required deposit, trainer split, and completion bonus for the seed cohort.
- The page uses the shared dark admin design system (dark tokens, icon header with ADMIN badge).

Result: web ☐

---

### LU-A1b — Admin review queues (open disputes, pending validations)

**Role:** admin · **Surfaces:** web
**Precondition:** Signed in as seed admin. Ideally at least one open dispute (open one via LU-10) and/or one pending milestone validation exist.

**Steps:**
1. Open `/admin/level-up`.
2. Find the "Open disputes" and "Pending milestone validations" sections below the KPI cards.

**Expected:**
- "Open disputes" lists each open dispute newest first — title, description, who opened it (a resolved name or a short `member <id>` fallback), and time. With none it shows "No open disputes."
- "Pending milestone validations" lists each pending validation newest first (milestone, note if present, enrollment). With none it shows "No pending validations."
- Both are read-only here (resolving/approving happens in the existing dispute and trainer-validation flows). The admin-landing tile shows a "new to review" dot when a dispute/validation arrived since you last opened the area; opening it clears the dot.

Result: web ☐

---

### LU-A2 — Admin credit grant — confirm step and grant-only constraint

**Role:** admin · **Surfaces:** web, android
**Precondition:** Signed in as seed admin. Have seed trainee 1's user ID ready.

**Steps:**
1. Open the credit adjustment form on the admin panel.
2. Enter trainee 1's user ID, amount `100`, a reason string, and a governance ticket ID.
3. Proceed to the confirm step.
4. Read the confirm copy before submitting.
5. Submit the grant.
6. Attempt to enter `-50` or `0` in the amount field.

**Expected:**
- The confirm step shows text of the form "add 100 credits to member [trainee 1 name/ID]" — no mention of "remove".
- Submitting succeeds and returns a governance event ID or success message.
- Entering `-50` or `0`: the amount field rejects negative values and the submit button is disabled for non-positive amounts (client-side constraint).
- No "remove credits" or negative-amount path is exposed in the UI anywhere.

Result: web ☐

---

### LU-A3 — Admin credit grant requires all fields

**Role:** admin · **Surfaces:** web
**Precondition:** Signed in as seed admin.

**Steps:**
1. Open the credit grant form.
2. Submit with the governance ticket ID field left blank (all other fields valid).
3. Then submit with a valid governance ticket but user ID blank.

**Expected:**
- Both submissions are blocked before reaching the server (form validation error shown inline).
- No governance event is created.

Result: web ☐

---

### LU-A4 — Cohort proposals: refresh, ranking, approve, dismiss

**Role:** admin · **Surfaces:** web
**Precondition:** Signed in as seed admin. Workforce gap data available (seeded or present in dev DB), with more than one sector carrying a positive `workforce_share`.

**Steps:**
1. Open `/admin/level-up` and locate the "Cohort proposals from Workforce gaps" card.
2. Click **Refresh proposals** (triggers `POST /api/level-up/admin/auto-cohorts/run`).
3. Read the ranked proposal list.
4. On one proposal, choose a term of **3 months** and click **Approve & open**.
5. On another proposal, click **Dismiss**.

**Expected:**
- The refresh banner reports how many proposals were ranked / superseded / cohorts closed. If the pre-flight guard fires (no positive `workforce_share`), it shows `skipped: no_workforce_share` — not a blank screen or error.
- The list is **sector-diverse**: the top rows span different sectors rather than all coming from one sector (no single sector dominates the top of the queue).
- Approving opens a real cohort: a success banner names the occupation and end date, the proposal leaves the queue, and the cohort overview shows a new cohort with an `auto` badge (and `needs trainer` until a trainer claims it). Its end date is ~3 months out.
- Dismissing removes that proposal from the queue with no cohort created.

Result: web ☐

---

### LU-A5 — Proposal queue idempotency and supersede

**Role:** admin · **Surfaces:** web
**Precondition:** LU-A4 completed (at least one proposal approved into a cohort).

**Steps:**
1. Click **Refresh proposals** again.

**Expected:**
- The occupation you approved in LU-A4 does **not** reappear as a new proposal (it is now covered by an open cohort).
- No occupation appears twice in the queue; each row is a distinct occupation.
- If a previously pending proposal's gap has since closed below the threshold, it no longer appears (it was superseded).

Result: web ☐

---

### LU-A6 — Trainer claims a cohort opened from a proposal

**Role:** trainer (or admin acting as trainer) · **Surfaces:** web
**Precondition:** At least one cohort opened from an approved proposal has the `needsTrainer` flag set (from LU-A4). Signed in as seed trainer.

**Steps:**
1. Find the auto-created cohort with the `needs trainer` badge in the cohort list.
2. Call `POST /api/level-up/cohorts/[cohortId]/claim-trainer` for that cohort.
3. Reload the cohort list.

**Expected:**
- The request succeeds and returns the cohort ID.
- The `needs trainer` badge disappears from that cohort in the list.
- If trainee 2 was enrolled in that cohort before the claim, their enrollment's `assigned_trainer_id` is now set to the claiming trainer (check via milestone release in LU-A8).

Result: web ☐

---

### LU-A7 — Milestone validation (trainer/admin)

**Role:** admin · **Surfaces:** web
**Precondition:** Trainee 1 is enrolled in the seed cohort (LU-3 done). Signed in as seed admin.

**Steps:**
1. Call `POST /api/level-up/milestones/[milestoneId]/validate` with the seed cohort's first milestone ID, trainee 1's enrollment ID, and a unique idempotency key.

**Expected:**
- Returns a validation ID and status.
- A second identical request with the same idempotency key returns the same validation ID without creating a duplicate record.
- Note: the member LevelUp shell has **no** inline "pending validations" approve panel (the member-shell right panel was removed; enrollments now show under the Progress tab). Validation is performed via this endpoint, which is server-scoped to the cohort's trainer or an admin — a trainer must not see or act on another trainer's cohort validations.

Result: web ☐

---

### LU-A8 — Milestone release and escrow settlement

**Role:** admin · **Surfaces:** web
**Precondition:** Milestone 1 validated (LU-A7 done). Trainee 1 enrolled in seed cohort.

**Steps:**
1. Call `POST /api/level-up/milestones/[milestoneId]/release` for the validated milestone.
2. Check trainee 1's wallet balance.
3. Check the trainer's wallet (if accessible).

**Expected:**
- Release succeeds and returns a user transfer ID and trainer payout governance ID.
- Trainee 1's escrowed portion for milestone 1 (30% of 300 = 90 SC) is released back to their spendable balance.
- The trainer receives the configured split of the milestone's escrow (seeded split applies).
- The escrow total for trainee 1 decreases by the released milestone amount.

Result: web ☐

---

### LU-A9 — Dispute resolution (admin)

**Role:** admin · **Surfaces:** web
**Precondition:** A dispute exists (LU-10 done). Signed in as seed admin.

**Steps:**
1. Call `POST /api/level-up/disputes/[disputeId]/resolve` with the dispute ID from LU-10, a resolution comment, and an idempotency key.
2. If the resolution includes a credit adjustment, replay the exact same request (same idempotency key) once more.

**Expected:**
- Returns the dispute ID and `status: resolved`.
- The replay with the same idempotency key returns the same stored response and does **not** apply the credit adjustment a second time (the recipient's balance moves once, not twice).
- Attempting to resolve the same dispute a second time returns an error indicating the dispute is no longer open (not a second resolution).

Result: web ☐

---

### LU-A10 — Non-admin cannot access admin grant endpoint

**Role:** member · **Surfaces:** web
**Precondition:** Signed in as seed trainee 1.

**Steps:**
1. Attempt `POST /api/level-up/admin/adjust-credits` directly with a valid-looking body.

**Expected:**
- Server returns HTTP 401 or 403.
- No governance event is created.

Result: web ☐

---

### LU-A11 — Admin ↔ Member navigation

**Role:** admin · **Surfaces:** web
**Precondition:** Signed in as seed admin. On the `/admin/level-up` page.

**Steps:**
1. Click the "Member view" pill/button in the admin panel header.
2. Confirm you land on `/apps/level-up`.
3. Navigate back.

**Expected:**
- "Member view" pill is present in the admin header.
- Clicking it navigates to the member-facing LevelUp app without error.
- The back control returns to the admin panel (or to the previous in-app page).

Result: web ☐

---

### Account deletion and cohort escrow records

**Expected:** Deleting the account removes the member's enrollments (existing behavior).
Disbursements from cohort escrow and any disputes (with their comments) are retained — the record
of why cohort balances moved survives the account.

---

## Parity check (web ↔ android)

The following cases must produce the same data and UX outcome on both surfaces. Run them back-to-back on web and Android with the same seed account.

| Case | What must match |
|---|---|
| LU-1 | Cohort list loads; same cohorts visible; filter by `open` status works |
| LU-2 | Cohort detail shows same milestones and deposit requirement |
| LU-3 | Enrollment succeeds; balance decreases by 300; escrow reflects hold |
| LU-6 | Wallet shows same balance, escrow total, and earned history; no spend action present |
| LU-7 | "First Milestone" badge in Earned; other two in Locked; no buy affordance |
| LU-9 | Seed trainer profile visible with same headline and tracks |
| LU-11 | Public/signed-out copy accurately describes learner and trainer earning mechanics |
| LU-12 | Refresh reloads data without full-screen flash |
| LU-A2 | Grant-only form: confirm copy says "add N credits"; negative amount blocked |
| LU-A4 | "Run now" button present; result banner shows created/closed/skipped summary; `auto`/`needs trainer` badges shown |

---

## Known gaps — do not file these as bugs

- **No admin KPI endpoint on Android.** The mobile admin screen has no KPI cards. The web admin page renders KPIs via server-side `getAdminPanelData()`; no `GET /api/level-up/admin/kpis` route exists. The Android screen skipping KPIs is expected.
- **No admin-gated GET route for mobile.** The Android admin screen cannot pre-gate by role before render; it relies on the server-side gate on `POST /adjust-credits`. A dedicated admin-gated read route is deferred.
- **Dispute attachment storage is URL-metadata-only.** There is no secure file storage backend. Entering a URL in an attachment field is the only supported path; actual file upload will not work.
- **Track/badge management admin UI not built.** The design mockup `MobileLevelUpAdmin.tsx` shows a track and badge editor. No backing endpoints exist for this. The admin screen shows only cohort overview and credit grant.
- **Unbacked trainer detail fields absent.** Trainer rating, handle, per-cohort name/status, learners count, milestones validated, SC released, and recent-activity feed are not returned by `GET /api/level-up/trainers`. Their absence from the UI is correct.
- **Unbacked achievement fields absent.** Achievement emoji, rarity, and an "In Progress" bucket with progress fractions are not backed by the endpoint (earned boolean only). Their absence is correct.
- **Unbacked wallet fields absent.** "Total Spent", per-row running balance, a "Spent" filter tab, per-cohort escrow breakdown, and an "earn more" suggestion list have no data path (grant-only model). Their absence is correct.

---

## Notifications

**1.** As a trainer or admin, release a milestone's credits for a learner. Sign in as that learner, open the 🔔 notifications tab in the Commons, and confirm a "A LevelUp milestone was approved and your credits were released." item appears (unread) with an "Open" pill to LevelUp.
web ☐
