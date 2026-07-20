# LevelUp — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- level-up`

| | |
|---|---|
| **Plugin** | LevelUp (`level-up`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:level-up` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-level-up-feature-inventory.md` |
| **Generated** | 2026-06-29 (auto-cohort creation + economic policy/milestone skeleton + trainer-assignment wiring; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

Learning cohorts with escrow-backed milestones — these are the can't-ship-broken checks. Member role
unless noted.

1. **Cohort list loads.** Open LevelUp. Cohorts render with track, status, seats, and required
   deposit — not a spinner or error. → web ☐ mobile ☐ android ☐
2. **Wallet is grant-only.** Open the Credits Wallet. Balance and earned/granted history show and
   there is **no** spend or transfer control anywhere on it. → web ☐ mobile ☐ android ☐
3. **Filters work.** Filter the cohort list by track and status; the list narrows to match. →
   web ☐ mobile ☐ android ☐
4. **Denied action is readable.** Trigger a denied action (e.g. a trainer-only account tries to
   enroll). The message is plain-language, not a raw error code. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### LVL-1 · Cohort browse and detail
**Role:** member · **Surfaces:** all · **Seed:** `seed:level-up`
**Steps:**
1. Open the cohort list and filter by `track`, `status`, and `startDate`.
2. Open a cohort's detail view.
**Expected:** Filters narrow the list. Detail shows curriculum, milestones, and an enrollment
affordance. Seeded open cohort shows required credits 300 and its milestone split (30/70).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-2 · Enrollment with escrow split
**Role:** member · **Surfaces:** all
**Precondition:** a trainee seed account with 500 ServiceCredits; an open cohort.
**Steps:**
1. Enroll in the open cohort.
2. Re-open the user dashboard.
**Expected:** Enrollment succeeds; the dashboard shows the active enrollment, the LevelUp escrow
total rises by the deposit, the wallet balance drops accordingly, and the deposit is split per
milestone. A trainer-only account is blocked from enrolling.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-3 · Credits Wallet is grant-only
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Credits Wallet.
**Expected:** Shows balance, total earned through LevelUp, escrow held, and a read-only
earned/granted history. There is no spend, send, or transfer action of any kind.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-4 · Achievements (earned vs locked)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open Achievements.
**Expected:** Badges split into honest Earned and Locked buckets with a stats row. Seeded trainee 1
shows First Milestone as earned. Badges are awarded only — there is no buy or spend control.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-5 · Trainers directory
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the Trainers directory, optionally filter by `track`.
**Expected:** Read-only trainer cards show headline, bio, tracks, and active-cohort count. The seed
trainer appears with tracks Tech and Finance. No action mutates a trainer.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-6 · Open a dispute
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a dispute on an enrollment, adding a comment and attachment metadata.
**Expected:** The dispute is created with the comment and attachment metadata recorded.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-7 · Refresh the cohort list
**Role:** member · **Surfaces:** all
**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open LevelUp
   and tap the refresh icon in the header.
2. On android, open the Browse tab and pull down on the cohort list.
3. In another session, change the data (e.g. an admin creates or closes a cohort), then refresh as
   above.
**Expected:** The refresh icon spins while loading (web) or the pull-to-refresh spinner shows
(android), cohorts and the wallet balance re-pull from the server, and after step 3 the change
appears without closing and reopening the app. Refreshing never clears the current screen to the
full-screen loading state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), and the admin screen header shows a "Member view" pill opening `/apps/level-up`.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-8 · Signed-out screen frames "who earns" honestly
**Role:** signed-out visitor · **Surfaces:** web (desktop), web (mobile-responsive)
**Steps:**
1. Open `/apps/level-up` while signed out and read the marketing copy.
**Expected:** The copy does **not** claim a learner is paid new credits for completing each
milestone. It states that learners earn ServiceCredits through **badges and completion bonuses**,
and that **trainers** earn a **credit split** for validating milestones. (This matches the code:
passing a milestone releases the learner's own escrow back to them; the trainer earns the minted
split; a learner's only new-credit paths are grant-only badges and a graduation completion bonus.)
The highlight bullets read "Free for all survivors", "Earn badges and completion bonuses", and
"Trainer-led cohorts". On android the signed-in empty state uses the same badges/completion-bonus
wording.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Trainer walkthrough

### LVL-T1 · Validate and release a milestone
**Role:** trainer · **Surfaces:** web (trainer dashboard)
**Precondition:** a cohort the trainer owns with a pending validation.
**Steps:**
1. Open the trainer dashboard and read pending validations, trainees, and the payout ledger.
2. Validate a milestone for an enrollment.
3. Release the validated milestone.
**Expected:** Validation records against the right enrollment and cohort. Release settles the
learner's escrow and pays the trainer split; both show in the payout ledger.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-T2 · Claim an auto cohort and get paid on it
**Role:** trainer · **Surfaces:** backend (API)
**Precondition:** an auto-created cohort that still shows `needs trainer`, with a deposit set
(`default_required_credits` > 0) so there is escrow to release.
**Steps:**
1. As a trainer, claim the cohort (`POST /api/level-up/cohorts/[cohortId]/claim-trainer`).
2. Have a member enroll, then validate and release a milestone for that enrollment.
3. Separately, confirm an enrollment that was made **before** the claim also pays out.
**Expected:** After the claim, new enrollments carry the trainer as `assigned_trainer_id`, and
enrollments made before the claim are backfilled with it. Releasing a milestone pays the claiming
trainer their split (it no longer silently skips the payout for want of an assigned trainer).
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### LVL-A1 · Grant credits (grant-only, confirm-gated)
**Role:** admin · **Surfaces:** web (`/admin/level-up`), android (admin screen)
**Steps:**
1. Open the admin surface. Enter a member user ID, an amount greater than zero, a reason, and a
   governance ticket ID.
2. Read the confirm step, then submit.
3. Try to enter zero or a negative amount.
**Expected:** The action is labelled "Grant"; the confirm step restates "add N credits to member X".
The grant succeeds and is written to the audit log with the member and governance ticket recorded.
There is no remove/negative path — submit is disabled for non-positive amounts.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-A2 · Admin panel KPIs and cohort overview
**Role:** admin · **Surfaces:** web (`/admin/level-up`)
**Steps:**
1. Read the KPI cards (enrollments, completions, average days to first trainer payout).
2. Read the read-only cohort overview.
**Expected:** KPI cards render real values. The cohort overview lists title, track, status, seats
open, required deposit, trainer split, and completion bonus. It is read-only.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-A3 · Resolve a dispute
**Role:** admin (or the assigned trainer) · **Surfaces:** web
**Steps:**
1. Resolve an open dispute, with an optional adjustment transfer.
2. As an unrelated trainer, attempt to resolve the same dispute.
**Expected:** Admin (or the trainer assigned to the dispute's cohort) resolves it; the optional
adjustment transfer applies. An unrelated trainer is denied with a readable message.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### LVL-A4 · Auto-cohort run from Workforce gaps
**Role:** admin · **Surfaces:** web (`/admin/level-up`), android (admin screen)
**Precondition:** Skills Taxonomy has at least one sector with a positive `workforce_share` and at
least one Foundational-level occupation whose gap is at or above the configured minimum.
**Steps:**
1. In the "Auto cohorts from Workforce gaps" panel, press **Run now**.
2. Re-read the cohort overview.
3. Press **Run now** a second time.
**Expected:** The first run reports how many cohorts were created/closed and the overview gains
open cohorts tagged `auto` and `needs trainer` (one per largest Foundational gap, up to the
concurrency and per-sector caps). The second run creates **no** duplicates for the same occupations.
If no sector carries a workforce share, the run reports it was skipped rather than creating cohorts.
Each created cohort carries the configured economic policy (deposit from `default_required_credits`,
default 0 = free to join; trainer split `default_trainer_split_percent`, default 25%; completion bonus
`default_completion_bonus_credits`, default 0) and the standard 3-milestone skeleton (40/30/30) — open
a created cohort's detail and confirm the milestones are present. On android, the same "Run now" action
and the `auto` / `needs trainer` badges on the cohort overview must behave the same (#1200).
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For LVL-1, LVL-3, LVL-4, and LVL-5, the android app and the mobile-responsive web layout must behave
the same: same cohort list, same grant-only wallet, same earned badges, same trainer directory. The
Android admin screen mirrors the cohort overview, the grant action, and (since #1200) the auto-cohort
**Run now** action plus the `auto` / `needs trainer` badges (it has no KPI cards — see Known gaps).
Note any drift here rather than filing separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at generation time. If you hit one
of these, it is already tracked, not a new bug:

- Dispute attachments store URL metadata only; there is no secure file-storage backend yet.
- No admin KPI read route exists, so the Android admin screen has no KPI cards (web renders them
  server-side).
- No admin-gated read route exists for the admin screens, so the Android admin screen cannot pre-gate
  by role before render; it relies on the server-side admin gate on the grant action.
- The track/badge management mockup has no backing endpoints, so that surface is not built (tracks are
  a free-text field and there is no badge-editing model).
