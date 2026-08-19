# Quora Account Deletion Survey — Feature Inventory

## Scope & Boundary

A survey that collects self-reports from people whose Quora accounts were removed, plus an
admin-only reader and CSV export of those responses. The page is readable by anyone; submitting
requires a signed-in member, and that session is used only as a spam gate.

Not a plugin. It has no entry in `lib/plugins/repository.ts`, no member navigation, no mobile
surface, and no place in the apps grid. It is a research instrument with two surfaces: one page
anyone on the internet can fill in, and one admin page where the owner reads what came back.

In scope: the public form, the submit route, the admin reader, the CSV export, and the two tables
behind them. Out of scope: anything that publishes a response. Publishing is a person reading the
consent flags and writing a blog post, never an automated path out of this data.

## Intent

The blog says, in several posts, that people writing about being targeted keep losing their Quora
accounts. That has rested on the owner's own two erased accounts (Pedigree101 and Farah_Brunache)
and on what people mention in passing. This survey is the record behind the claim: which accounts,
how many times, when, what they were writing about, and what reason Quora gave.

Two limits are stated in the form copy, in the admin header, and here, because a reader who does
not know them will over-read the results:

1. Self-report. Nothing is checked against Quora. A response is what one person says happened.
2. Selection bias runs one way, from two causes. Only someone who found their way to another
   platform can answer at all, and only someone willing to make a free account here can submit. So
   the survey counts the people who kept going and were willing to sign up, and misses everyone
   else. Results are a floor on the number of removals, never a share of everyone affected.

A third limit belongs with those two, because it is what the survey cannot do at all: it measures
removals, not survivals. A claim about which accounts are still standing on Quora needs a separate
fixed-date census of live accounts coded by subject matter. That census is not built and is not in
this inventory.

## User Features

Anyone can open `/survey/quora-account-deletions` and read the whole explanation — what the survey
is for, what happens to answers, and what the results can and cannot show. A signed-out visitor
sees that plus a sign-in link, and no questions. Any signed-in member, verified or not, can:

- Read what the survey is for, what happens to their answers, and what the results can and cannot
  show, before any question is asked.
- Say whether they consider themselves a targeted individual — yes or no. Required; the form will
  not send without it.
- Say yes or no to whether at least one of their Quora accounts was removed.
- Describe each removed account on its own card, adding as many cards as they lost (up to 25): the
  handle, what happened (deleted, banned or suspended, answers removed but account kept, a Space
  removed, blocked from posting), the month and year, the reason Quora gave (including "no reason
  was given" and "I do not remember"), whether they appealed, whether anything was put back, what
  the account mostly wrote about, and roughly how many posts it had and how long it ran.
- Paste anything they can show — the text of the notice Quora sent, or an archive link to the dead
  profile — and add any other notes.
- Choose, in three separate yes/no boxes that all start off, whether their handles may be
  published, whether their words may be quoted, and whether their handle may be attached to that
  quote.
- Send the answer and see it confirmed. There is no email, no confirmation message, and no way for
  anyone here to contact them afterward, because the form asks for no contact detail at all.

Nobody is asked to type a total. The number of removals is the number of account cards filled in,
so every removal counted carries a handle and a date.

## Admin Features

At `/admin/quora-deletion-survey`, an admin can:

- See three totals: responses received, removals described, and how many responses consented to
  their handles being published.
- Read every response newest first, each showing its three consent decisions as labeled chips
  above the handles they apply to, then each reported account with its date, outcome, stated
  reason, subject matter, appeal result, and size.
- Download the whole survey as a CSV, one row per reported removal, with the consent columns
  placed immediately after the response id.
- Refresh without leaving the page.

## API Surface and Route Map

| Route | Method | Access | What it does |
|---|---|---|---|
| `/api/quora-deletion-survey/responses` | POST | Any signed-in member | Stores one survey response and its account rows. Session (spam gate only, never stored), same-origin CSRF header, and a per-IP brake of 5 submissions per hour. |
| `/api/quora-deletion-survey/admin/responses` | GET | Admin | The newest 500 responses with their account rows, plus the three totals. |
| `/api/quora-deletion-survey/admin/export` | GET | Admin | The whole survey as CSV, one row per reported removal. |

## Data Model and Storage Contracts

`quora_deletion_survey_responses` — one row per person who submitted.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `targeted_individual` | TEXT | `yes` / `no`, no third option. Required by the form and by the submit route, so the column default is never a recorded answer. |
| `any_account_removed` | BOOLEAN | Yes/no only. The count of removals is derived from the account rows, not from this. |
| `evidence_note` | TEXT NULL | Free text, capped at 5000 characters |
| `other_notes` | TEXT NULL | Free text, capped at 5000 characters |
| `consent_publish_handles` | BOOLEAN | Defaults to FALSE |
| `consent_quote` | BOOLEAN | Defaults to FALSE |
| `consent_attribute_quote` | BOOLEAN | Defaults to FALSE |
| `created_at` | TIMESTAMPTZ | `NOW()` |

Index: `idx_quora_deletion_survey_responses_created_at` on `(created_at DESC)`.

`quora_deletion_survey_accounts` — one row per removed account.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `response_id` | UUID | References `quora_deletion_survey_responses(id)` ON DELETE CASCADE |
| `position` | INTEGER | The order the person listed the accounts in |
| `handle` | TEXT | The only required field on an account row; capped at 200 characters |
| `action` | TEXT | `account_deleted` / `account_suspended` / `answers_removed` / `space_removed` / `posting_blocked` |
| `removed_month` | INTEGER NULL | 1-12, or null for "not sure" |
| `removed_year` | INTEGER NULL | 2005-2100 at the database, offered from 2010 in the form |
| `stated_reason` | TEXT | `none_given` / `spam` / `harassment` / `misinformation` / `impersonation` / `adult_content` / `ban_evasion` / `other` / `do_not_recall` |
| `appealed` | BOOLEAN | Defaults to FALSE |
| `reinstated` | BOOLEAN | Defaults to FALSE |
| `topics` | TEXT[] | What the account mostly wrote about; the column that separates "accounts get removed" from "accounts writing about this get removed" |
| `approx_post_count` | INTEGER NULL | Optional estimate |
| `approx_active_months` | INTEGER NULL | Optional estimate |
| `created_at` | TIMESTAMPTZ | `NOW()` |

Index: `idx_quora_deletion_survey_accounts_response` on `(response_id, position)`.

A response and its account rows are written in one transaction, so a half-saved response can never
report a person as having lost nothing.

## Security, Privacy, and Compliance Controls

What is deliberately not stored: no user id, no IP address, no user agent, no email, and no
contact detail of any kind. The follow-up contact field was removed from the questionnaire on the
owner's instruction (2026-08-18). The only identifiers in these tables are the Quora handles a
person chose to type, alongside the consent flags governing them.

The cost of that choice, stated plainly because it is real: there is no way to follow up with a
respondent, no way to detect that the same person submitted twice, and no way to verify a response
later. The survey buys privacy with those three things.

Write path: requires a signed-in member at the `any_authenticated` tier — the same bar the
knowledge library and Mutual Time use — plus a required `x-ctf-csrf: 1` header, the shared
same-origin `checkMutationOrigin` check, and a per-IP fixed-window brake of 5 submissions per hour
(`lib/security/rate-limit.ts`). The IP is used for the in-memory counter only and is never stored.
Every field is validated against a fixed option list or a length cap before it reaches the
database, and unknown values fall back to the safe default rather than being stored.

The session is a spam gate and nothing else (owner decision, 2026-08-19). It is checked at the
route and then dropped: no user id, and nothing else derived from the account, is written to either
table. So a member can report accounts they lost without the report ever being attributable to
them, and an admin reading the results cannot work out who said what. The tier must stay at
`any_authenticated` — someone who made an account minutes ago to answer this is exactly who the
survey is for, and raising the bar to `approved_full` would silently exclude them.

Read path: `requiredRoles: ['admin']` on the admin page and again on each admin route. There is no
public projection of survey data and no member-facing view.

Consent: all three consent columns default to FALSE at the database as well as in the form, so a
row created by any future path that forgets to set them is still "do not publish". The admin
reader shows the three decisions above the handles they govern.

Account deletion and data export: not applicable. Respondents are not members and no row here
carries a user id, so there is nothing for `lib/account/deletion-registry.ts` to delete or for the
export engine to gather. These tables are correctly absent from both.

Trust signals (rule 132): not applicable. Responses are not member participation, are not tied to
an account, and describe something done to a person on another platform. Nothing here may become
public evidence about anybody.

## Web and Android Delivery Status

| Surface | Status |
|---|---|
| Web — public form (`/survey/quora-account-deletions`) | Shipped |
| Web — admin reader and CSV export (`/admin/quora-deletion-survey`) | Shipped |
| Mobile-responsive | Shipped — the app's single phone-width layout, no separate desktop layout (rule 105) |
| Android (React Native) | Out of scope. Not on the Chyme keep-list (rule 105), and the audience for this form is people outside the app entirely. |

## Seed Coverage Status

No seed script. The table is a record of what real people reported, and seeded rows in it would be
indistinguishable from responses once exported — which is exactly the failure a survey used as
supporting documentation cannot afford. A demo of the admin screen shows the empty state.

## Manual Test Steps

Not in `ctf/config/manual-test-script-manifest.json`: that manifest is one entry per plugin, and
this is not a plugin. The steps that matter:

1. Signed out, open `/survey/quora-account-deletions`. The explanation and a sign-in link render,
   with no questions and no redirect. Signed in as a brand-new unverified member, the same URL
   renders the form.
2. Answer no to the removal question and send. The confirmation appears; the admin list shows a
   response with zero removals.
3. Answer yes, add two accounts with handles, leave every optional field alone, and send. The
   admin list shows one response with two removals.
4. Answer yes and add no handle. The form is rejected with a message naming what is missing.
4b. Leave question 1 untouched. The send button stays disabled, and a request that omits the
   answer is rejected by the route rather than stored with an assumed one.
5. Leave all three consent boxes off and send. The admin card shows three "may not" chips.
6. Open `/admin/quora-deletion-survey` as a non-admin. Access is denied with the status and reason
   shown.
7. Download the CSV. One row per reported removal, the zero-removal response present with empty
   account columns, and free text containing commas and quotes still inside its own cell.

## Gaps & Known Technical Debt

- No survivor-side census. The claim about which accounts remain on Quora needs a separate
  fixed-date snapshot of live accounts coded by subject matter; scoped as later work on the
  owner's instruction (2026-08-18).
- Duplicate submissions cannot be detected. This follows directly from storing no contact detail
  and no address, and is a deliberate trade rather than a defect to fix.
- The per-IP brake is per-process and in-memory (see the honest limits at the top of
  `lib/security/rate-limit.ts`). It bounds accidental floods and casual abuse, not a determined
  campaign against the form. If the survey is targeted, the next step is a shared-store limiter,
  not a tighter number here.
- No admin delete. A response the owner judges to be junk currently stays in the table and in the
  export.

## Change Log

- 2026-08-18: Built. Public form, submit route, admin reader, CSV export, and the two tables.
  The follow-up contact field is absent on the owner's instruction the same day.
- 2026-08-19: Submitting now requires a signed-in member at the `any_authenticated` tier, on the
  owner's instruction, to keep bulk junk out of a table that is meant to be citable. The page stays
  readable signed-out. The session is never stored, so responses remain unattributable; the cost is
  a second source of selection bias, now stated in the form copy and above.
- 2026-08-18: Question 1 (targeted individual) narrowed to yes/no, dropping the third
  "prefer not to say" option, on the owner's instruction. It has no safe default, so the form
  requires an answer and the submit route rejects a response that carries none rather than
  storing an assumed one. Question 2 stays yes/no with the removal count derived from the account
  rows, which is where "how many times" comes from.
