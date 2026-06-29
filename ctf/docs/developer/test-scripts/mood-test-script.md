# Mood — Manual Test Script

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
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
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
   spinner or error. → web ☐ mobile ☐ android ☐
2. **Submit a mood check.** Pick a mood value (1–5), submit. The submission is accepted and the screen
   moves to the cooldown state. → web ☐ mobile ☐ android ☐
3. **Cooldown blocks a second check.** Right after submitting, try again. The 7-day cooldown blocks it
   with a readable message, not a raw error. → web ☐ mobile ☐ android ☐
4. **Aggregate stays anonymous.** Open the community pulse / trends. It shows only an aggregate chart —
   no individual check-in, note, or identifier is ever shown. → web ☐ mobile ☐ android ☐

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
**Result:** web ☐ mobile ☐ android ☐ — notes:

### MD-2 · Submit a check-in
**Role:** member · **Surfaces:** all
**Steps:**
1. Pick a mood value (1–5) and optionally add a note.
2. Submit.
**Expected:** The submission is accepted. The check-in is stored pseudonymously (no `user_id` on the
row). Member-facing copy describes the check-in as private and pseudonymous — never shown to anyone,
only anonymous aggregate trends are displayed.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### MD-3 · Out-of-range value is refused
**Role:** member · **Surfaces:** all
**Steps:**
1. Attempt a submission with a mood value outside 1–5 (e.g. via a crafted request).
**Expected:** The boundary is enforced — the request is refused with a readable invalid-payload message
(400), not a server error (500).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### MD-4 · Seven-day cooldown
**Role:** member · **Surfaces:** all
**Precondition:** the member submitted a check-in within the last 7 days.
**Steps:**
1. Re-open Mood and try to submit again.
**Expected:** The 7-day cooldown blocks the second check with a readable cooldown message. The cooldown
is keyed on the pseudonym, so a second device for the same member shares the one cooldown — it cannot
be bypassed by switching devices.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### MD-5 · Anonymous community pulse
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the community pulse / trends tab.
**Expected:** It shows a 7-day average-mood chart plus check-in counts, computed in aggregate. No
per-user row, note, or identifier appears. When fewer than the minimum sample (5 check-ins in the
window) exist, the surface withholds data and shows the not-enough-data state with a zeroed series.
**Result:** web ☐ mobile ☐ android ☐ — notes:

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
