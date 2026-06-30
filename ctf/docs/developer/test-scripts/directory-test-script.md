# Directory — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- directory`

| | |
|---|---|
| **Plugin** | Directory (`directory`) |
| **Visibility** | Member-facing |
| **Roles to test** | member, admin |
| **Surfaces** | web (desktop) · web (mobile-responsive, ~390px) · android |
| **Seed first** | `pnpm --dir ctf seed:directory` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-directory-feature-inventory.md` |
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

Directory lists members and the skills they hold — it does not transact. These are the
can't-ship-broken checks. Member role unless noted.

1. **List loads.** Open Directory as a signed-in member. Active, non-deleted profiles render — not a
   spinner or an error — even if you have no profile of your own. → web ☐ mobile ☐ android ☐
2. **Profile detail reads.** Open a member's profile. Name, job title, sector, and skills render. → web ☐ mobile ☐ android ☐
3. **No transact controls.** Confirm there is no "Message", "Direct Chat", "Book Session", or
   availability control anywhere on the Directory surface — those belong to Foundation. → web ☐ mobile ☐ android ☐
4. **Not public.** Signed out, the Directory plugin route does not expose member profile data; there
   is no anonymous projection route. → web ☐ mobile ☐ android ☐

---

## Member walkthrough

### DIR-1 · Browse and filter the list
**Role:** member · **Surfaces:** all · **Precondition:** seeded profiles (claimed and unclaimed).
**Steps:**
1. Open Directory.
2. Pick a sector filter chip.
3. Type a term in the search box.
**Expected:** Every active, non-deleted profile is visible to any signed-in member, including
carried-over unclaimed ones, with no "you must have a profile first" gate. A sector chip returns
people in that sector — including a profile whose sector comes only from its skills, not a stored
sector. Search filters by name/headline/bio.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### DIR-2 · Read a profile (real fields only)
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a claimed profile, then an unclaimed one.
2. Read every section.
**Expected:** Name renders as "First Last" (`first_name` required, `last_name` optional). You see job
title, sector, specializations/skills, and the bio. A community-generated profile shows its
"Community generated" badge and `@community-…` handle. No endorsements, reviews, booking, or chat
sections appear (those were removed as out-of-scope mockup elements).
**Result:** web ☐ mobile ☐ android ☐ — notes:

### DIR-3 · Pending (nominated/self-added) skills show
**Role:** member · **Surfaces:** all
**Steps:**
1. Open a profile that has a nominated or self-added skill not yet in the taxonomy.
**Expected:** The Specializations section is never empty when a skill was nominated: pending skills
render as muted, dashed-border "· pending review" chips alongside the real accent taxonomy chips.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### DIR-4 · Edit my own profile
**Role:** member · **Surfaces:** web (android deferred)
**Precondition:** you own a claimed profile.
**Steps:**
1. Open your own profile; press "Edit my profile".
2. Change the headline and one other field; leave the rest untouched and save.
3. Add a free-text skill the taxonomy does not have through "Your skill not listed? Add it".
**Expected:** The form prefills every editable field and re-sends the complete set, so an untouched
field is never blanked. The save goes through `PUT /api/directory/profile` with the CSRF header. The
free-text label persists (capped at 10 labels of at most 40 characters) and round-trips back as a
"· pending review" chip. On android this case is **blocked** — there is no member self-edit screen
yet.
**Result:** web ☐ mobile ☐ android ⛔ — notes:

### DIR-5 · Read announcements
**Role:** member · **Surfaces:** all
**Steps:**
1. Open the announcements view.
**Expected:** Active announcements render from real data, with loading, error, and empty states — not
hardcoded rows.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### DIR-6 · Share a profile and open the deep link (auth-gated)
**Role:** member · **Surfaces:** web + mobile-responsive
**Steps:**
1. Open a profile, press the "Share" control in the header, copy the link (`/apps/directory/profile/<id>`).
2. While signed in, open that link in a new tab.
3. Sign out (or open the link in a private window), then open the same link.
**Expected:** The Share popup shows the full absolute URL with Copy ("Copied!" feedback) and Open. While
signed in, the link opens the Directory with that profile's detail already open (it loads by id even if
the profile is not on the current filtered/paginated browse page). While signed out, the link redirects to
the directory landing `/apps/directory` — no profile data is shown. A bad/inactive id shows the browse
view, not the detail (the fetch 404s and is ignored).
**Result:** web ☐ mobile ☐ android ⛔ — notes:

---

## Admin walkthrough

### DIR-A1 · Admin profile list, create, edit
**Role:** admin · **Surfaces:** web (`/admin/directory`) · android (Directory Admin)
**Steps:**
1. Open the dedicated admin page; confirm a non-admin is redirected away.
2. List every profile, filter All / Claimed / Unclaimed.
3. Create a profile, then edit one.
**Expected:** Server-side authorization gates the page and the admin routes (presentation hiding is
not authorization). The list, create, and edit flows work. Each admin mutation sends the CSRF header
and records an allow/deny audit line.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### DIR-A2 · Attach an unclaimed profile (two places)
**Role:** admin · **Surfaces:** web · android
**Steps:**
1. From the profile detail, use the inline admin-only "Attach to account" control on an unclaimed
   profile.
2. From `/admin/directory`, assign an unclaimed profile to a user id.
3. Try to attach a profile that another member already claimed.
**Expected:** Both the inline control and the dedicated page assign an unclaimed profile. After
attach, the profile reads as claimed and the inline section stops rendering. Reassigning a profile
that is already claimed by another member is blocked (a `409` / claimed-profile guard, recorded as a
deny event) — an admin cannot silently overwrite another member's claim.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### DIR-A3 · Unclaimed-only delete
**Role:** admin · **Surfaces:** web · android
**Steps:**
1. Delete an unclaimed profile.
2. Try to delete a claimed profile.
**Expected:** Deleting an unclaimed profile works. Deleting a claimed profile is denied
(unclaimed-only delete is a hard server-side guard). The delete (and its `not_found` deny) records an
audit line; a CSRF-missing delete is rejected.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### DIR-A4 · Announcement create / update / deactivate
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Create an announcement, update it, then deactivate it.
**Expected:** All three persist and reflect on the member announcements view. Each is admin-gated,
CSRF-guarded, and records an allow/deny audit line.
**Result:** web ☐ mobile ☐ android ☐ — notes:

### DIR-A5 · Admin skills compatibility read (read-only)
**Role:** admin · **Surfaces:** web (admin surface)
**Steps:**
1. Open the admin skills compatibility / selector governance view.
**Expected:** It returns the full shared taxonomy (sectors, job titles, skills) plus a compatibility
summary with the count of each. It is read-only and never mutates the taxonomy.
**Result:** web ☐ mobile ☐ android ☐ — notes:

---

## Parity check (web ↔ android)

For DIR-1, DIR-2, and DIR-A1 to DIR-A3, the android app and the mobile-responsive web layout must
behave the same: same list/filter result, same profile fields, same admin list/attach/delete outcome
and the same deny taxonomy. Known exception: member self-edit (DIR-4) is web-only — android has no
self-edit screen yet, so that is a known gap, not drift.

**Result:** matches ☐ — drift notes:

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section at authoring time. If you hit one
of these, it is already tracked, not a new bug:

- How admin skills compatibility should behave when a shared skill is deleted out from under historical
  profile data is informally decided, not yet codified.
- Announcement route ownership is enforced by the plugin policy gate, not yet written up as separate
  module documentation.
- Member self-edit (and the "skill not listed" free-text add) is web-only; the android directory has no
  member self-edit screen yet.
