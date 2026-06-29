# Bug Reporting — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- bug-reporting`

| | |
|---|---|
| **Plugin** | Bug Reporting (`bug-reporting`) |
| **Visibility** | Internal triage — members can submit; the review queue is admin-only |
| **Roles to test** | member (submit), admin (triage) |
| **Surfaces** | submit: web (desktop) · web (mobile-responsive, ~390px) · android — triage: web (internal admin surface) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-bug-reporting-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in this very plugin. Put the bug link in the notes line so the next run knows
  it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.
- The submit form is reached from the global Help control (the "?" item in the desktop icon rail
  and the phone-width top bar) — it is a modal, not a plugin grid tile and not a page.

---

## Core smoke (every session)

Member-reporting + private-triage plugin — these are the can't-ship-broken checks.

1. **Report submits.** Open the Help control, choose "Report a problem", write one line, submit.
   You get a calm confirmation, not a raw error. → web ☐ mobile ☐ android ☐
2. **Raw text stays private.** Submitting stores the report in the app database; no raw text is
   sent to GitHub at submit time (the synchronous step does no external calls). → web ☐ mobile ☐ android ☐
3. **Flagged report holds.** A report containing an email/phone (or abusive language) is born
   `held_for_review` and does not auto-publish. → web ☐ mobile ☐ android ☐
4. **Admin queue is admin-only.** `/admin/bug-reports` (and `GET /api/bug-reports/admin`) loads for
   an admin and is denied for a plain member. → web ☐

---

## Member walkthrough

### BUG-1 · Submit a problem report
**Role:** member · **Surfaces:** web (desktop), web (mobile-responsive), android · **Seed:** `seed:demo`
**Precondition:** signed in (a not-yet-verified member may also submit — `any_authenticated` tier).
**Steps:**
1. Open the global Help control and choose "Report a problem".
2. Fill "what went wrong" (required); leave "what you were trying to do" empty.
3. Submit.
**Expected:** The form posts to `POST /api/bug-reports` with the `x-ctf-csrf: 1` header and
same-origin cookies. Page URL and (on `/apps/<slug>`) the plugin slug are attached automatically;
no technical detail is asked of the user. A 201 shows the calm success state; the report row is
stored privately as `new` (or `held_for_review` if flagged). On phone width the modal renders as a
bottom sheet; android mirrors the same five states.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### BUG-2 · Required field and the five modal states
**Role:** member · **Surfaces:** web (desktop), web (mobile-responsive), android
**Steps:**
1. Open the report modal and try to submit with the required field empty.
2. Submit a valid report and watch the transition.
3. Force an error path (e.g. offline) and confirm the typed text is preserved.
**Expected:** The modal carries all five states — form, submitting, success, error (keeping the
typed text), rate-limited. The required field blocks an empty submit. Status codes map: 201 →
success, 429 → rate-limited, any other non-201 → error.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### BUG-3 · Rate limit and length caps
**Role:** member · **Surfaces:** web (desktop), web (mobile-responsive), android
**Steps:**
1. Submit reports rapidly past the per-user limit (5 reports / 10 minutes).
2. Try to paste an over-long message.
**Expected:** The sixth report inside the window is rate-limited (429) and the modal shows the
rate-limited state. Over-long input is length-capped. These are flood/abuse controls, not bugs.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Admin walkthrough

### BUG-A1 · Review queue — held first, redacted only
**Role:** admin · **Surfaces:** web (internal surface)
**Precondition:** at least one `held_for_review` report and one `new` report exist.
**Steps:**
1. Open `/admin/bug-reports`.
2. Read a held report's text and its risk flags / level.
3. Attempt to reach the page as a plain member.
**Expected:** The page lists reports with held ones first and shows **redacted** message/context
only — the raw user text never leaves the database (rule 129). Status, risk flags/level, page URL,
plugin slug, and any triage-repo issue link are shown. A non-admin is denied
(`requireBugReportAdminAccess`).
**Result:** web ☐ — notes:

### BUG-A2 · Release or reject a held report
**Role:** admin · **Surfaces:** web (internal surface)
**Precondition:** a `held_for_review` report.
**Steps:**
1. On a held report, choose **Release**.
2. On another held report, choose **Reject**.
3. Try to resolve a report that is not in a resolvable state.
**Expected:** Release sends the report back to `new` so the create-issues job publishes the
**redacted** copy to the private triage repo; reject drops it so it never publishes. Both require
the `x-ctf-csrf: 1` header and a same-origin check. A non-resolvable state returns 409; a non-UUID
id or unknown action returns 400. Returns `{ ok, id, status }`.
**Result:** web ☐ — notes:

---

## Parity check (web ↔ android)

For BUG-1, BUG-2, and BUG-3, the android app and the mobile-responsive web layout must behave the
same: same five modal states, same endpoint and CSRF wiring, same rate-limited and error handling.
Note any drift here rather than filing three separate bugs. (The admin triage queue is web-only —
no android surface to compare.)

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps & Known Technical Debt" section. If you hit one of these, it is
already tracked, not a new bug:

- The triage agent and the human-gated build agent workflows are built but manual-dispatch only
  until the triage repo's labels exist and the required tokens/secrets are available.
- The build workflow uses the external Claude Code GitHub Action; its version is to be pinned and
  its inputs confirmed on the first run.
- Redaction is deterministic and conservative; a model-based restatement for higher-quality issue
  text can be layered on later.
