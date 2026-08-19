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

### Where the accounts come from decides what the run can prove

This is the single most important thing about the census, and it is easy to get wrong in a way that
produces a confident number that is simply false.

**A fresh search cannot see a removed account.** Search Quora today and you get survivors; the
accounts that were taken down are not missing from the results, they are invisible to them. A
fresh-search run can describe what the survivors say. It can say nothing at all about how many were
removed, and its `gone` count is only the few that died between being found and being coded.

**A list assembled beforehand can.** If the set was fixed before the removals happened, and fixed on
a criterion unrelated to what the accounts write, then walking it today gives a real removal rate
against a real denominator *and* the stance mix among the survivors, from one pass.

**The app already holds such a list.** `directory_profiles` with `source` of `admin` or
`community-generated` — profiles added by the owner or nominated by scouts — exist because the
person is a targeted individual, whatever they author. That criterion is independent of stance,
which is exactly what a frame needs to be. It is the strongest frame available for this census and
is the recommended one; a fresh search is the fallback when no suitable list exists.

So every run records `frame_kind` (`existing_list` or `fresh_search`), required with no default,
and the admin screen shows a removal rate only for the first kind. For the second it prints the
reason instead of a number. Printing the number anyway is the easiest way to publish something
false out of this tool.

Note what this does to the survey's stated limits: the deletion survey is self-report and
self-selected, so it can only ever be a floor. An existing-list run has neither problem — nobody
selected themselves into `directory_profiles`, and nothing about it is a report. The two are
answering the same question from opposite sides, and the list-based run is the stronger half.

### What this deliberately does not record

The stance list once carried three more values: distress with no way forward, tells others to give
up, and says targeting is not real. They were removed on the owner's decision (2026-08-19).

The reason, kept here because the next reader will otherwise reinstate them: each was a
psychological judgment about an identifiable person, inferred from their public posts, stored
against their handle, and exportable to CSV — about a population that believes it is being
catalogued, and who were never asked. The deletion survey holds itself to the opposite standard
about the same people: nothing traceable to someone who did not name themselves, and three separate
consent questions before a handle or a quote can be published. The census cannot claim a looser
standard on the grounds that its subjects are not present to object. That is the argument for the
looser standard, not against it.

**What that costs, stated plainly because it is not small.** The census can no longer test whether
what remains on Quora is discouraging. That was the original reason to build it. An account that is
nothing but despair now codes as `personal_account` or `unclear` like any other, and no run will
ever distinguish them. What survives is a real and useful measurement — which accounts are still
standing, and what subjects they cover — and it is a narrower one than first designed.

The tone question is not answered elsewhere in this repo. If it matters enough to answer, it needs
an instrument that does not keep a verdict on a named person: a reading of the *writing* rather than
of the writer, sampled and coded without storing who wrote it, so no row ever pairs a person with a
judgment about their state of mind. That is not built and is not scoped.

### The rest of the method

- A run names one observation date. Coding may take days; the census is only ever citable as "what
  was live on this date".
- A run names what was searched and how accounts were picked from it, both required. Without both,
  the numbers are unreproducible and indistinguishable from picking the accounts that suited the
  argument.
- The stance list records what an account **does**, never how the person behind it seems to be
  doing. See "What this deliberately does not record" below — that boundary is the most important
  decision in this inventory and it is not a detail to tidy away.
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

- Start a run by giving the observation date, where the accounts come from (a list assembled
  beforehand, or a search today), what was searched, how accounts were picked, and optional notes.
  All but the notes are required, and the form states what each frame kind can and cannot support
  as it is chosen.
- See every run newest observation first, each showing how many accounts were coded and how many of
  those were still live.
- Open a run and code accounts into it: handle, profile link, state when checked (still live, gone
  when checked, renamed or moved), what the account says, subjects, rough answer count, last active
  year, an archive link, and notes.
- Read what is gone: a real removal rate on a run built from a list assembled beforehand, and on a
  fresh-search run, the reason no rate is available instead of a misleading number.
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
| `frame_kind` | TEXT | `existing_list` / `fresh_search`. Decides whether the run can support a removal rate. Required, no default at the API. |
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
| `stance` | TEXT | `practical_help` / `organizing` / `personal_account` / `unclear` / `unrelated`; defaults to `unclear`. What the account does, never how its author seems to be doing — see "What this deliberately does not record". |
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

`quora_live_census_audit_log` — who read or changed the census.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `actor_user_id` | TEXT NULL | The admin; null on a denied request |
| `command` | TEXT | e.g. `census.run.export`, `census.run.read`, `census.entry.create` |
| `policy_status` | TEXT | `allow` / `deny` |
| `reason` | TEXT NULL | Why, in the deny case the gate's own reason |
| `run_id` | UUID NULL | Which run, where the action names one |
| `row_count` | INTEGER NULL | How many rows were read or exported |
| `metadata` | JSONB | Observation date, frame kind, run status on an export |
| `created_at` | TIMESTAMPTZ | `NOW()` |

Index: `idx_quora_live_census_audit_created_at` on `(created_at DESC)`.

## Security, Privacy, and Compliance Controls

Admin-only throughout: `requiredRoles: ['admin']` on the page and again on all seven routes
(rule 131). Mutations additionally require the `x-ctf-csrf: 1` header and the shared same-origin
`checkMutationOrigin` check.

What this holds: observations about named public Quora accounts, made from outside, by a person
reading them. Not member data. No row carries a user id for anyone on this platform except
`created_by_user_id` on a run, which records which admin started it.

Account deletion: `quora_live_census_audit_log` is registered as `retain` — an access record that
disappears when the accessing account does is not an access record. `quora_live_census_runs` is
registered in `lib/account/deletion-registry.ts`
under the `quora-live-census` slug as `retain`. A run's `created_by_user_id` is an admin provenance
stamp on an observation — the admin/reviewer case that file already treats as an audit trail.
Clearing it would erase who made an observation while leaving the observation standing, which is
the wrong half to keep, and it matters more if a second coder is ever added. `quora_live_census_entries`
has no user column at all and needs no entry: it describes third-party public accounts.

Audit: every census route logs through `insertCensusAudit`. Refusals are logged in the shared gate
rather than at each route, so a probe against any endpoint leaves a trace whichever one it hit. The
export logs before the file is handed over, with the admin's id, the run, and the row count — that
is the moment a list of named third parties leaves the app, and it is the action that most needs a
record of who took it. The writer is best-effort and never fails the action it describes.

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
   category. Confirm the stance options offer no judgment about the person's state of mind.
4b. Download a CSV, then read `quora_live_census_audit_log`: a `census.run.export` row names the
   admin, the run, and the row count. Hit any census route as a non-admin and confirm a `deny` row
   lands with no actor id.
5. Code the same handle again in the same run. It is refused as already coded.
6. Code several accounts across different stances. The tally shows counts and shares over live
   accounts only — mark one `gone` and confirm it drops out of the tally but stays in the list.
7. Close the run, then try to add an entry. It is refused. Reopen and confirm it is accepted again.
8. Start a run marked as a fresh search, code one account as gone, and confirm the "what is gone"
   panel prints the reason rather than a rate. Start one marked as a list assembled beforehand and
   confirm the same data now reports a rate.
9. Download the CSV. Every row carries the run date, scope, and method, and free text containing
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
- 2026-08-19: Removed the three wellbeing stance values on the owner's decision, after a review
  pass noticed the census held itself to a looser standard than the deletion survey about the same
  population. The census no longer tests whether what remains is discouraging; it measures survival
  and subject matter. Reasoning and the cost are written up under "What this deliberately does not
  record" so the values are not quietly reinstated. Added `quora_live_census_audit_log` in the same
  pass: the CSV export could hand over a file of named third parties with nothing recording it.
- 2026-08-19: Added `frame_kind` after the owner pointed out the app already holds a non-self-report
  set of accounts kept for being a targeted individual regardless of what they author
  (`directory_profiles`, source `admin` / `community-generated`). That is a far stronger frame than
  a fresh search, and the difference is not cosmetic: a search cannot see a removed account, so the
  original build would have let a fresh-search run be read as a removal rate. Runs now declare their
  frame, and the removal reading is shown only where it means something.
