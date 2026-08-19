# Quora Live Account Census — Feature Inventory

## Scope & Boundary

An admin-only tool for recording fixed-date observational snapshots of Quora accounts that are
still standing, coded by what each account writes about and what it says.

Not a plugin. No registry entry, no member navigation, no apps-grid tile, no mobile surface, and —
unlike the deletion survey — no public page either. One admin surface, and nothing else.

In scope: starting a run, coding accounts into it, the stance breakdown, closing a run, CSV export.
Out of scope: gathering the observations. A person opens Quora and looks; this records what they
found. Nothing here scrapes, automates, or contacts anyone.

## Intent

The Quora account deletion survey (`ctf-quora-deletion-survey-feature-inventory.md`) records what
was **removed**. That can never establish what **remains**, and the blog's claim about what is
still standing on Quora is a claim about what remains. This is the instrument for that half.

The method is deliberate and the whole value rests on it:

- A run names one observation date. Coding may take days; the census is only ever citable as "what
  was live on this date".
- A run names what was searched and how accounts were picked from it, both required. Without both,
  the numbers are unreproducible and indistinguishable from picking the accounts that suited the
  argument.
- The stance list includes categories that would **refute** the claim under test — practical help,
  organizing — alongside the ones that would support it. A coding scheme containing only the
  expected answers produces the expected answer and proves nothing. Those two options must never be
  removed to simplify the list.
- `unclear` is the honest default and the stored default. A coder who cannot tell records that; a
  run with a large unclear share is telling you the reading was too thin, not that the accounts
  were ambiguous.
- A closed run takes no new entries, so a number that has been quoted cannot change under the
  quotation.

What the census cannot do: speak for Quora as a whole. It reports what one run looked at. Every
percentage in the admin screen is a share of the live accounts in that run, and is labeled as such.

## User Features

None. There is no member-facing surface.

## Admin Features

At `/admin/quora-live-census`, an admin can:

- Start a run by giving the observation date, what was searched, how accounts were picked, and
  optional notes. The first three are required.
- See every run newest observation first, each showing how many accounts were coded and how many of
  those were still live.
- Open a run and code accounts into it: handle, profile link, state when checked (still live, gone
  when checked, renamed or moved), what the account says, subjects, rough answer count, last active
  year, an archive link, and notes.
- Read the stance breakdown for the run — counts and shares, over live accounts only, because an
  account that was gone when checked says nothing about what remains.
- Remove a miscoded entry while the run is open.
- Close a run when it is finished, and reopen it to correct something.
- Download the run as CSV. Every row carries the run's date, scope, and method, so a spreadsheet
  pasted into a document still says what it is a census of.

## API Surface and Route Map

| Route | Method | Access | What it does |
|---|---|---|---|
| `/api/quora-live-census/runs` | GET | Admin | Every run, newest observation date first, with entry and live counts. |
| `/api/quora-live-census/runs` | POST | Admin | Starts a run. Date, scope, and method all required. |
| `/api/quora-live-census/runs/[runId]` | GET | Admin | One run with its entries and its stance tally. |
| `/api/quora-live-census/runs/[runId]` | PATCH | Admin | Closes or reopens the run. |
| `/api/quora-live-census/runs/[runId]/entries` | POST | Admin | Adds one coded account. Refused when the run is closed, or when the handle is already coded in that run. |
| `/api/quora-live-census/runs/[runId]/entries/[entryId]` | DELETE | Admin | Removes one entry. |
| `/api/quora-live-census/runs/[runId]/export` | GET | Admin | The run as CSV. |

## Data Model and Storage Contracts

`quora_live_census_runs` — one row per snapshot.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `observed_on` | DATE | The date the snapshot describes. Separate from `created_at` on purpose. |
| `topic_scope` | TEXT | What was searched. Required. |
| `sampling_method` | TEXT | How accounts were picked. Required. |
| `notes` | TEXT NULL | Free text |
| `status` | TEXT | `open` / `closed`; a closed run refuses new entries |
| `created_by_user_id` | TEXT NULL | The admin who started it |
| `created_at`, `updated_at` | TIMESTAMPTZ | `NOW()` |

Index: `idx_quora_live_census_runs_observed_on` on `(observed_on DESC)`.

`quora_live_census_entries` — one row per observed account.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `run_id` | UUID | References `quora_live_census_runs(id)` ON DELETE CASCADE |
| `handle` | TEXT | Required |
| `profile_url` | TEXT NULL | Optional |
| `account_state` | TEXT | `live` / `gone` / `renamed_or_moved` |
| `topics` | TEXT[] | Same subject list as the deletion survey, so the two datasets stay comparable |
| `stance` | TEXT | `practical_help` / `organizing` / `personal_account` / `distress_no_coping` / `discouraging` / `dismissive` / `unclear` / `unrelated`; defaults to `unclear` |
| `approx_answer_count` | INTEGER NULL | Optional estimate |
| `last_active_year` | INTEGER NULL | 2005-2100 at the database, offered from 2010 in the form |
| `evidence_url` | TEXT NULL | Ideally an archive link, so a later reader can check the call |
| `notes` | TEXT NULL | Free text |
| `created_at` | TIMESTAMPTZ | `NOW()` |

Indexes: `idx_quora_live_census_entries_run` on `(run_id, created_at)`, and a unique
`idx_quora_live_census_entries_run_handle` on `(run_id, lower(handle))` so one account cannot be
coded twice inside a run and count double in the tally.

The subject list is duplicated between `lib/quora-live-census/constants.ts` and
`lib/quora-deletion-survey/constants.ts` rather than shared, because the survey is not yet on
`main`. The two must be changed together; if they drift, the comparison the census exists for
silently stops meaning anything. Folding them into one shared module once the survey merges is in
the gaps list below.

## Security, Privacy, and Compliance Controls

Admin-only throughout: `requiredRoles: ['admin']` on the page and again on all seven routes
(rule 131). Mutations additionally require the `x-ctf-csrf: 1` header and the shared same-origin
`checkMutationOrigin` check.

What this holds: observations about named public Quora accounts, made from outside, by a person
reading them. Not member data. No row carries a user id for anyone on this platform except
`created_by_user_id` on a run, which records which admin started it.

Account deletion: `quora_live_census_runs` is registered in `lib/account/deletion-registry.ts`
under the `quora-live-census` slug as `retain`. A run's `created_by_user_id` is an admin provenance
stamp on an observation — the admin/reviewer case that file already treats as an audit trail.
Clearing it would erase who made an observation while leaving the observation standing, which is
the wrong half to keep, and it matters more if a second coder is ever added. `quora_live_census_entries`
has no user column at all and needs no entry: it describes third-party public accounts.

Publication: nothing here is published by any code path. What reaches a reader is a count an admin
writes by hand into a post. Naming an individual account publicly is a decision made outside this
tool, and the tool takes no position on it — a handle appearing in this table is not consent to
anything.

Trust signals (rule 132): not applicable. Nothing here is member participation, and no observation
about a third party's account may ever become public evidence about a member.

## Web and Android Delivery Status

| Surface | Status |
|---|---|
| Web — admin (`/admin/quora-live-census`) | Shipped |
| Mobile-responsive | Shipped — the app's single phone-width layout (rule 105) |
| Android (React Native) | Out of scope. Not on the Chyme keep-list (rule 105), and admin-only. |
| Member or public surface | None, by design |

## Seed Coverage Status

No seed script. Seeded observations would be indistinguishable from real ones once exported, and
the census is only worth anything if every row is something a person actually looked at.

## Manual Test Steps

Not in `ctf/config/manual-test-script-manifest.json` — that manifest is one entry per plugin, and
this is not a plugin. The steps that matter:

1. As a non-admin, open `/admin/quora-live-census`. Access is denied with the status and reason
   shown. Same for each API route.
2. Start a run with a date but no scope or method. It is refused with a message naming what is
   missing.
3. Start a complete run. It appears in the list and opens.
4. Code an account, leaving the stance untouched. It is stored as `unclear`, not as a substantive
   category.
5. Code the same handle again in the same run. It is refused as already coded.
6. Code several accounts across different stances. The tally shows counts and shares over live
   accounts only — mark one `gone` and confirm it drops out of the tally but stays in the list.
7. Close the run, then try to add an entry. It is refused. Reopen and confirm it is accepted again.
8. Download the CSV. Every row carries the run date, scope, and method, and free text containing
   commas and quotes stays inside its own cell.

## Gaps & Known Technical Debt

- The subject list is duplicated with the deletion survey (see above). Fold both into one shared
  module once the survey is on `main`.
- One coder, no second opinion. Stance coding is a judgment call, and a census coded by one person
  has no measure of how repeatable that judgment is. A second coder on a sample of the same run,
  with the disagreement rate recorded, is the standard fix and is not built.
- No entry editing. A miscoded row is removed and re-added rather than corrected in place.
- Nothing links a census entry to a survey response about the same handle. That join would be
  interesting and is deliberately absent: the survey's handles arrive under a consent regime this
  tool does not share.
- No cross-run comparison view. Two runs a year apart are the point of doing this repeatedly, and
  reading them side by side currently means exporting both.

## Change Log

- 2026-08-19: Built, on the owner's instruction, as the survivor-side half the deletion survey
  could not cover. Runs, coded entries, stance tally, close and reopen, CSV export.
