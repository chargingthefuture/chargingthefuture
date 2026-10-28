# Contributions Plugin Feature Inventory

## 1. Scope and Boundary

- Plugin slug: `contributions`
- Contributions lets members who are able send an Amazon gift card toward the platform's hosting
  bills, which the owner pays personally in real money, and thanks them with ServiceCredits. It is
  open all year; there are no drives.
- Surfaces it owns:
  - All `/api/contributions/*` routes and the `contributions_*` tables.
  - The member screen at `/apps/contributions` and the admin screen at `/admin/contributions`
    (called System Architect in member copy).
- Explicitly does **not** own:
  - Any `unlock_*` table or any part of Unlock verification. Contributions never reads or writes
    Unlock data and never affects access tiers. It is a completely separate plugin from Unlock.
  - The ServiceCredits ledger. Thank-you grants are delegated to the service-credits plugin's
    canonical `mintGrant()`; Contributions never writes `service_credits_*` tables directly.
  - The twice-yearly "Contribute if you can" Commons post. It is drafted by
    `POST /api/internal/admin-expenses/contributions-call-draft` (Expenses, non-plugin inventory)
    and is unchanged by the 2026-10-27 rework.
- Owner decision to remember (2026-06-10, deliberate and active): a not-yet-verified member CAN
  contribute and hold thank-you credits they cannot spend in verification-gated plugins until they
  finish Unlock. Keep this behavior. This note exists so the owner remembers it was an active
  choice, not an oversight.
- That makes Contributions one of the five listed exceptions to the Unlock gate (see `CLAUDE.md`,
  "Unlock Approval Is the Gate"). Every other feature requires Unlock approval to do anything. The
  list is closed and enforced by `ctf/config/unlock-tier-exception-allowlist.json` and the
  `unlock-tier-gate` CI job; adding another is the owner's decision, never a build step. Do not
  copy this posture into a new surface.

## 2. Intent and Outcome

The app is free and stays free. Hosting is paid out of pocket, so a member who is able can send an
Amazon gift card, any time of year, from $1 to $500. They open Contributions, type the amount and
the code from the card, and press Send gift card. The code is stored encrypted and erased once the
System Architect has redeemed it and confirmed or rejected the claim. A confirmed gift card earns
the member thank-you ServiceCredits, a set number per dollar, up to a yearly limit.

What it is not:

- Not a fundraiser. There is no goal, no progress bar, no banner and no reminder.
- No shaming, ever. Not contributing has no consequence and is never shown anywhere.
- Access is never gated on contributing. Nothing in the app is unlocked by a gift card.
- Private. There is no donor list and no public total.

ServiceCredits are the app's internal credits unit. A thank-you grant is not a purchase and is
never redeemable for money.

## 3. User Features

- **Contribute tab.** A short note says the app is free and stays free and that a gift card helps
  keep it online. Below it, the Amazon gift card form:
  - Amount in US dollars: 1 to 500 with no cents, filled in as 10. Anything else shows a red line
    under the field giving that range, and the button stays off.
  - Gift card code: typed or pasted from the card. Spaces are removed and letters upper-cased; it
    has to be 6 to 40 letters, numbers or dashes.
  - A lock note: the code is stored encrypted and erased once the System Architect has confirmed or
    rejected it, and a confirmed card brings the current number of ServiceCredits per dollar (read
    live from the settings).
  - Send gift card. On success the form clears and the screen moves to My history, where the new
    claim shows "Waiting for review". The code is never shown back.
- **Paused card.** When the server has no encryption key set, the form is replaced by "Gift cards
  are paused for now" and "Nothing is needed from you. This screen takes gift cards again once it
  is switched back on." Nothing can be sent while paused.
- **My history tab.** Every claim the member has sent, newest first: "Gift card (Amazon $25)", its
  status (Waiting for review, Confirmed, or Not matched) and date, and "+N SC received" on a
  confirmed one that earned credits. Claims from before 2026-10-27 still show as "Quora comment"
  or "GitHub star". A note under the list says contributions are private between the member and
  the platform owner, with no public donor lists. With no claims yet, the tab says "No
  contributions yet" with a Send a gift card button.
- **Signed-out view.** Says what a contribution is in three steps (type the amount and code; the
  code is stored encrypted and erased after review; credits arrive once confirmed) and asks the
  visitor to sign in.
- Open to any signed-in member: contributing requires no Unlock verification and never changes
  Unlock state.

## 4. Admin Features

The admin screen (`/admin/contributions`, "Contributions Admin") has two tabs.

- **Submission queue.** Every claim, filterable by All, Pending, Confirmed and Rejected, searchable
  by member id or label, with a count of pending claims on the tab. Opening a pending claim shows:
  - **Show gift card code.** Reads that one claim's code, decrypted on the server, with a Copy
    button. Each press is audited (`contributions.admin.code.reveal`), never with the code. When no
    code is stored the row says "No code is stored for this claim." When the code cannot be read
    (the key is unset, or was changed after the code was sent) the route's reason is shown.
  - **Amount redeemed** (dollars with no cents, 1 to 500), filled in from the claim, with the resulting
    credits beside it and a reminder that confirm or reject erases the code.
  - An optional internal note, then **Confirm** or **Reject**. Exactly once: the row is locked and
    must still be pending.
- **Confirm.** Credits = amount redeemed x credits per dollar, clamped so the member's thank-you
  credits over the last 365 days do not pass the yearly limit, then rounded to an integer. A
  positive grant goes through the canonical service-credits mint with idempotency key
  `contribution-<submissionId>`. A grant clamped or rounded to 0 still confirms with
  `credits_granted = 0`. If the ServiceCredits mint budget for the period would be passed, the
  confirm is refused and the claim stays pending with its code.
- **Held until Unlock approval (3.1.0 plan, Access).** A claim confirmed for a member not yet approved
  in Unlock grants nothing at the time: it is confirmed with `credits_granted = 0` and stamped
  `credits_held_at`. The member's history says "Your thank-you credits arrive once Unlock is
  approved." and the admin queue says the credits are held. When Unlock approves the member, the
  approval catch-up (`runUnlockApprovalCatchUp` → `grantHeldContributionCredits`) grants each held
  claim under the same rate, yearly limit and idempotency key a confirm uses, and clears the stamp.
  The gift card form says the credits arrive once Unlock is finished.
- **Reject** grants nothing. Both confirm and reject erase the stored code in the same statement.
- **Settings.** Two numbers under ServiceCredits: "Credits per dollar" (default 10) and "Most
  credits per member over 365 days" (default 300). Both must be positive.

## 5. API Surface and Route Map

- `POST /api/contributions/submission` — Send a gift card (any signed-in member). Body
  `{ claimedAmountUsd, code }`. The code is sealed before it is stored and never returned, logged
  or audited. 400 `contributions_invalid_amount` / `contributions_invalid_code` /
  `contributions_invalid_payload`; 503 `contributions_paused` when `CONTRIBUTIONS_CODE_KEY` is
  unset.
- `GET /api/contributions/submission` — The member's own claims (newest first, up to 100), plus
  `open` (whether gift cards are being taken), `minUsd` 1, `maxUsd` 500 and the live
  `creditsPerUsd`.
- `GET /api/contributions/admin/submissions` — Admin review queue (`?status=` and `?limit=`,
  clamped to 100). Each item carries `hasCode`; never the code.
- `POST /api/contributions/admin/submissions/[submissionId]/code` — Reveal one claim's gift card
  code to the admin (`Cache-Control: no-store`). Audited as `contributions.admin.code.reveal` with
  metadata `{ targetUserId, revealed }`, never the code. 404 `contributions_not_found`; 409
  `contributions_code_unavailable` with the reason when there is no code to show.
- `POST /api/contributions/admin/submissions/[submissionId]/review` — Confirm or reject (body:
  `action`, `confirmedAmountUsd` for confirm, optional `reviewNote`). Erases the code. 409
  `contributions_already_reviewed`; 409 `contributions_mint_budget_exceeded` (the claim stays
  pending).
- `GET /api/contributions/admin/config` / `PUT /api/contributions/admin/config` — Settings
  (`creditsPerUsd`, `perUserYearCreditCap`).

Removed 2026-10-27: `/api/contributions/fundraiser`, `/api/contributions/banner/dismiss`,
`/api/contributions/admin/cycles` and `/api/contributions/admin/cycles/[cycleId]`.

All mutating routes require the `x-ctf-csrf: 1` confirmation header (same-origin enforced).
User routes gate on `evaluatePluginAccess({ minUnlockTier: 'any_authenticated' })`; admin routes
additionally require the admin role (`ensureContributionsAdmin`).

## 6. Data Model and Storage Contracts

- Table: `contributions_submissions` — gift card claims.
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id TEXT NOT NULL`
  - `kind TEXT NOT NULL` CHECK in (`gift_card`, `quora_comment`, `github_star`). New claims are
    always `gift_card`; the other two remain only on claims made before 2026-10-27.
  - `method TEXT` (`amazon` on every new claim; older rows may carry `apple` or `dennys`)
  - `claimed_amount_usd NUMERIC` (validated as an integer, 1 to 500; the column stays
    unconstrained `NUMERIC` so older rows keep their exact value)
  - `gift_card_code_encrypted TEXT` — the code sealed with AES-256-GCM, stored as
    `v1.<iv>.<tag>.<ciphertext>` (base64url). The key is the SHA-256 of the server-only
    `CONTRIBUTIONS_CODE_KEY` (at least 32 characters); the member's account id is bound in as
    additional data, so a code copied onto another member's row does not decrypt. Set to NULL on
    review. Never selected into a list; queries read only whether it is present (`has_code`).
  - `status TEXT NOT NULL DEFAULT 'pending'` CHECK in (`pending`, `confirmed`, `rejected`)
  - `confirmed_amount_usd NUMERIC`, `credits_granted NUMERIC NOT NULL DEFAULT 0`,
    `credit_governance_event_id TEXT` (the service-credits governance event backing the grant)
  - `credits_held_at TIMESTAMPTZ` (`post/0076`): set when the claim was confirmed while the member was
    not yet approved in Unlock; cleared when the approval catch-up grants the credits. Partial index
    `idx_contributions_submissions_held` on `user_id` where it is set.
  - `reviewed_by_user_id TEXT`, `reviewed_at TIMESTAMPTZ`, `review_note TEXT`
  - `created_at`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Indexes: `idx_contributions_submissions_user (user_id)`,
    `idx_contributions_submissions_status (status)`
  - CHECK `contributions_submissions_amounts_check` (`claimed_amount_usd`/`confirmed_amount_usd`
    null-or-`>= 0`; `credits_granted >= 0`)
- Table: `contributions_runtime_config` — singleton (`id BOOLEAN PRIMARY KEY DEFAULT TRUE`).
  - `credits_per_usd NUMERIC NOT NULL DEFAULT 10`
  - `per_user_year_credit_cap NUMERIC NOT NULL DEFAULT 300` (most thank-you credits one member is
    granted over the last 365 days)
  - `updated_by_user_id TEXT`, `updated_at`
  - CHECK `contributions_runtime_config_positive_check` (`credits_per_usd > 0` and
    `per_user_year_credit_cap > 0`)
- Table: `contributions_audit_log` — plugin audit trail.
  - `id UUID PRIMARY KEY`, `actor_user_id TEXT`, `action TEXT NOT NULL`,
    `target_submission_id UUID`, `metadata JSONB NOT NULL DEFAULT '{}'`, `created_at`
  - Logged: `contributions.submission.create`, `contributions.admin.submission.list`,
    `contributions.admin.code.reveal`, `contributions.admin.submission.confirm`,
    `contributions.admin.submission.reject`, `contributions.admin.config.update`. A gift card code
    never enters metadata.
- Dropped 2026-10-27 by `ctf/db/migrations/post/0075_contributions_gift_cards_only.sql` (and the
  demo schema's copies): the tables `contributions_cycles` and `contributions_banner_state`; the
  submission columns `signal_contact`, `quora_post_url`, `github_profile_url` and `cycle_id` with
  their Signal check and cycle foreign key; the config columns `non_monetary_unit_value_usd`,
  `banner_snooze_months`, `banner_enabled` and `signal_instructions`. `per_user_cycle_credit_cap`
  became `per_user_year_credit_cap`, keeping its value. Quora comment and GitHub star claims still
  pending were closed as rejected with a note saying Contributions now takes Amazon gift cards
  only.

All DDL is guarded (`CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE IF EXISTS ... ADD COLUMN IF
NOT EXISTS` per column) in `ctf/schema.sql`; the demo schema is regenerated into
`ctf/schema.demo.sql`.

## 7. Security, Privacy, and Compliance Controls

- **The gift card code is encrypted at rest and erased on review.** AES-256-GCM with a fresh
  random IV per code, key from `CONTRIBUTIONS_CODE_KEY` (server-only, kept in Infisical, never
  logged), the member's account id bound in. The member never sees it again after sending; it is
  never in a list response, a log line or an audit row. The admin reads one claim's code at a time
  through a POST that is audited and not cached. Confirm or reject sets the column to NULL in the
  same statement that records the review.
- **Paused without a key.** When `CONTRIBUTIONS_CODE_KEY` is unset or shorter than 32 characters
  the app takes no codes: the member screen shows the paused card and the submission route answers
  503 `contributions_paused` instead of storing a code it could not protect. Changing the key
  leaves codes still waiting for review unreadable; the reveal says so on each one.
- **Credits are thank-you grants, never redeemable for money.** The credits-per-dollar rate is a
  setting. Noted risk: publishing a credits-per-dollar number can read as a fixed rate against
  money; the framing everywhere stays "thank-you", and the setting exists so the owner can tune it.
- **Yearly credit cap** (default 300 credits per member over the last 365 days) stops a member
  turning gift cards into outsized credit holdings. The credits already granted are the larger of
  two sums over the last 365 days: confirmed `credits_granted` on the member's claims, and the
  kept ServiceCredits grants (`service_credits_governance_events`, `mint_grant`, reason
  `contributions_confirmed`). The second means deleting Contributions data and sending again does
  not reset the cap. Rounded after the clamp, never before, so rounding cannot push a grant over.
- **Unlock boundary:** no `unlock_*` reads or writes; user routes gate at
  `minUnlockTier: 'any_authenticated'`; contributing never changes any access tier.
- **Integrity:** confirmation is exactly-once (row locked, must be `pending`); grants go only
  through the canonical `mintGrant()` with idempotency key `contribution-<submissionId>` and
  ticket `contribution-<submissionId>:gift_card`; Contributions never writes `service_credits_*`
  tables directly.
- CSRF: every mutation, including the code reveal, requires the `x-ctf-csrf: 1` header. When both
  the app URL and the request `Origin` header are present they must match host-for-host; when
  either is absent the check passes, matching the repo convention. The required header is what
  blocks browser CSRF.
- Request bodies on mutations are parsed through a shared `parseJsonObject` guard that rejects
  null, arrays, and primitives with `400 contributions_invalid_payload`. The admin queue `limit` is
  validated as a positive integer and clamped to 100. Path ids must be UUIDs.
- Audit writes are best-effort: an audit-only failure is reported and swallowed, never turning a
  successful mutation (or its idempotent credit grant) into a 5xx that a client would retry.
- Contracts: see
  [CONTRIBUTIONS_PLUGIN_COMMAND_CONTRACTS.yaml](../../contracts/CONTRIBUTIONS_PLUGIN_COMMAND_CONTRACTS.yaml),
  [CONTRIBUTIONS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/CONTRIBUTIONS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml),
  [CONTRIBUTIONS_PLUGIN_AUDIT_CONTRACTS.yaml](../../contracts/CONTRIBUTIONS_PLUGIN_AUDIT_CONTRACTS.yaml),
  [CONTRIBUTIONS_PROFILE_AND_DELETION_CONTRACT.md](../../contracts/CONTRIBUTIONS_PROFILE_AND_DELETION_CONTRACT.md).
- Account deletion wiring: registered in `lib/account/deletion-registry.ts` with
  `serviceScopeSupported: true` — delete `contributions_submissions` by `user_id` (including any
  code still waiting for review); retain `contributions_audit_log` (no codes in it) and
  `contributions_runtime_config`. Granted credits follow the ServiceCredits policy.

## 8. Web and Android Delivery Status

- Web: **shipped**. The registry entry is `isVisible: true`, `availabilityState:
  implemented_shell`. The member screen is `app/apps/contributions/page.tsx` (gating on
  `any_authenticated`) with components under `components/contributions/`: the shell with the
  Contribute and My history tabs (`contributions-shell.tsx`), the gift card form and paused card
  (`contributions-gift-form.tsx`), the history list and empty state (`contributions-history.tsx`),
  and the signed-out view (`contributions-public-shell.tsx`). The admin screen is
  `app/admin/contributions/page.tsx` with `components/contributions/admin/` (queue with the code
  reveal, and settings). Phone-width layout only (rule 105).
- Removed 2026-10-27: the fundraiser banner, the 🎁 gift chip in the Commons chip rail, the drive
  card and progress bars, the Quora comment and GitHub star paths, the Signal confirmation screen,
  and the admin Drive tab.
- Android: **surface removed 2026-07-20 (rule 105, PR #1742)** — web-only, served by the
  installable web app (PWA).
- Parity: `config/plugin-parity-contracts.json` still carries the `contributions` entry; the plugin is
  web-only per rule 105.

## 9. Seed Coverage Status

- Seed: [scripts/seedContributionsPhase0.mjs](../../../scripts/seedContributionsPhase0.mjs)
  (the `Phase0` suffix is the established seed-script naming convention). Deterministic and
  idempotent (fixed UUIDs, upserts). Seeds the settings singleton (10 credits per dollar, 300 over
  365 days) and three Amazon gift card claims: pending ($25), confirmed ($10, 100 credits) and
  rejected ($15, "the code did not redeem"). No claim carries a code: the seed has no encryption
  key, so the pending one shows "No code is stored for this claim."
- Demo schema: `seedContributions` in `ctf/scripts/seedDemo.mjs` gives each personal demo account
  one confirmed Amazon gift card ($10, 100 credits) and one pending ($25), neither with a code.
  `ctf/scripts/demo-seed/33-contributions.mjs` hands both claims back to the account they are
  seeded for and deletes the Signal-era gift card claim it seeded before 2026-10-27.
- Known seed limitation: the confirmed rows record `credits_granted` for display but have no
  backing governance event (`credit_governance_event_id` is null) because seeding does not run the
  real mint path.

## 10. Gaps and Known Technical Debt

- A seeded or demo pending claim has no code, so the code reveal cannot be shown end to end on
  seed data; it needs a claim sent through the app with `CONTRIBUTIONS_CODE_KEY` set.
- Rotating `CONTRIBUTIONS_CODE_KEY` leaves every code still waiting for review unreadable. The
  reveal says so; such a claim can only be rejected, or confirmed after the member sends the code
  again.
- The confirmed seed rows are display-only (no ledger event behind them); anyone reconciling seed
  data against the credits ledger should expect that gap.
- Metrics are registered in `canonical_metrics.yaml` as calculation definitions; no dashboard
  wiring yet.

## Change Log

- 2026-10-28: **Thank-you credits held until Unlock approval (3.1.0 plan, Access).** `credits_held_at` (`post/0076`); confirm holds the credits for a member not yet approved, and the Unlock approval catch-up grants them. Submissions carry `creditsHeld`.
- 2026-10-27: **Amazon gift cards only, open all year (3.1.0 plan, Contributions row; owner-approved plan `ctf/docs/developer/SOCIAL_REDESIGN_3_1_PLAN.md`).** Contributions no longer runs drives. There are no goals, progress bars or banner, and the 🎁 gift chip in the Commons chip rail is gone. Quora comment and GitHub star claims are gone: older rows keep their kind, and pending ones were closed as rejected with a note. The member now types the gift card code in the app instead of sending it over Signal, so the Signal contact field, the owner's Signal link and the Signal instructions are gone. The code is stored encrypted (AES-256-GCM, key from `CONTRIBUTIONS_CODE_KEY`, the member's account id bound in), shown to the admin one claim at a time through the new audited `POST /api/contributions/admin/submissions/[submissionId]/code`, and erased when the claim is confirmed or rejected. Without the key the form shows a paused card and nothing is stored. The thank-you credit cap now runs over the last 365 days (`per_user_year_credit_cap`, carrying the old per-drive value) instead of per drive. Routes removed: `/api/contributions/fundraiser`, `/api/contributions/banner/dismiss`, `/api/contributions/admin/cycles`, `/api/contributions/admin/cycles/[cycleId]`. Migration `post/0075_contributions_gift_cards_only.sql` drops `contributions_cycles`, `contributions_banner_state` and the Signal, link, drive and banner columns. The Expenses screen's suggested-drive-goal card is gone. The twice-yearly "Contribute if you can" post is unchanged. Admin screens are called System Architect in member copy. Contracts, test script and guide section rewritten to match.
- 2026-10-17: **Deleting Contributions data no longer resets the star limit or the drive cap (#2977, owner decision).** Both read only `contributions_submissions`, which a Contributions deletion removes while the credits stay granted. They now also read the kept ServiceCredits grant record (`service_credits_governance_events`, `mint_grant`, reason `contributions_confirmed`): a grant's ticket is now `contribution-<submissionId>:<kind>:<cycleId or none>`, the star check looks for a kept `github_star` grant, and the drive cap uses the larger of the submissions total and the kept grants for that drive. The idempotency key is unchanged. Grants made before this change carry only the submission id and are counted from the submissions alone. No schema change. Test script CT-KEPT.
- 2026-10-17: **Demo seed hands the Quora comment and GitHub star claims back to their account** (`ctf/scripts/demo-seed/33-contributions.mjs`). `seedDemo.mjs` keeps the owner's fixed claim ids and its upsert leaves `user_id` alone, so a demo schema first seeded with a different `DEMO_OWNER_ID` kept both claims under that earlier account: My history showed no Confirmed claim and the star was not shown as thanked (CONT-6, CONT-8). Demo data only; no route, schema or screen change.
- 2026-10-17: **Demo seed adds a gift-card claim and a credited star** (`ctf/scripts/demo-seed/33-contributions.mjs`),
  so My history shows three claims and the GitHub star path reads as already credited in the demo
  schema. No route, schema or contract change.
- 2026-10-15: **The link edited on review is saved (owner decision; issue #2980).** The review panel
  let the admin edit the Quora post or GitHub profile link, but `confirm()` and `reject()` never
  sent it and the review route had no field for it, so a pasted link was dropped. The review
  command now takes an optional `url`, checked as an http(s) link and written to `quora_post_url`
  or `github_profile_url` in the same transaction as the review. The panel sends it only when the
  admin changed it, so an untouched field never rewrites the member's link; a blank field keeps
  it. A link sent for a gift card is refused. No schema change: both columns already existed.

- 2026-10-06: **Only real money counts as money given (owner decision; issue #2982).** Outside this
  plugin, the Weekly Performance card `value.contributions_confirmed_usd`, the registry metric
  `wp_value_contributions_confirmed_usd`, and Contributor Access read `confirmed_amount_usd` over
  every confirmed submission, so the set value of a Quora comment or GitHub star
  (`non_monetary_unit_value_usd`) was counted as a confirmed dollar. Those readers now restrict the
  dollar sum to `kind = 'gift_card'`, the same rule the drive's own money total
  (`fetchCycleProgress`) and the `contributions_fiat_confirmed_total` /
  `contributions_cycle_fiat_confirmed` metrics already followed. Comments and stars are counted on
  their own, never as dollars; Contributor Access scores them exactly as before (its inventory has
  the detail). No change to this plugin's routes, schema, contracts, or credit grants.

- 2026-10-05: **A confirm refused by the ServiceCredits mint budget now says so (#2979).** When the
  per-period mint budget is turned on and a confirm's thank-you credit grant would go over it,
  `mintGrant` refuses with `mint_budget_exceeded`. The review route did not recognize that code and
  answered 503 "Contribution review unavailable.", which read as an outage and pointed nowhere. It
  now answers 409 `contributions_mint_budget_exceeded` with a message that the budget for this period
  is used up and the contribution is still pending, and the refusal is no longer sent to the error
  report as an incident. The review transaction already rolled back, so nothing about what is stored
  changes. Command contract updated with the refusal.
- 2026-10-05: **A new drive can be started after the last one ends (#2978), and the member screens
  leave a trace when they fail (#2981).** The admin Drive tab picked the most recent drive when none
  was active, including one that had already ended, so Save sent a PUT that reopened it with last
  drive's confirmed rows and granted credits still counting toward progress and the per-member cap.
  It now picks only an active or upcoming drive, and with neither it shows "Start a drive" and Save
  creates a new one. On the member side, a failed drive load or submission now shows what the route
  said instead of a fixed sentence, and a request that never answered is reported. The banner and
  gift reminder fundraiser reads report network failures and non-OK answers (401 and 403 excepted,
  which only mean this viewer has no access right now), and the "Not now" snooze write now checks the
  response and reports a refusal; the banner still collapses for the session either way. No route,
  schema, or contract change.
- 2026-08-09: **Gift-card claims are integer dollars, $1 to $500, and credit grants are rounded**
  (owner decision, from the #2141 review discussion). Two independent changes, made together because
  they were raised together:
  - `GIFT_CARD_MIN_USD` moves from 0 to 1 and `isValidGiftCardAmount` now requires an integer, so
    `$0.001` and `$12.50` are both refused where before anything above zero was accepted. Real gift
    cards are not sold in parts of a dollar, so nothing real is being turned away. The admin confirm
    path applies the same rule, because the admin records what was actually redeemed and that can
    differ from the claim. The member form and the admin field state the rule up front instead of
    letting a member find it on submit, and the two error strings in `_lib.ts` were rewritten to
    match.
  - `computeCycleCappedGrant` rounds the grant after the cap clamp (rounded, not truncated, so the
    member gets the nearer number; after, not before, so rounding cannot push a grant back over the
    cap). This — not the integer-dollar rule — is what actually guarantees integer credits: the
    credits-per-dollar rate is admin-set with no requirement to divide evenly into a dollar, the cap
    can be fractional, and the `NUMERIC` columns involved carry any fraction through to the ledger
    exactly. A grant that rounds to 0 confirms with `credits_granted = 0`, the same outcome the cap
    clamp already produced.

  No schema change: both columns stay `NUMERIC`, and existing rows with fractional grants are left
  as they are. New test case CONT-3b covers the integer-dollar rule and the rounding.
- 2026-08-09: Opening the admin Drive tab before the cycle finished loading could wipe all three
  goals (#2137), and the contract now says plainly that the web form requires a contribution link
  even though the command does not (#2140). The drive form seeds its three goal inputs with
  `useState`, which reads the cycle only on the component's first render. The admin dashboard fetches
  the cycle after mount and opens on the review queue, so an admin who reached the Drive tab before
  that fetch landed saw three empty boxes — and saving an empty box sends `0`, which the update's
  `COALESCE` treats as a real value and writes over the stored goal. `ContributionsAdminDrive` is now
  keyed on the cycle id in `contributions-admin-shell.tsx`, so it remounts with the loaded values the
  moment the cycle arrives. Nothing about `0` itself changed: an admin who deliberately types 0 still
  gets a goal of 0, which is a legitimate setting. Separately,
  `CONTRIBUTIONS_PLUGIN_COMMAND_CONTRACTS.yaml` now records why `quoraPostUrl` / `githubProfileUrl`
  are optional on `contributions.submission.create` while the web form still insists on them — the
  owner can record a link during review, but a member-submitted claim with no link cannot be found
  and confirmed. Contract text only; no behavior, schema, or route change from either.
- 2026-08-09: The star count on the cycle progress bar now counts members, not rows (#2143), and
  dismissing the banner no longer hands back the snooze date (#2144). A GitHub star earns credits at
  most once per member ever, and the block that enforces it at submission time only looks at stars
  that have already been confirmed — so a member who sends two before either is reviewed ends up with
  two confirmed star rows, the second granting 0 credits. `fetchCycleProgress`
  (`lib/contributions/repository.ts`) counted rows, so that member showed up twice and the community
  star total read higher than the number of people who actually starred. It now counts distinct
  members for stars (`COUNT(DISTINCT user_id) FILTER (WHERE kind = 'github_star')`). Quora comments
  stay a row count on purpose: they are repeatable, and each confirmed comment is a separate real
  contribution. Separately, `dismissBanner` returned `{ snoozedUntil }` from a `RETURNING` clause even
  though the route threw it away — the command contract says the snooze length is internal and is not
  returned to the member, so the function now returns nothing and the `RETURNING` clause is gone. No
  member-visible change from the dismiss edit; no schema, route, or contract change from either.
- 2026-08-09: **Gift reminder moved out of the top bar and into the Commons chip row (owner report:
  the top bar was crowded on an iPhone SE).** `ContributionsGiftTrigger` is no longer mounted by
  `community-shell.tsx`; it now renders in `ConciergeChipRail` (`shell-chat-panel.tsx`) immediately
  after the 🔔 notifications chip, styled by a new `.contributeGiftBtn` chip class (violet accent,
  same size as the @ / 📣 / 🔔 pills, with a comic-theme variant). The component takes a `className` prop
  instead of carrying its old inline top-bar box style. When it shows and where it goes on tap are
  unchanged: only while a drive is running and the full banner is dismissed or snoozed, and it opens
  `/apps/contributions`. UI-only — no route, schema, or contract change.
- 2026-08-07: Admin settings audit rows now record which settings the admin actually sent. The
  audit write in `app/api/contributions/admin/config/route.ts` logged every setting's resulting
  value, so a record could not show whether a knob was edited or merely carried over. The route now
  computes `changedKnobs` from the fields present in the request body (the list the audit contract
  already declares) and keeps the resulting values under `resultingConfig`. No schema, route, or
  contract change.
- 2026-08-06: Submission review audit rows now record the reviewed member. The confirm/reject audit
  write in `app/api/contributions/admin/submissions/[submissionId]/review/route.ts` passed only the
  admin (`actorUserId`), so the `targetUserId` the audit contract declares for
  `contributions.admin.submission.confirm` / `.reject` was never stored. The member's id is now
  written as `targetUserId` inside the audit `metadata` object (the `contributions_audit_log` table
  keeps its existing columns — no schema or contract change).
- 2026-07-19: Banner dismiss snooze shortened from six months to **two** (owner request). Changed the
  `banner_snooze_months` default in `schema.sql` / `schema.demo.sql` (6 → 2), the `DEFAULT_CONFIG`
  fallback in `repository.ts`, and the demo seed, and added a one-time data migration
  (`UPDATE contributions_runtime_config SET banner_snooze_months = 2 WHERE banner_snooze_months = 6`)
  so the already-created production config row moves off the old default too. The value is internal
  (never surfaced to members). No contract or new-table change.
- 2026-07-19: **Phone gift reminder moved into the top bar (owner report: the collapsed strip read
  as wasted space).** After dismissing the fundraiser banner on phone width, the 🎁 reminder now
  renders in the top bar between the SE mark and the section tabs (`ContributionsGiftTrigger` in
  `contributions-banner.tsx`, mounted by `community-shell.tsx`) instead of keeping a dedicated
  strip where the banner was. The open banner is unchanged and stays at the top of the content
  area; desktop dismiss behavior is unchanged (nothing until the snooze lapses). UI-only.

- 2026-07-18: Phone-width fundraiser banner is dismissible again and collapses to a subtle emoji
  (owner request). The "Not now" dismiss control is restored on both layouts. On phone width,
  dismissing no longer removes the reminder — the full banner collapses to a small gift emoji (🎁) in
  its place that opens the plugin, so it stays a subtle nudge without taking up space; the full banner
  returns when the snooze lapses. On desktop, dismissing hides it until the snooze lapses (no emoji).
  The fundraiser snapshot now also returns `bannerEnabled` (feature on/off, independent of the
  per-member snooze) so the phone-width UI can tell "snoozed" (show the emoji) from "turned off" (show
  nothing). Fundraiser command contract `outputSchema` updated. No database schema change.
- 2026-07-17: **Admin↔member navigation (app-wide sweep).** The admin surface header gained the
  shared "Member view" pill (`PluginUserShellButton`) linking to `/apps/contributions`. The member
  shell header now shows the shared Admin shortcut (`PluginAdminButton`, admins only). UI-only; no
  schema, route, or contract change.
- 2026-07-14: Added refresh controls (app-wide refresh rollout). Web: the shared `RefreshButton` now
  sits next to the desktop drive heading and in the mobile-responsive frame's title band (the shared
  `MobileScreenHeader` cannot carry per-shell actions), wired to the shell's existing `loadData`
  reload, which re-pulls the fundraiser and the member's submissions without the full-screen loading
  state. Android: native pull-to-refresh via `RefreshControl` on the `Contributions` screen's
  `ScrollView`, wired to a new background variant of `load`. UI-only; no schema, route, or contract
  change.
- 2026-07-01: Member credit valuations now come from the live config (owner-reported bug). The member
  cards and disclaimer showed a hardcoded "50 SC" per comment/star while the admin "Credits per comment
  or star" setting was 10. The fundraiser route (`GET /api/contributions/fundraiser`) now returns
  `creditsPerUsd` and `creditsPerActionSc` (= `nonMonetaryUnitValueUsd × creditsPerUsd`), and the web
  and Android member surfaces render those instead of hardcoded defaults, so the copy always matches
  the settings screen. Fundraiser command contract `outputSchema` updated. No schema change.
- 2026-07-01: Trackability + Commons safety pass (owner feedback). (1) The Quora comment link and the
  GitHub profile link are now **required** on submit (web + Android) — without them the owner cannot
  find and confirm the contribution. Each field shows a help line: if you cannot find the link, ask in
  the Commons (the group chat). (2) Corrected copy that pointed members to a non-existent "#support
  channel in the Hub": there is one channel, the Commons. The post-submit confirmation now points
  questions to the Commons and carries a prominent warning to **never post a gift card code in the
  Commons** (it is a public group chat — doing so means no ServiceCredits and the owner never receives
  the gift; codes go only to the owner on Signal). The gift-card form carries the same warning. (3) On
  desktop, removed the "My contributions" left-nav item — the member's contributions already show
  permanently in the right rail, so the item only scrolled to something already on screen. The mobile
  "My history" tab is unchanged. Presentation/copy only — no route, schema, or contract change.
- 2026-07-01: Contribute-flow copy and cleanup pass (owner feedback). (1) Fixed "50SC" running
  together in the credits disclaimer — the inline JSX interpolation dropped the space where the card
  template literals did not, so both amounts are now built as template literals (`{`${creditsPerUsd} SC`}` /
  `{`${creditsPerAction} SC`}`) and render "10 SC" / "50 SC". (2) Added a line to the gift-card form
  (web + Android) stating the card can be physical or digital and that the card details go to the owner
  in the Signal chat, never in the form. (3) Removed the "Choose one of the three ways above…"
  placeholder box under the cards — it read as confusing; the form now simply opens when a card is
  chosen (the cards' own "Choose this" cue is the prompt). Presentation/copy only — no route, schema,
  or contract change.
- 2026-07-01: Made the contribute action discoverable. The three path cards ("How would you like to
  help?") were click-to-expand `role="button"` divs with no visual cue that they open anything, and on
  web the chosen path's form rendered at the very bottom of the section — below the credits
  disclaimer — so it read as disconnected from the card and easy to miss. Added a one-line instruction
  under the heading, a per-card "Choose this ⌄ / Selected" affordance (`components/contributions/contributions-paths.tsx`),
  moved the form to render directly under the cards (above the disclaimer), and added a dashed
  placeholder prompt when no path is selected so the screen never looks like a dead end. Mirrored the
  instruction and the "Choose this" cue on the Android app (`packages/mobile/src/features/contributions/Contributions.tsx`),
  which already rendered each form directly under its card. Presentation only — no route, schema, or
  contract change.
- 2026-07-01: Hid the fundraiser banner's "Not now" dismiss button on web (owner request). Gated both
  layouts (desktop and phone-width) behind a new `SHOW_DISMISS_BUTTON` flag in
  `components/contributions/contributions-banner.tsx`, defaulting to hidden. The button markup and the
  `onDismiss` snooze handler (POST `/api/contributions/banner/dismiss`) are kept in place — nothing was
  deleted — so the control can be restored by flipping the flag. Presentation only; no route, schema,
  or contract change. The Android app has no fundraiser banner, so nothing changed there.
- 2026-07-01: Fixed the Contribute button (fundraiser banner) landing on a 404. The banner sends
  members to `/apps/contributions`, but the dedicated page calls `notFound()` when the registry row
  is not visible, and the DB registry seed in `ctf/schema.sql` (and `ctf/schema.demo.sql`) still
  carried the pre-UI values `availability_state = 'alpha'`, `is_visible = FALSE`. Because the seed
  upserts with `ON CONFLICT DO UPDATE`, every deploy forced the production row back to hidden even
  though `repository.ts` and this inventory both declare it visible. Aligned both schema seeds to
  `'implemented_shell'`, `TRUE`, matching the code registry so the page resolves. Seed/data only —
  no route, contract, or component change.
- 2026-06-18: Fixed the admin Drive form overflowing on mobile (`contributions-admin-drive.tsx`). Each goal row was a fixed `display:flex` with a non-shrinking 180px label plus a fixed-width input, so the fields ran off the screen on a phone. The goal rows now stack the label over a full-width input on mobile (`isMobile`); desktop keeps the inline row. Presentation only — no route, schema, or contract change.
- 2026-06-18: Changed the Contributions plugin icon from `Heart` to `Gift` across the shell, public shell, banner, and admin shell (`components/contributions/**`). The heart duplicated the app brand logo (also a heart); `Gift` is distinct and fits the fundraiser/gift-drive purpose. Icon swap only — no copy, route, schema, or contract change.
- 2026-06-12: Android API client (`ContributionsApi.ts`) now calls the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. No backend, schema, or contract change.
- 2026-06-10: UI build + two owner-requested backend rules. Shipped the full Contributions UI on
  web and Android from the approved design mockups (issue #393): the member surfaces (signed-out
  public shell, loading, main drive/contribute/history, post-submit confirmation, empty history) at
  `app/apps/contributions` gating on `any_authenticated`; the owner-only admin dashboard (queue, drive
  management, settings) at `app/admin/contributions`; and the app-wide, non-blocking fundraiser
  banner integrated into the Hub shell. Built the matching Android feature at
  `packages/mobile/src/features/contributions/`. Flipped the registry entry to `isVisible: true`,
  `availabilityState: implemented_shell`. Two backend rules added with no schema change: (1) a
  `github_star` is creditable at most once per member ever — enforced at submission create (409
  `contributions_github_star_already_credited`) and again at review confirm (duplicate star confirms
  with 0 credits, reason recorded, mint never called); the fundraiser response now carries
  `githubStarAlreadyCredited` and the UI grays out the star path. (2) Added a server-only
  `CONTRIBUTIONS_OWNER_SIGNAL_URL` env var (Infisical-managed, never `NEXT_PUBLIC_`, never logged),
  surfaced as `ownerSignalUrl` on the fundraiser response and shown inline on the confirmation
  screen, falling back to the editable `signal_instructions` copy when unset. Updated rule 123 and
  the fundraiser command contract `outputSchema`.
- 2026-06-10: Review hardening pass. Added database integrity constraints (CHECKs for positive
  config knobs; cycle window `ends_at > starts_at` and non-negative goals; submission amounts
  null-or-non-negative and `credits_granted >= 0`; a gift-card claim must carry a Signal contact)
  plus a foreign key from `contributions_submissions.cycle_id` to `contributions_cycles(id)` with
  the column left **nullable**. Corrected the `contributions_cycle_fiat_confirmed` metric to read
  the single current cycle (CTE) instead of summing across all overlapping cycles. Reconciled the
  contracts with the implemented routes: audit contract now lists the real
  `contributions.admin.submission.confirm`/`.reject` actions (was a single `.review`), and every
  command `outputSchema` mirrors the actual `{ ok, ... }` response wrappers. Hardened the API:
  shared `parseJsonObject` body guard on all mutations, positive-integer clamp on the admin queue
  `limit`, a code comment recording the fail-open-on-missing-Origin CSRF convention, and
  best-effort audit logging so an audit failure can no longer 5xx a successful mutation.
- 2026-06-10: Non-UI foundation. Schema (`contributions_cycles`, `contributions_submissions`,
  `contributions_runtime_config`, `contributions_banner_state`, `contributions_audit_log`),
  command/access/audit/deletion contracts, web library (`types.ts`, `repository.ts`,
  `policy.ts`), full `/api/contributions/*` surface (member submission/status/fundraiser/banner +
  admin review/config/cycles), five canonical metrics, deterministic seed, plugin registry entry
  (hidden, alpha), and account-deletion registry wiring. UI deferred behind the design pass.

## Build Checklist

Flat ordered list; each item names what blocks it.

1. [x] Schema: the five `contributions_*` tables with guarded DDL + demo schema regeneration.
2. [x] Contracts: command, access policy, audit, profile-and-deletion. (Blocked by 1 for table
   names.)
3. [x] Web library: `lib/contributions/types.ts`, `repository.ts` (validation, fundraiser
   snapshot, exactly-once review + capped `mintGrant()` flow), `policy.ts`. (Blocked by 1.)
4. [x] API routes: member submission/status, fundraiser, banner dismiss; admin queue, review,
   config, cycles — with CSRF and audit writes. (Blocked by 3.)
5. [x] Canonical metrics: the five `contributions_*` metric definitions. (Blocked by 1.)
6. [x] Seed: `scripts/seedContributionsPhase0.mjs`. (Blocked by 1.)
7. [x] Plugin registry entries (schema seed + `repository.ts` fallback), hidden until the UI
   ships. (No dependencies; done with 1.)
8. [x] Account-deletion registry entry for the two per-user tables. (Blocked by 1.)
9. [x] Feature inventory (this document). (Blocked by all of the above.)
10. [x] Member web shell at `/apps/contributions` (submit flows, history, collective progress).
11. [x] Web route registration `app/apps/contributions/page.tsx` (gating on `any_authenticated`).
12. [x] Admin surface (review queue, drive management, settings) at `app/admin/contributions`.
13. [x] Fundraiser banner surface (collective progress + silent dismiss), integrated into the Hub
    shell non-blocking for signed-in members.
14. [x] Android/Expo feature at `packages/mobile/src/features/contributions/` (member + admin).
15. [x] Flip the registry entry to `isVisible: true` (`availabilityState: implemented_shell`).
16. [x] Gift cards only, open all year (2026-10-27): encrypted code entered in the app, admin code
    reveal, paused card without `CONTRIBUTIONS_CODE_KEY`, 365-day cap; drives, banner, Quora and
    GitHub paths and Signal removed with migration `post/0075`. (No dependencies.)
