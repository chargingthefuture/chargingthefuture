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

Members reach the form from two places inside the app (owner report, 2026-08-19 — until then the
only link anywhere in the product was the admin screen's "Member view" button, so no member could
find it):

- The Unlock verification screens, beside the existing "can't find your Quora profile URL?" help.
  That is where an unapproved member is held, and the survey is one of only three things they may
  do before approval — so without a link there, the exception carved out for them was unreachable
  by them. It also fits: the person who cannot produce a profile URL is usually the person whose
  accounts were taken.
- The Directory profile edit screen, under the member's own Quora URL field, whose help text
  already covers an account that changed. A removal is the harder version of that case.

Both render the one shared `SurveyInviteNote` (`components/shared/survey-invite-note.tsx`) so the
wording cannot drift, and both are invitations — nothing in either flow depends on answering.

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
- Have every handle they listed added to their own account history here, permanently and not
  editable by anyone afterward. This happens on submission for every respondent.
- Optionally say whether they still have a Quora account that was not removed, and give its link.
  Both are skippable and read as skippable: naming an account someone still holds is a larger ask
  than naming ones already gone. The link is never stored with the answer — it stays in the browser
  and is only used if they choose the verification offer below.
- Send the answer and see it confirmed. There is no email, no confirmation message, and no way for
  anyone here to contact them afterward, because the form asks for no contact detail at all.
- On the confirmation screen, if they gave a link to an account they still hold and have not
  verified here before, choose to send that link for verification instead of being asked for the
  same thing again on the Unlock screen. It creates a pending submission for review and approves
  nobody. So for a new member, the live account they name in the survey is the account their
  verification is judged on.

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
| `/api/quora-deletion-survey/responses` | POST | Any signed-in member | Stores one survey response and its account rows against the member's id, then writes each reported closure to that member's account history. Same-origin CSRF header and a per-IP brake of 5 submissions per hour. |
| `/api/quora-deletion-survey/verification` | POST | Any signed-in member | Starts Unlock verification from the confirmation screen using the link to the account the member still holds. Creates a pending submission only, and does nothing for a member who already has one. Same session, CSRF, and per-IP brake as the submit route. |
| `/api/quora-deletion-survey/admin/responses` | GET | Admin | The newest 500 responses with their account rows, plus the three totals. |
| `/api/quora-deletion-survey/admin/export` | GET | Admin | The whole survey as CSV, one row per reported removal. |

## Data Model and Storage Contracts

`quora_deletion_survey_responses` — one row per person who submitted.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | TEXT NULL | The member who sent this. Set on every insert. NULL means the account was deleted and the id was cleared, never that the answer was anonymous. |
| `targeted_individual` | TEXT | `yes` / `no`, no third option. Required by the form and by the submit route, so the column default is never a recorded answer. |
| `any_account_removed` | BOOLEAN | Yes/no only. The count of removals is derived from the account rows, not from this. |
| `has_current_profile` | BOOLEAN NULL | Optional. NULL means the question was skipped, which is not the same answer as no. The URL that goes with a yes is deliberately not stored here — see the two-sided design below. |
| `evidence_note` | TEXT NULL | Free text, capped at 5000 characters |
| `other_notes` | TEXT NULL | Free text, capped at 5000 characters |
| `consent_publish_handles` | BOOLEAN | Defaults to FALSE |
| `consent_quote` | BOOLEAN | Defaults to FALSE |
| `consent_attribute_quote` | BOOLEAN | Defaults to FALSE |
| `created_at` | TIMESTAMPTZ | `NOW()` |

Indexes: `idx_quora_deletion_survey_responses_created_at` on `(created_at DESC)`, and
`idx_quora_deletion_survey_responses_user` on `(user_id, created_at DESC)` — the second is what
makes a member's second response findable at all.

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
| `topics` | TEXT[] | What the account mostly wrote about; the column that separates "accounts get removed" from "accounts writing about this get removed". Coded from the one shared list in `lib/shared/quora-research-subjects.ts`, which the live census uses too — the two datasets only answer the question together, and a comparison between differently-coded sets means nothing. |
| `approx_post_count` | INTEGER NULL | Optional estimate |
| `approx_active_months` | INTEGER NULL | Optional estimate |
| `created_at` | TIMESTAMPTZ | `NOW()` |

Index: `idx_quora_deletion_survey_accounts_response` on `(response_id, position)`.

A response and its account rows are written in one transaction, so a half-saved response can never
report a person as having lost nothing.

`quora_deletion_survey_audit_log` — one row per event worth accounting for.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `actor_user_id` | TEXT NULL | Always NULL for a survey submission, allowed or refused. Populated for the identified actions: an admin reading or exporting, and a respondent starting verification. |
| `command` | TEXT | `quora_deletion_survey.response.submit` / `.admin.read` / `.admin.export` / `.verification.link` |
| `policy_status` | TEXT | `allow` / `deny` |
| `reason` | TEXT NULL | Why, in one token: `stored`, `listed`, `exported`, `submitted`, `not_signed_in`, `csrf_denied`, `rate_limited`, `invalid_payload`, `persistence_unavailable`, or the auth layer's own deny reason |
| `response_id` | UUID NULL | Set on a stored submission so a response can be tied to the event that created it. Never set on an admin read, which would put a response id next to an admin's user id for every row read. |
| `row_count` | INTEGER NULL | How many rows the event covered: accounts on a submit, responses on a read or export, handles linked on a verification |
| `metadata` | JSONB | Small facts about the event. Never a copy of a response's contents, which would put the survey inside its own audit log. |
| `created_at` | TIMESTAMPTZ | `NOW()` |

Index: `idx_quora_deletion_survey_audit_created_at` on `(created_at DESC)`.

No IP address is written to any of the three tables, including this one, even though the rate
limiter sees one.

Written outside these tables: when a respondent takes the verification offer and ticks the
optional box, each handle they lost is added to `directory_quora_url_history` against their user
id, through `lib/shared/directory-interface.ts`. A removed account has no URL, and none may be
invented — a fabricated `quora.com/profile/...` link would sit in that history looking clickable
and current, and the next reader would take it for a live account. Each one is stored as the
marker string `removed-quora-account:<handle>`, which cannot be mistaken for a URL, with the
history's NOT NULL normalized column taking the same string lowercased. The history's source
column records `quora_deletion_survey`, and the Unlock admin screen labels that source "reported
removed, from the account survey".

## Security, Privacy, and Compliance Controls

What is deliberately not stored: no IP address, no user agent, no email, and no contact detail of
any kind. The follow-up contact field was removed from the questionnaire on the owner's instruction
(2026-08-18). What is stored is the member id of the account that sent the response, the Quora
handles the person chose to type, and the consent flags governing them.

The costs that remain, stated plainly: there is still no way to reach a respondent outside the app,
and no answer is verified against Quora. Duplicate detection, which an earlier build could not do
at all, is now possible through the member id.

Write path: requires a signed-in member at the `any_authenticated` tier — the same bar the
knowledge library and Mutual Time use — plus a required `x-ctf-csrf: 1` header, the shared
same-origin `checkMutationOrigin` check, and a per-IP fixed-window brake of 5 submissions per hour
(`lib/security/rate-limit.ts`). The IP is used for the in-memory counter only and is never stored.
Every field is validated against a fixed option list or a length cap before it reaches the
database, and unknown values fall back to the safe default rather than being stored.

This is one of exactly three exceptions to the Unlock gate — with the knowledge library
contribution (2026-07-29) and Contributions (2026-06-10) — and it is an exception rather than a
precedent. A member must be approved through Unlock to do anything else in this app, and a new
surface should use the `approved_full` default. The reason this one is different is specific
and does not generalize: the research is about people outside this app, so approval cannot be the
bar without sampling only the members already reached. The exception is recorded in
`ctf/config/unlock-tier-exception-allowlist.json` and enforced by the `unlock-tier-gate` CI job —
copying this pattern into a new feature fails the build, and adding a line to that file is the
owner's decision, not a build step.

Sign-in keeps bulk junk out of a table that is meant to be citable. It is not a claim that the
member is verified, and it is not what decides whether anything is published. The tier must stay at
`any_authenticated` — someone who made an account minutes ago to answer this is exactly who the
survey is for, and raising the bar to `approved_full` would silently exclude them.

Read path: `requiredRoles: ['admin']` on the admin page and again on each admin route. There is no
public projection of survey data and no member-facing view.

What this survey is for, because it decides what belongs in these columns (owner, 2026-08-19):
documenting that content and handles are being scattered and removed to discredit people — history
erasure. The handles are public and a person types them here on purpose. Someone who does not want
their handle history on record does not fill in the form.

So the response carries the member id of the account that sent it. Two earlier drafts of this
feature stored no identity and argued for keeping respondents unreadable to the owner; both were
wrong for this survey and were reversed. Keeping the id is what makes a duplicate answer visible
(`repeatRespondents` in the totals, and the tile on the admin screen), lets a response be lined up
against that member's Unlock submission, and leaves a route to reach someone about what they
reported.

Knowing who answered is not permission to print it. Publication is governed by the three consent
flags on the row and by nothing else, and that separation is the promise the form actually makes.

The live profile URL is still not stored on the response. Not to hide the person — the row names
them — but because a verification URL belongs in the verification queue where a reviewer acts on
it, rather than sitting in a research table nobody re-reads. The yes/no answer is stored; the link
travels to the verification route instead.

Every handle a person reports as closed is written to their Directory account history on
submission — for every respondent, whether or not they go on to verify, and not behind a choice.
Two earlier builds tied this write to the verification step, which meant an already-verified
member's reported closures were never recorded at all, and a member with no Quora account left
could record nothing, despite being the strongest case in the research.

That history is append-only: there is no update and no delete for it anywhere in the codebase, and
it is `retain` on account deletion. A member cannot revise what they reported, which is the point —
a record of accounts being erased is worth little if it can be quietly edited later. The form says
this before anyone answers.

Writing the same closure twice is prevented by reading back the member's existing survey-sourced
markers first (`listRemovedQuoraAccountMarkers`), so answering again adds only what is new.

One consequence that had to be handled: `quora_url_change_count` in the Unlock queue, and
`countQuoraUrlChangesByUser`, count rows in this table as an abuse signal — how often a member has
changed the URL they verify with. Closure rows are excluded from both. Without that, a member
reporting six accounts Quora closed would show as someone who changed their verification URL six
times, making the most-affected respondents look like the most suspicious accounts.

Verification path: `lib/quora-deletion-survey/unlock-link.ts` goes through
`lib/shared/unlock-interface.ts` and never imports `lib/unlock` directly (owner decision
2026-08-03, enforced by `check-plugin-boundaries.mjs`). It creates a `pending` submission in the
ordinary queue and approves nobody. It re-checks for an existing submission immediately before
writing, so a member who verified in another tab is neither asked twice nor overwritten, and two
conflicting URLs can never land on one account by this path. It is audited as an ordinary
`unlock.verification.submit` with `metadata.source` naming the survey, so a reviewer can see the
member never saw the Unlock form.

Audit trail: every path through the submit route writes a row — stored, and each refusal
(`not_signed_in`, `csrf_denied`, `rate_limited`, `unreadable_payload`, `invalid_payload`,
`persistence_unavailable`) — with the actor left NULL, because naming the member would undo the
anonymity of the response the event is about. Admin reads and exports are the mirror image: the
admin's user id, the action, and the row count, and never the responses themselves. The export row
is written before the file is handed over, since once a CSV leaves the app it is a copy of the
whole table outside anything this code can see.

Consent: all three consent columns default to FALSE at the database as well as in the form, so a
row created by any future path that forgets to set them is still "do not publish". The admin
reader shows the three decisions above the handles they govern.

Account deletion: `quora_deletion_survey_responses` is registered under the `quora-deletion-survey`
group as `pseudonymize` — the row stays, `user_id` is cleared. A survey answer is a record of an
erasure, and destroying it when its author leaves would repeat the thing the survey exists to
document, as well as silently shrinking counts already quoted in published posts. This is the same
handling bug reports get, for the same reason: the content is still needed after the person is
gone. The account rows have no user column of their own; they cascade from the response and are
de-identified with it. The audit log is `retain`, like every other accountability trail in that
registry. The form states all of this before anyone answers.

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
   account columns, and free text containing commas and quotes still inside its own cell. The
   `has_current_profile` cell is empty for a response that skipped that question.
8. Skip the current-account question entirely and send. The confirmation screen shows no
   verification offer, and the stored row has NULL rather than FALSE in `has_current_profile`.
9. As a member with no Unlock submission, answer yes to the current-account question, give a Quora
   profile link, list two removed handles, and send. The confirmation screen offers verification
   with the handle box off. Press send without ticking it: Unlock shows a pending submission whose
   audit metadata names the survey, and the member's Directory URL history has no removed handles.
10. Repeat with the box ticked. The same pending submission appears, and the Directory history now
   shows both handles as `removed-quora-account:<handle>`, labeled "reported removed, from the
   account survey" on the Unlock admin screen.
11. As a member who already has an Unlock submission, answer the same way. No offer is shown at
   all, and a request sent to the verification route directly leaves the existing submission
   untouched.

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
- Survey respondents who sign up are a likely source of duplicate member accounts. Someone whose
  Quora account was removed may well have made a new one here to answer, and Unlock already has a
  `duplicate` decision, an `/account-closed` page, and a `locked_support_only` tier from
  `getUnlockAccessTier` for exactly that case. Nothing in this feature detects it — the survey
  cannot, since it stores no identity — so the load falls on the Unlock reviewer, who now sees
  `metadata.source` naming the survey on submissions that came this way.

## Change Log

- 2026-08-19: Added the shared screen header (`MobileScreenHeader`) to the admin surface and to
  the signed-in public form, both of which shipped without one — no back control and no
  report-bug / settings / account cluster, which strands anyone reaching them on a phone. The form
  matters most: it sits at a top-level path rather than under `/apps`, so a member opening it from
  a link had no way into the rest of the app at all. The admin header carries a "Member view" link
  to the public form. The signed-out landing keeps no header on purpose — there is no session
  behind it and nothing in-app to go back to — so the page title is now conditional and shows only
  there.
- 2026-08-19: Added the two member-facing links to the form (Unlock screens, Directory profile
  edit) through one shared note component. Before this the form had no in-app entry point at all —
  the only link was the admin surface's "Member view" button, so the members most likely to have
  something to report, the unapproved ones held in the Unlock flow, could not reach it.
- 2026-08-19: The subject list moved to `lib/shared/quora-research-subjects.ts`, shared with the
  live census, which merged first. The two carried identical copies while this branch was open,
  and copies drift apart without anything failing to warn anyone.
- 2026-08-19: Reported closures are written to the member's account history on submission, for
  every respondent. They were previously written only when a member took the verification offer,
  which meant an already-verified member's closures were never recorded and a member with no Quora
  account left could record none at all. Closure rows are excluded from the two URL-churn counts in
  the Unlock queue, so reporting six closed accounts no longer reads as six suspicious URL changes.
  Re-answering does not duplicate a closure already on the history.
- 2026-08-19: The response now carries the member id of the account that sent it, reversing the
  earlier no-identity design on the owner's instruction. The survey is for putting handle history
  on record; the handles are public and typed deliberately, and a respondent is not being hidden
  from the person reading the results. Practical effect: a member answering twice is now visible
  (a totals tile), a response can be lined up against that member's Unlock submission, and the
  member id appears on the admin card and in the CSV. Account deletion clears the id and keeps the
  answer, because a record of an erasure should not itself be erased. The form copy that promised
  the opposite is gone, and the removed-handle recording is no longer behind an extra checkbox.
  Publication is unchanged: still the three consent flags and nothing else.
- 2026-08-19: Added the optional question about an account the person still holds, and an offer on
  the confirmation screen to use that link to start Unlock verification rather than being asked for
  the same thing twice. The link is never stored with the survey answer. Added the audit log table,
  covering every submit path including refusals with no actor, and admin reads and exports with the
  admin's id and the row count. Recording the lost handles on the member's Directory account is a
  separate, off-by-default choice with its own explanation, because it is the one thing here that
  could tie an anonymous response to a member.

- 2026-08-18: Built. Public form, submit route, admin reader, CSV export, and the two tables.
  The follow-up contact field is absent on the owner's instruction the same day.
- 2026-08-19: Submitting now requires a signed-in member at the `any_authenticated` tier, on the
  owner's instruction, to keep bulk junk out of a table that is meant to be citable. The page stays
  readable signed-out. The cost is a second source of selection bias — only someone willing to make
  an account can submit — now stated in the form copy and above.
- 2026-08-18: Question 1 (targeted individual) narrowed to yes/no, dropping the third
  "prefer not to say" option, on the owner's instruction. It has no safe default, so the form
  requires an answer and the submit route rejects a response that carries none rather than
  storing an assumed one. Question 2 stays yes/no with the removal count derived from the account
  rows, which is where "how many times" comes from.
