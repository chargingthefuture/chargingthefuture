# Contributions — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- contributions`

| | |
|---|---|
| **Plugin** | Contributions (`contributions`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-contributions-feature-inventory.md` |
| **Generated** | 2026-07-19 (banner dismiss snooze shortened to two months; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

Voluntary fundraiser drives; thank-you credits, never money. Member role unless noted.

1. **Drive loads.** Open `/apps/contributions` signed in. The current cycle and collective progress
   render — USD raised, comments, stars, contributor count — toward the owner-set goals. No spinner
   stuck, no error. → web ☐ mobile ☐
2. **Contributing is obvious.** Under "How would you like to help?" each of the three cards (gift
   card, Quora comment, GitHub star) shows a clear "Choose this" cue, and a one-line instruction says
   a form opens underneath. Before any card is chosen, nothing shows under the cards (no placeholder
   box). Click a card: its form opens **directly below the cards** (not at the bottom of the page),
   the card reads "Selected", and there is a working Submit. The gift-card form states the card can be
   physical or digital and that the card details go to the owner in the Signal chat (never in the
   form). Credit amounts read "10 SC" / "50 SC" with a space. → web ☐ mobile ☐
3. **No gift-card code is ever asked for.** Start a gift-card claim. There is **no** field for the
   gift-card code anywhere; the screen instead points the member to send the code to the owner over
   Signal, outside the app. → web ☐ mobile ☐
4. **No shaming, no gating.** Confirm progress is shown only as shared totals (never a personal
   bill), and that nothing in the product is locked behind contributing. → web ☐ mobile ☐
5. **Credits read as thank-you.** Anywhere credits appear, they are framed as a thank-you, not a
   purchase, and there is no path to redeem them for real money. → web ☐ mobile ☐

---

## Member walkthrough

### CON-1 · Submit a gift-card claim
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Steps:**
1. Open `/apps/contributions`, choose the gift-card path.
2. Pick a method (Amazon / Apple / Denny's), enter an amount (over 0, at most 500 USD), and your own
   Signal contact (URL or phone number).
3. Submit.
**Expected:** The claim is accepted and lands `pending`. No gift-card code field exists. The form
states the card can be physical or digital and warns to never post the code in the Commons. After
submitting, the owner-authored Signal instructions show (codes go to the owner on Signal; the owner's
Signal contact appears inline when set), plus a prominent warning that posting the code in the Commons
(the public group chat) means no ServiceCredits and the owner never receives the gift, and a "questions
→ ask in the Commons" line. There is **no** reference to a "#support channel". An amount of 0 or over
500, or a missing Signal contact, is rejected.
**Result:** web ☐ mobile ☐ — notes:

### CON-2 · Submit a Quora comment and a GitHub star (link required)
**Role:** member · **Surfaces:** all
**Steps:**
1. Choose the Quora comment path. Try to submit with the link field blank.
2. Paste a link and submit.
3. Repeat for the GitHub star path (profile link).
**Expected:** The link field is **required** (marked with a `*`). Submitting blank does nothing except
show "Please paste the link so we can find and confirm your contribution." Each form shows a help line:
if you cannot find the link, ask in the Commons (the group chat). With a link pasted, both submit and
land `pending`.
**Result:** web ☐ mobile ☐ — notes:

### CON-3 · GitHub star is creditable at most once
**Role:** member · **Surfaces:** all
**Precondition:** the member already holds a confirmed, credit-earning github_star.
**Steps:**
1. Try to submit another GitHub star claim.
**Expected:** The star path is greyed out (`githubStarAlreadyCredited` is true); a fresh submit is
rejected with a plain message. A member who only has a rejected or zero-credit star is **not** locked
out — honest retries still work.
**Result:** web ☐ mobile ☐ — notes:

### CON-4 · Claim history and statuses
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the claim history.
2. Read the status of each past claim.
**Expected:** The member sees only their own claims, each labelled pending / confirmed / rejected in
plain language. An empty history shows the empty state, not an error.
**Result:** web ☐ mobile ☐ — notes:

### CON-5 · Fundraiser banner — Contribute, dismiss, and the phone emoji reminder
**Role:** member · **Surfaces:** web (desktop) · web (mobile-responsive)
**Steps:**
1. With the banner showing in the Hub, press **Contribute**.
2. Press **Not now** to dismiss.
3. On phone width, look at the top bar (between the TSE mark and the Commons tab). On desktop, look
   at where the banner was.
**Expected:** **Contribute** opens the drive at `/apps/contributions` — the page renders (not a 404).
The banner shows a **Not now** dismiss on both layouts. After dismissing on **phone width**, the full
banner disappears and a small gift emoji (🎁) appears in the top bar between the TSE mark and the
section tabs — no leftover strip where the banner was — and it still opens the plugin when tapped
(the full banner returns on its own after the snooze lapses, in its usual place at the top of the
content area). After dismissing on **desktop**, the banner is gone until the snooze lapses (no
emoji). If the admin turns the banner feature off, neither the banner nor the emoji shows. (Android
app has no fundraiser banner.) The dismiss snooze lasts **two months** (internal; not shown to the
member) — a fresh install and the existing config row both use two.
**Result:** web ☐ mobile ☐ android n/a — notes:

### CON-6 · Refresh the drive
**Role:** member · **Surfaces:** all
**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open the drive
   and tap the refresh icon (next to the drive heading on desktop; in the title band on the
   mobile-responsive layout).
2. On android, open Contributions and pull down on the content.
3. In another session, change the data (e.g. an admin confirms one of this member's submissions),
   then refresh as above.
**Expected:** The refresh icon spins while loading (web) or the pull-to-refresh spinner shows
(android), the drive progress and history re-pull from the server, and after step 3 the change
appears without closing and reopening the app. Refreshing never clears the current screen to the
full-screen loading state.
Admins see the shared Admin pill in the member shell header, and the admin screen header shows a
"Member view" pill opening `/apps/contributions`.
**Result:** web ☐ mobile ☐ — notes:

---

## Admin walkthrough

### CON-A1 · Review queue (confirm)
**Role:** admin · **Surfaces:** web (admin surface)
**Precondition:** at least one `pending` claim (use CON-1/CON-2 first).
**Steps:**
1. Open `/admin/contributions`, filter the queue by status.
2. Confirm a gift-card claim, entering the confirmed USD amount that was redeemed.
3. Confirm a comment or star claim (the amount defaults to the configured USD-equivalent unit value).
**Expected:** Only the admin projection shows the member's Signal contact (to match a code received
over Signal). On confirm, credits = confirmed amount × `credits_per_usd`, clamped by the
per-user-per-cycle cap; a positive grant goes through the canonical service-credits mint exactly
once. A grant clamped to 0 still confirms with `credits_granted = 0`. A claim can be reviewed only
once.
**Result:** web ☐ mobile ☐ — notes:

### CON-A2 · Review queue (reject)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Reject a pending claim with a review note.
**Expected:** The claim moves to `rejected` and grants nothing. It cannot be reviewed again.
**Result:** web ☐ mobile ☐ — notes:

### CON-A3 · Duplicate star confirms with zero credits
**Role:** admin · **Surfaces:** web (admin surface)
**Precondition:** a second github_star claim from a member who already has a credited star.
**Steps:**
1. Confirm that duplicate star claim.
**Expected:** It confirms with `credits_granted = 0`, the reason is recorded in the review note, and
the mint path is never called.
**Result:** web ☐ mobile ☐ — notes:

### CON-A4 · Create and edit a cycle
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Create a fundraiser cycle (start/end window plus the three goals — USD, comments, stars).
2. Edit the cycle.
**Expected:** The cycle saves with `ends_at` after `starts_at` and non-negative goals; the current
cycle is the one whose window contains now. The member drive view reflects the goals.
**Result:** web ☐ mobile ☐ — notes:

### CON-A5 · Edit runtime config (credits-per-action)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Open settings; change "Credits per comment or star".
2. Adjust the per-cycle cap, banner on/off, and the Signal instructions copy.
**Expected:** The settings screen shows the resulting credits (the stored USD-equivalent ×
`credits_per_usd`, with a live helper showing the underlying USD value) and converts back to the
stored USD-equivalent on save, so the stored model stays the source of truth. Config knobs must save
positive values. After saving, open the member contribute screen (`/apps/contributions`): the cards
and the credits disclaimer show the **same** SC-per-comment/star and SC-per-dollar as the settings —
no hardcoded "50 SC" when the config says otherwise.
**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ android)

For CON-1, CON-3, and CON-4, the android app and the mobile-responsive web layout must behave the
same: same submit flows, the same greyed github-star path, the same inline Signal URL on
confirmation, and the same claim history. Note: the mobile admin screen mirrors the day-to-day
confirm/reject path only and shows drive and settings read-only — creating/editing a drive and the
config knobs are web-admin only (see Known gaps). Note any drift here rather than filing separate
bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit
one of these, it is already tracked, not a new bug:

- The member surfaces show the credit valuations as copy using the seeded defaults; the member
  fundraiser route does not expose the live config, so if the owner tunes those knobs the member copy
  can lag. The admin settings screen is the source of truth for the live values.
- The mobile admin screen mirrors the confirm/reject path and shows drive and settings as read-only
  summaries; creating/editing a drive and editing the config knobs is done on the web admin
  dashboard. The github-star icon uses lucide's `Star` (the brand mark was dropped in the app's
  lucide-react version).
- The confirmed seed row is display-only (no ledger event behind it); anyone reconciling seed data
  against the credits ledger should expect that one-row gap.
- `getFundraiserSnapshot` records `last_shown_at` on read; if read-path writes ever become a
  performance concern, move the write to the banner surface.
- Editing only one end of a cycle window is validated against the supplied value, not the stored
  other end; the owner is the only writer, so this is acceptable for now.
- Metrics are registered as calculation definitions; no dashboard wiring yet.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._
