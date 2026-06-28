# SkillsHunt — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- skills-hunt`

| | |
|---|---|
| **Plugin** | SkillsHunt (`skills-hunt`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:skills-hunt` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-skills-hunt-feature-inventory.md` |
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

SkillsHunt moves treasury credits on accept and seeds Directory profiles — these are the
can't-ship-broken checks. Member (scout) role unless noted.

1. **Rounds list loads.** Open SkillsHunt. Active / upcoming / closed rounds render, not a spinner
   or error. → web ☐ mobile ☐ android ☐
2. **Submission validates.** Submit a nomination with a bad value (e.g. a name with disallowed
   characters, or a non-Quora URL). It is rejected with a plain-language message, not a raw error. → web ☐ mobile ☐ android ☐
3. **Accept pays once.** As admin, accept a nomination on a round that configures a reward. The scout
   is paid the configured amount once; re-reviewing the same submission does not pay again. → web ☐ mobile ☐ android ☐
4. **No member-to-member transfer.** Confirm there is no "send credits to another member" control in
   SkillsHunt — the only credit movement is the treasury reward on an accepted nomination. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### SH-1 · Round discovery and detail
**Role:** member · **Surfaces:** all · **Seed:** `seed:skills-hunt`
**Steps:**
1. Open SkillsHunt and view the list of rounds.
2. Open one round and read its rules, scoring config, and dates.
**Expected:** Active, upcoming, and closed rounds are listed and clearly labelled. The round detail
shows its scoring config, rules, and window. Submitting is only offered during an active window.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SH-2 · Submit a nomination (valid)
**Role:** member · **Surfaces:** all
**Precondition:** an active round; the member has a confirmed @handle.
**Steps:**
1. Open the Scout tab and fill the nomination form: full name (2–100 letters/digits/spaces), bio
   (≤ 280), a Quora profile URL, taxonomy-selected skills, and optional proposed (free-text) skills.
2. Submit.
**Expected:** The submission is accepted. The URL is normalized and pattern-checked; a confirmed
@handle is required to submit. Skills + proposed skills are capped (≤ 10 total).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SH-3 · Quality and anti-spam guards
**Role:** member · **Surfaces:** all
**Steps:**
1. Try to submit script/HTML-like text in a free-text field.
2. Submit the same normalized URL + skills twice in one round.
3. Submit repeatedly past the rolling weekly cap.
**Expected:** Script/HTML payloads are rejected; the duplicate is blocked; the rolling submission cap
stops further submissions. Each denial is a plain message, not a raw error. (A URL that is
unambiguously dead — 404/410 — is auto-rejected.)
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SH-4 · Leaderboard (individual and team)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the leaderboard in individual mode, then team mode.
2. After a review outcome lands, re-open it.
**Expected:** Individual mode ranks by accepted points; team mode aggregates by claimed profession.
Rank, accepted count, and rare-skill bonus impact are shown. The board refreshes after review
outcomes (polled). If the viewer is outside the top 100, their own rank still shows.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SH-5 · Achievements and notifications
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the achievements view and the notifications list.
2. Mark a notification as read.
**Expected:** Named badges (First Finder, Diversity Champion, Rare Talent Scout, Quality Contributor,
Leaderboard Champion) show when earned. Notifications fire on status transitions and awards; marking
one read updates it and only affects the member's own notifications.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SH-6 · Feature reward card
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the surface where the feature reward card is pinned (the Directory public page) and read it.
**Expected:** The configurable reward card renders with its "Submit a community profile" call to
action, opening the SkillsHunt Scout tab. If no card is configured, a sensible default card shows.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### SH-A1 · Round management (role-gated)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. As admin, create a round (name, window, status, scoring config, and reward config —
   reward-per-accept and the per-scout round cap).
2. Edit the round; change only one field and save.
3. Attempt the same as a non-admin.
**Expected:** Create and edit succeed; an edit is a true partial update (omitted fields keep their
stored values, not reset to defaults). The save sends the CSRF header. A non-admin is denied with a
readable "admins only" message.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SH-A2 · Review and scoring (accept / reject / flag) + reward
**Role:** admin · **Surfaces:** web (admin surface), android (moderation screen)
**Precondition:** a round with `reward-per-accept` set; a pending submission.
**Steps:**
1. Filter submissions by status; accept one, reject one, flag one — each behind a confirm gesture.
2. Note the scoring breakdown and the Reward column / reward summary.
3. Re-review the accepted submission.
**Expected:** Each action records the reviewer and notes and applies the scoring breakdown (match,
first-match, stack, rare-skill, quality). On accept the scout is minted the configured reward once —
bounded by the per-scout round cap and the treasury budget; a re-review does not double-pay. A
reject adds a participation point, not a reward. No fiat equivalent is shown for the reward.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SH-A3 · Directory seeding governance
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Generate an unclaimed Directory profile from an accepted submission.
2. Open that generated Directory profile.
**Expected:** The generated profile is stamped community-generated, carries "Nominated by @handle"
attribution and a reserved `community-<hex>` handle, and stays unclaimed until a verified owner
claims it. SkillsHunt does not bypass Directory policy.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### SH-A4 · Missions, reports, and reward-card editor
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. In the admin tabs, create/list/archive a mission.
2. In Reports, dismiss / archive / remove a community report.
3. Edit and save the Directory reward card.
**Expected:** Each tab acts on its real endpoint with the CSRF header. Reports transition only
(open → dismissed / archived / removed), never delete. The reward-card edit persists and shows on the
Directory page (SH-6).
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For SH-1, SH-2, SH-4, and the moderation accept/reject/flag (SH-A2), the android app and the
mobile-responsive web layout must behave the same: same rounds, same submission validation, same
leaderboard, same review outcome. The reward display and round/mission/report/reward-card admin
sections are web-only for now (android moderation parity is delivered; the rest is tracked) — note
any drift on the shared surfaces rather than filing separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- The admin pre-approval submitter pathway is intentionally disabled in the current scope (no UI
  affordance).
- URL liveness verification is best-effort; a stronger service-level guarantee has not been finalized.
- Team-leaderboard aggregation by profession depends on Skills Taxonomy sign-off on the grouping
  rules.
