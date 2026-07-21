# Mood — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- mood`

| | |
|---|---|
| **Plugin** | Mood (`mood`) |
| **Visibility** | Member-facing |
| **Roles to test** | member |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-mood-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

This is a personal-wellbeing surface. Individual check-ins are private — they are stored under a
server-controlled pseudonym, never shown to anyone, and only an anonymous aggregate is displayed. Do
not test for, or expect, any screen that surfaces one member's check-in to another person.

---

## Core smoke (every session)

Member role unless noted.

1. **Check-in screen loads.** Open Mood. The check-in form (mood picker + optional note) renders, not a
   spinner or error. → web ☐ mobile ☐
2. **Submit a mood check.** Pick a mood value (1–5), submit. The submission is accepted and the screen
   moves to the cooldown state. → web ☐ mobile ☐
3. **Cooldown blocks a second check.** Right after submitting, try again. The 7-day cooldown blocks it
   with a readable message, not a raw error. → web ☐ mobile ☐
4. **Aggregate stays anonymous.** Open the community pulse / trends. It shows only an aggregate chart —
   no individual check-in, note, or identifier is ever shown. → web ☐ mobile ☐

---

## Member walkthrough

### MD-1 · Eligibility gate
**Role:** member · **Surfaces:** all · **Seed:** `seed:demo`
**Precondition:** a member with no recent check-in.
**Steps:**
1. Open Mood.
2. Read the check-in form state.
**Expected:** A member with no prior record (or a parse failure) is treated as eligible, and the form is
available. The eligibility check is keyed on the server-controlled pseudonym, so it reflects this
member's own cooldown.
**Result:** web ☐ mobile ☐ — notes:

### MD-2 · Submit a check-in
**Role:** member · **Surfaces:** all
**Steps:**
1. Pick a mood value (1–5) and optionally add a note.
2. Submit.
**Expected:** The submission is accepted. The check-in is stored pseudonymously (no `user_id` on the
row). Member-facing copy describes the check-in as private and pseudonymous — never shown to anyone,
only anonymous aggregate trends are displayed.
**Result:** web ☐ mobile ☐ — notes:

### MD-3 · Out-of-range value is refused
**Role:** member · **Surfaces:** all
**Steps:**
1. Attempt a submission with a mood value outside 1–5 (e.g. via a crafted request).
**Expected:** The boundary is enforced — the request is refused with a readable invalid-payload message
(400), not a server error (500).
**Result:** web ☐ mobile ☐ — notes:

### MD-4 · Seven-day cooldown
**Role:** member · **Surfaces:** all
**Precondition:** the member submitted a check-in within the last 7 days.
**Steps:**
1. Re-open Mood and try to submit again.
**Expected:** The 7-day cooldown blocks the second check with a readable cooldown message. The cooldown
is keyed on the pseudonym, so a second device for the same member shares the one cooldown — it cannot
be bypassed by switching devices.
**Result:** web ☐ mobile ☐ — notes:

### MD-5 · Anonymous community pulse
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the community pulse / trends tab.
**Expected:** It shows a 7-day average-mood chart plus check-in counts, computed in aggregate. No
per-user row, note, or identifier appears. When fewer than the minimum sample (5 check-ins in the
window) exist, the surface withholds data and shows the not-enough-data state with a zeroed series.
**Result:** web ☐ mobile ☐ — notes:

### MD-6 · "Talk to someone" support links (no crisis hotlines)
**Role:** member · **Surfaces:** all
**Steps:**
1. On web, open Mood and find the resources rail ("Talk to someone"). On android, open Mood and tap
   the **Support** bottom-nav tab.
2. Tap **Find someone in the Directory**, then go back and tap **Reach out through Foundation**.
**Expected:** The surface shows the **Talk to someone** heading and two in-app links — **Find someone
in the Directory** and **Reach out through Foundation** — that route a struggling member to a
community member with mental-health expertise. On web they link to `/apps/directory` and
`/apps/foundation`; on android they navigate the app shell to the Directory and Foundation screens.
There are **no** external crisis-hotline numbers (National Hotline / Crisis Text Line / RAINN are
removed). The Directory link's description says "Search community members by specialty" — it does
**not** call members "verified" (Directory profiles have no verified state, so that word would be an
unverifiable claim). The Privacy First card still appears (below the links on web; on the Private tab
on android). On android, if the Mood screen is ever shown without navigation wired, the link cards are
non-interactive rather than crashing.
**Result:** web ☐ mobile ☐ — notes:

---

### MD-7 · Refresh eligibility (header button / pull-to-refresh)
**Role:** member · **Surfaces:** all
**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open Mood and
   tap the refresh icon in the header.
2. On android, open Mood and pull down on the check-in screen.
3. In another session, submit a check-in for the same client, then refresh as above.
**Expected:** On web the refresh icon spins while loading; on android the pull-to-refresh spinner
shows. Eligibility re-pulls and the cooldown state from the other session appears without closing and
reopening the app. Refreshing never clears the current screen to the full-screen loading state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly).
**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ android)

For MD-1, MD-2, MD-4, and MD-5, the android app and the mobile-responsive web layout must behave the
same: same eligibility gate, same submission outcome, same 7-day cooldown and 1–5 validation, same
anonymous aggregate. Note any drift here rather than filing separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- Multiple devices (multiple `clientId`s) for one member are allowed by the schema; the cooldown is
  one-per-member via the pseudonym, so devices share one cooldown. There is no screen to reconcile or
  merge mood history across devices.
