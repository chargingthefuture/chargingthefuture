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
5. **Lists end.** The problem list shows a page of problems with Previous / Page N of M / Next
   underneath — nothing keeps loading as you scroll — and a problem with more than two tools shows
   two plus a "Show N more tools" control. → web ☐ mobile ☐
6. **A problem with no tools yet still shows.** A problem an admin added but that has no approved
   tool renders with its heading and a "no tools on this one yet" panel with a **Suggest a tool**
   button — it is not missing from the list. → web ☐ mobile ☐

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

### WW-7 · Lists are paged and long problems stay short
**Role:** member · **Surfaces:** all
**Precondition:** more than five active problems, and one problem with more than two approved tools
(seed, then add a few problems as an admin).
**Steps:**
1. Open `/apps/what-works` and scroll to the bottom of the list.
2. Tap **Next**, then **Previous**.
3. On a problem with more than two tools, tap **Show N more tools**, then **Show fewer**.
4. Type a word into the search box that narrows the list.
**Expected:** The list ends — five problems per page, with Previous / Page N of M / Next underneath
and no auto-loading as you scroll. Next and Previous move a page and return you to the top of the
list; Previous is disabled on page 1 and Next on the last page. A problem shows only its first two
tools until expanded, and the control names how many are hidden. Searching puts you back on page 1
and the page count matches the narrowed list.
**Result:** web ☐ mobile ☐ — notes:

### WW-8 · A newly added problem shows with no tools yet
**Role:** admin then member · **Surfaces:** all
**Steps:**
1. As an admin at `/admin/what-works`, add a new problem (emoji, title, short context). Do not add
   any tool to it.
2. Switch to the member view at `/apps/what-works` and refresh.
3. Find the new problem and tap **Suggest a tool** inside it.
**Expected:** The new problem appears in the member list straight away, under a "no tools on this
one yet" panel with a **Suggest a tool** button — it is not hidden because it has no tools. The
"N problems" chip at the top counts it. Tapping the button opens the suggest form with that problem
already picked in the dropdown. Signed out at `/plugin/what-works`, the preview does not show the
empty problem.
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

### WW-A5 · Admin lists are paged
**Role:** admin · **Surfaces:** all
**Precondition:** more than five problems, and more than five suggestions in one status.
**Steps:**
1. Open `/admin/what-works` and look at the bottom of the Suggestions list, then the Problems list.
2. Page through each with Next and Previous.
3. Switch the status filter (Pending → All).
4. Approve or delete a row on the last page.
**Expected:** Each list shows five rows per page with Previous / Page N of M / Next; the controls
are absent when there is only one page. Changing the filter returns to page 1. Acting on a row on
the last page never leaves an empty screen — the view falls back to the last page that still has
rows.
**Result:** web ☐ mobile ☐ — notes:

---

### WW-A6 · The audit log records every admin decision, refusals included (added 2026-08-28)
**Role:** admin · **Surfaces:** web (admin surface)

**Precondition:** run WW-A1 (approve and reject), WW-A2 (add a problem) and WW-A3 (delete) first, so there are real decisions to find.

**Steps:**
1. On the What Works admin screen, expand the **Audit log** panel at the bottom.
2. Read the newest entries.
3. `DELETE /api/what-works/admin/products/<a uuid that does not exist>`, then reopen the panel.
4. Edit an approved tool's link, then reopen the panel.

**Expected:**
- Step 2: entries newest first, at most 200, each naming the decision in plain words — "Added a problem", "Decided on a suggested product", "Removed a product" — with the admin's id, what it was done to, and the local date and time. A review shows its action (approve or reject) from the metadata.
- Step 3: the 404 appears marked **Refused**, reading "Because the record was not there". An action that did not happen is recorded, not dropped.
- Step 4: an "Edited a suggested product" row appears.
- **No row names who suggested anything.** Every entry identifies the product or problem and the acting admin only. This is the check that matters here: the plugin's anonymity guarantee says `suggested_by` never reaches a projection, and the audit trail must not be the exception that reintroduces it.

**Note:** the member-facing actions — reading, suggesting, endorsing — deliberately write no audit row. A row per endorsement would be volume, not accountability. Their absence here is correct, not a gap.

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
