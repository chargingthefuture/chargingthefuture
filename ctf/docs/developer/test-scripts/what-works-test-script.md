# WhatWorks — Manual Test Script

> **Android: not applicable.** This feature is web-only (rule 105 / PR #1742, 2026-07-20). Test on web only: desktop and the mobile-responsive (~390px) layout. Any `android` surface tags below are retained as history but no longer apply.

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- what-works`

| | |
|---|---|
| **Plugin** | WhatWorks (`what-works`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) |
| **Seed first** | `pnpm --dir ctf seed:what-works` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-what-works-feature-inventory.md` |
| **Generated** | 2026-07-01 (updated by hand for the admin edit-tool feature; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.

---

## Core smoke (every session)

One shared survivor-verified list of tools by problem. Member role unless noted.

1. **List loads.** Open `/apps/what-works` signed in. Active problems render, each with its approved
   tools — emoji, name, a short "why it works" note, a verified count, and a purchase link. No
   spinner stuck, no error. → web ☐ mobile ☐
2. **Public teaser is identity-free.** Open `/plugin/what-works` signed out. A readable teaser slice
   shows with a sign-in gate; no survivor name appears anywhere, and the counts shown match the
   teaser slice only (not the full list). → web ☐ mobile ☐
3. **Helpful toggles.** Mark a tool **Helpful** ("this helped me"); the verified count rises by one.
   Toggle off; it drops back. → web ☐ mobile ☐
4. **Suggested tool is held for review.** Suggest a tool. It does **not** appear in the public list;
   the screen confirms it was submitted for review. → web ☐ mobile ☐

---

## Member walkthrough

### WW-1 · Browse the shared list
**Role:** member · **Surfaces:** all · **Seed:** `seed:what-works`
**Precondition:** seeded list (3 problems, 7 approved tools, 27 endorsements).
**Steps:**
1. Open `/apps/what-works`.
2. Read one problem and its tools end to end.
**Expected:** Each problem shows its emoji and title; each approved tool shows emoji, name, type,
the "why it works" note, a "N survivors verified" count, and a direct purchase link. No suggester
name is shown anywhere.
**Result:** web ☐ mobile ☐ — notes:

### WW-2 · Mark a tool Helpful and withdraw it
**Role:** member · **Surfaces:** all
**Steps:**
1. On an approved tool, tap **Helpful**.
2. Tap it again to withdraw.
**Expected:** The first tap records one endorsement and the verified count rises by one; a second
tap removes it and the count drops. The same survivor can only count once (toggling, not stacking).
**Result:** web ☐ mobile ☐ — notes:

### WW-3 · Suggest a tool
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the suggest form, pick an existing problem.
2. Add a product name, a direct purchase link (http/https), and an optional note.
3. Submit.
**Expected:** The form accepts the entry and confirms it was submitted for review. The new tool does
**not** show up in the shared list or the public teaser yet (it lands `pending`). A non-http/https
link is rejected server-side.
**Result:** web ☐ mobile ☐ — notes:

### WW-4 · Search and jump-nav
**Role:** member · **Surfaces:** all
**Steps:**
1. Type a term into the search box.
2. Use the sidebar to jump to a chosen problem.
**Expected:** Search filters tools and problems as you type (client-side). Selecting a problem in the
sidebar scrolls the list to that problem.
**Result:** web ☐ mobile ☐ — notes:

### WW-5 · Signed-out gate
**Role:** signed-out visitor · **Surfaces:** all
**Steps:**
1. Sign out and open `/plugin/what-works`.
2. Try to reach the full list or the suggest action.
**Expected:** A teaser slice shows with a sign-in/sign-up gate. The full list and the suggest action
require signing in; no survivor identity is rendered.
**Result:** web ☐ mobile ☐ — notes:

### WW-6 · Refresh the list
**Role:** member · **Surfaces:** all
**Steps:**
1. On web (desktop and the mobile-responsive layout, ideally the installed web app), open What Works
   and tap the refresh icon in the header.
2. On android, open the List tab and pull down on the list.
3. In another session, change the data (e.g. an admin approves a new tool), then refresh as above.
**Expected:** The refresh icon spins while loading (web) or the pull-to-refresh spinner shows
(android), the list and stats re-pull from the server, and after step 3 the change appears without
closing and reopening the app. Refreshing never clears the current screen to the full-screen loading
state.
The header back chevron returns to the page you came from (falling back to All Apps when opened
directly), admins see the shared Admin pill in the member shell header, and the admin screen
header shows a "Member view" pill opening `/apps/what-works`.
**Result:** web ☐ mobile ☐ — notes:

---

### Account deletion clears endorsements

**Expected:** Deleting the account removes the member's endorsements; tool endorsement counts drop
accordingly. The curated problem and tool lists themselves are unchanged.

## Admin walkthrough

### WW-A1 · Review queue (approve / reject)
**Role:** admin · **Surfaces:** web (admin surface)
**Precondition:** at least one `pending` suggestion (use WW-3 first).
**Steps:**
1. Open `/admin/what-works`.
2. Filter by status (pending / approved / rejected / all).
3. Approve one suggestion; reject another with an admin-only reason.
**Expected:** Approving moves the tool into the shared list; rejecting records the reason and keeps
it off the list. The submitter's identity is never shown to the admin — moderation is of content,
not of people. A non-admin opening `/admin/what-works` is redirected to `/apps/what-works`.
**Result:** web ☐ mobile ☐ — notes:

### WW-A2 · Curate problems
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Create a problem (emoji + title).
2. Rename it, change its emoji, and reorder it.
3. Deactivate it, then reactivate it.
**Expected:** Each change takes effect in the admin list and on the member list (active problems
only show to members in their sort order). A deactivated problem disappears from the member list and
returns when reactivated.
**Result:** web ☐ mobile ☐ — notes:

### WW-A3 · Delete cascades
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Delete a single tool.
2. Delete a problem that has tools.
**Expected:** Deleting a tool removes it and its endorsements. Deleting a problem removes that
problem and cascades to its tools and their endorsements. Both deletes use an inline two-step
confirm.
**Result:** web ☐ mobile ☐ — notes:

### WW-A4 · Edit an approved tool's details
**Role:** admin · **Surfaces:** web (admin surface)
**Precondition:** at least one `approved` tool with a non-zero verified count (approve a seeded
suggestion first, and mark it Helpful as a member so its count is > 0).
**Steps:**
1. Open `/admin/what-works` and find an approved tool.
2. Click **Edit**, change the name, the note, and the purchase link, then **Save**.
3. Reopen the member list `/apps/what-works` and find the same tool.
4. Back in the admin, click **Edit** again and paste a non-http(s) link (e.g. `ftp://x`), then Save.
**Expected:** The edit form is seeded with the tool's current values. Saving updates the tool's
name/note/link **without** unpublishing it — it stays `approved`, keeps its verified count, and the
change shows on the member list. The tool's problem, status, and verified count are unchanged, and no
submitter identity appears. The non-http(s) link is rejected server-side with an error, and the tool
keeps its previous link.
**Result:** web ☐ mobile ☐ — notes:

---

## Parity check (web ↔ android)

For WW-1, WW-2, and WW-3, the android app and the mobile-responsive web layout must behave the same:
same list contents, same Helpful toggle result, same submit-for-review outcome. A signed-out
android visitor sees the same public teaser the web shows (fetched without a token), not a 401.
Note any drift here rather than filing three separate bugs.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit
one of these, it is already tracked, not a new bug:

- The design's "First tool added 🎉" / "Add to the list" copy is rendered as the review-honest
  "Suggestion submitted" / "Submit for review" instead (the suggest flow is reviewed before it
  appears). Not a code gap.
- The admin moderation surface has no design mockup; it follows the established functional
  `/admin/{plugin}` convention.
- Endorsement abuse control beyond one-per-user dedupe (e.g. rate limiting) relies on shared
  platform defaults.
- Wiring the profile-deletion scopes into the central deletion orchestrator is a platform-level task
  tracked outside this plugin.

> _Terminology (2026-07-20): the source inventory's user-facing section is now titled **User Features** (was "Target User Features"), and its admin section **Admin Features**. Heading rename only — no test steps changed._
