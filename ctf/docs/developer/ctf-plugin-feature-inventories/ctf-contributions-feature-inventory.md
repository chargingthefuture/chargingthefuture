# Contributions Plugin Feature Inventory

## 1. Scope and Boundary

- Plugin slug: `contributions`
- Contributions owns voluntary fundraiser drives: members who are able can chip in toward the
  platform's real infrastructure costs (Railway/Render and similar bills, which the owner pays
  personally in real money), and the platform thanks them with ServiceCredits.
- Surfaces it owns:
  - All `/api/contributions/*` routes and the `contributions_*` tables.
  - The future member surface at `/apps/contributions`, the future admin surface, and the future
    fundraiser banner — all design-gated and not yet built (foundation only today).
- Explicitly does **not** own:
  - Any `unlock_*` table or any part of Unlock verification. Contributions never reads or writes
    Unlock data and never affects access tiers. It is a completely separate plugin from Unlock
    (which is Quora social-proof verification that keeps bad actors out).
  - The ServiceCredits ledger. Thank-you grants are delegated to the service-credits plugin's
    canonical `mintGrant()`; Contributions never writes `service_credits_*` tables directly.
- Owner decision to remember (2026-06-10, deliberate and active): a not-yet-verified member CAN
  contribute and hold thank-you credits they cannot spend in verification-gated plugins until they
  finish Unlock. Keep this behavior. This note exists so the owner remembers it was an active
  choice, not an oversight.

## 2. Intent and Outcome

The platform serves trafficking survivors and access is free — and stays free. Contributions lets
members who are able give back, Wikipedia-style: time-boxed collective fundraiser drives (about
three months each) with shared goals on three external surfaces — gift-card money toward the
hosting bills, Quora comments, and GitHub stars. Trauma-informed framing rules, enforced in copy
and behavior:

- It is always a **collective drive**, never a personal bill. Progress is shown only as shared
  totals.
- **No shaming, ever.** Not contributing has zero consequences and is never surfaced.
- **Access is never gated on payment.** Nothing in the product is unlocked by contributing.
- Dismissing the fundraiser banner silently snoozes it for two months (a config knob, not shown to
  the member). No guilt copy, no countdown.

As a thank-you, confirmed contributions grant ServiceCredits — the platform's internal barter
token. Credits are a thank-you, **not a purchase**: they are never redeemable for real money. The
flow is one-way, like gas-station reward points.

## 3. User Features

- Submit a contribution claim of one of three kinds:
  - **Gift card** (`amazon`, `apple`, or `dennys`): the member states the amount (over 0, at most
    500 USD) and their own Signal contact (URL or phone number — reduces fraud). It can be a physical
    or a digital gift card. The gift-card **code is never collected or stored anywhere** — the member
    sends the code to the owner over Signal, outside the app. The member is warned, on both the form
    and the post-submit confirmation, to **never post the code in the Commons** (the single public
    group chat): doing so means no ServiceCredits and the owner never receives the gift. Questions and
    anything other than the code belong in the Commons.
  - **Quora comment**: the member pastes the link to their comment — **required**, because the owner
    needs it to find and confirm the contribution. If the member cannot find the link, the form points
    them to the Commons (the group chat) to ask for help rather than submitting an untrackable claim.
  - **GitHub star**: the member pastes their GitHub profile link — **required**, same reason.
- See their own claim history and statuses (pending / confirmed / rejected).
- See the current fundraiser cycle and collective progress (USD raised, comments, stars,
  contributor count) toward the owner-set goals.
- Dismiss the fundraiser banner — a silent two-month snooze. On phone width, dismissing does not
  remove the reminder entirely: the full banner collapses to a small gift emoji (🎁) in its place that
  still opens the plugin, so it stays a subtle nudge without taking up space; the full banner returns
  on its own when the snooze lapses. On desktop, dismissing hides it until the snooze lapses (no
  emoji — the slim desktop bar is already unobtrusive). If the admin turns the banner feature off,
  neither the banner nor the emoji shows.
- Open to any signed-in member: contributing requires no Unlock verification and never changes
  Unlock state.

## 4. Admin Features

- Review queue of claims, filterable by status. Only the admin projection includes the member's
  Signal contact (to match a gift-card code received over Signal to its claim).
- Confirm or reject each claim, exactly once:
  - On confirm the admin supplies the confirmed USD amount (for gift cards: what was actually
    redeemed; for comments/stars it defaults to the configured USD-equivalent unit value).
  - Credits = confirmed amount x `credits_per_usd`, clamped by the per-user-per-cycle cap; a
    positive grant goes through the canonical service-credits mint with idempotency key
    `contribution-<submissionId>`. A grant clamped to 0 still confirms with `credits_granted = 0`.
  - Rejection grants nothing.
- Create and edit fundraiser cycles (window plus the three goals).
- Edit runtime configuration: credit valuation knobs, per-cycle cap, banner on/off, banner snooze
  months, and the Signal instructions copy.
- Credit-per-action mapping in the admin settings UI: the stored model is authoritative — a
  confirmed comment or star is worth `non_monetary_unit_value_usd` USD, and credits = USD-equivalent
  x `credits_per_usd`. The settings screen presents a single "Credits per comment or star" control
  as the **resulting SC** (`non_monetary_unit_value_usd × credits_per_usd`, with a live helper
  showing the underlying USD value), and converts it back to `non_monetary_unit_value_usd` before
  saving, so the stored USD-equivalent model stays the source of truth.

## 5. API Surface and Route Map

- `POST /api/contributions/submission` — Create a contribution claim (any signed-in member).
- `GET /api/contributions/submission` — The member's own claim history.
- `GET /api/contributions/fundraiser` — Current cycle, collective progress, banner visibility for
  the viewer, the member-safe Signal instructions copy, `githubStarAlreadyCredited` (true when the
  viewer already holds a confirmed, credit-earning github_star — the UI grays out that path), and
  `ownerSignalUrl` (the owner's Signal contact from the server-only `CONTRIBUTIONS_OWNER_SIGNAL_URL`
  env var, or null to fall back to the instructions copy), and the live thank-you valuations
  `creditsPerUsd` (SC per dollar) and `creditsPerActionSc` (SC for one confirmed comment or star,
  = `nonMonetaryUnitValueUsd × creditsPerUsd`), so member copy always matches the admin settings. The
  snapshot also carries `bannerEnabled` (the banner feature on/off, independent of the per-member
  snooze in `bannerVisible`) so the phone-width banner can tell "snoozed" (show the emoji reminder)
  from "turned off" (show nothing).
- `POST /api/contributions/banner/dismiss` — Silent banner snooze (not audited).
- `GET /api/contributions/admin/submissions` — Admin review queue (`?status=` filter).
- `POST /api/contributions/admin/submissions/[submissionId]/review` — Confirm/reject (body:
  `action`, optional `confirmedAmountUsd`, optional `reviewNote`).
- `GET /api/contributions/admin/config` / `PUT /api/contributions/admin/config` — Runtime config.
- `GET /api/contributions/admin/cycles` / `POST /api/contributions/admin/cycles` — List/create
  cycles.
- `PUT /api/contributions/admin/cycles/[cycleId]` — Edit a cycle.

All mutating routes require the `x-ctf-csrf: 1` confirmation header (same-origin enforced).
User routes gate on `evaluatePluginAccess({ minUnlockTier: 'any_authenticated' })`; admin routes
additionally require the admin role (`ensureContributionsAdmin`).

## 6. Data Model and Storage Contracts

- Table: `contributions_cycles` — fundraiser drives (global, owner-managed).
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `starts_at`, `ends_at TIMESTAMPTZ NOT NULL` (the "current cycle" is the row whose window
    contains now; latest `starts_at` wins if windows overlap)
  - `fiat_goal_usd NUMERIC NOT NULL DEFAULT 0`
  - `quora_comment_goal INTEGER NOT NULL DEFAULT 0`
  - `github_star_goal INTEGER NOT NULL DEFAULT 0`
  - `created_by_user_id TEXT`, `created_at`, `updated_at`
  - Index: `idx_contributions_cycles_window (starts_at, ends_at)`
  - CHECK `contributions_cycles_window_check` (`ends_at > starts_at`)
  - CHECK `contributions_cycles_goals_check` (`fiat_goal_usd >= 0` and both goal counts `>= 0`)
- Table: `contributions_submissions` — contribution claims.
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id TEXT NOT NULL`
  - `kind TEXT NOT NULL` CHECK in (`gift_card`, `quora_comment`, `github_star`)
  - `method TEXT` (null unless gift_card; `amazon` / `apple` / `dennys`)
  - `claimed_amount_usd NUMERIC` (gift_card only; validated over 0, at most 500)
  - `signal_contact TEXT` (gift_card only; required at submit; personal data — admin-only
    projection, never logged, deleted with the account). **There is deliberately no gift-card
    code column, and validation rejects any code-like request field.**
  - `quora_post_url TEXT`, `github_profile_url TEXT` (both optional)
  - `status TEXT NOT NULL DEFAULT 'pending'` CHECK in (`pending`, `confirmed`, `rejected`)
  - `confirmed_amount_usd NUMERIC`, `credits_granted NUMERIC NOT NULL DEFAULT 0`,
    `credit_governance_event_id TEXT` (the service-credits governance event backing the grant)
  - `cycle_id UUID` (**nullable on purpose** — a claim made while no drive is active has no
    cycle), `reviewed_by_user_id TEXT`, `reviewed_at TIMESTAMPTZ`, `review_note TEXT`
  - `created_at`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Indexes: `idx_contributions_submissions_user (user_id)`,
    `idx_contributions_submissions_status (status)`
  - CHECK `contributions_submissions_amounts_check` (`claimed_amount_usd`/`confirmed_amount_usd`
    null-or-`>= 0`; `credits_granted >= 0`)
  - CHECK `contributions_submissions_gift_card_signal_check`
    (`kind <> 'gift_card' OR NULLIF(signal_contact,'') IS NOT NULL` — a gift-card claim must carry
    a Signal contact)
  - FK `contributions_submissions_cycle_id_fkey` (`cycle_id` REFERENCES
    `contributions_cycles(id)`; constrains non-null values only, column stays nullable)
- Table: `contributions_runtime_config` — singleton (`id BOOLEAN PRIMARY KEY DEFAULT TRUE`, the
  `service_credits_treasury_config` pattern; individual columns like `unlock_runtime_config`).
  - `credits_per_usd NUMERIC NOT NULL DEFAULT 10`
  - `non_monetary_unit_value_usd NUMERIC NOT NULL DEFAULT 1` (USD-equivalent of one confirmed
    comment or star)
  - `per_user_cycle_credit_cap NUMERIC NOT NULL DEFAULT 300` (300 credits = 30 USD-equivalent)
  - `banner_snooze_months INTEGER NOT NULL DEFAULT 2` (internal; never surfaced to members)
  - `banner_enabled BOOLEAN NOT NULL DEFAULT TRUE`
  - `signal_instructions TEXT NOT NULL DEFAULT ''` (owner-authored copy shown after a gift-card
    submission)
  - `updated_by_user_id TEXT`, `updated_at`
  - CHECK `contributions_runtime_config_positive_check` (`credits_per_usd`,
    `non_monetary_unit_value_usd`, `per_user_cycle_credit_cap`, `banner_snooze_months` all `> 0`)
- Table: `contributions_banner_state` — per-member banner snooze.
  - `user_id TEXT PRIMARY KEY`, `snoozed_until TIMESTAMPTZ`, `last_shown_at TIMESTAMPTZ`,
    `updated_at`
- Table: `contributions_audit_log` — plugin audit trail.
  - `id UUID PRIMARY KEY`, `actor_user_id TEXT`, `action TEXT NOT NULL`,
    `target_submission_id UUID`, `metadata JSONB NOT NULL DEFAULT '{}'`, `created_at`
  - Logged: submission created, review confirmed, review rejected, config updated, cycle
    created/updated, admin queue reads. Banner dismissal is deliberately **not** logged (low
    value, privacy). `signal_contact` values never enter metadata.

All DDL is guarded (`CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE IF EXISTS ... ADD COLUMN IF
NOT EXISTS` per column) in `ctf/schema.sql`; the demo schema is regenerated into
`ctf/schema.demo.sql`.

## 7. Security, Privacy, and Compliance Controls

- **Gift-card codes never touch the system.** No schema column, no input field, no log line. The
  member sends the code to the owner over Signal (a side channel outside the platform), and
  server-side validation rejects any request field whose name looks like a code
  (`assertNoGiftCardCodeFields`).
- **`signal_contact` is personal data.** It exists only on gift-card claims, appears only in the
  admin projection, is excluded from every audit row and log, and is deleted with the member's
  account (see the deletion contract).
- **Credits are thank-you grants, never redeemable for real money** (gas-station rewards model).
  The 10-credits-per-USD valuation and the 1-USD-equivalent for comments/stars are config knobs.
  Noted risk: publishing a credits-per-USD number can read as a fiat peg; the framing everywhere
  must stay "thank-you", and the knob exists so the owner can tune it if that risk materializes.
- **Per-cycle credit cap** (default 300 credits per member per cycle) limits pay-to-accumulate
  inequity: a wealthy member cannot convert money into outsized credit holdings inside the barter
  economy.
- **GitHub star is creditable at most once per member, ever** (anti-gaming, money-adjacent). A star
  earns credits only the first time; `hasCreditedGithubStar(userId)` is true once the member has a
  `github_star` submission that is `confirmed` with `credits_granted > 0`. A rejected star, or a
  confirmed-but-zero-credit star (e.g. one clamped to 0 by the per-cycle cap), does **not** lock the
  member out, so honest retries still work. Enforced twice: at submission create (`createSubmission`
  rejects with `github_star_already_credited` → HTTP 409
  `contributions_github_star_already_credited`), and again at review confirm
  (`reviewSubmission` grants 0 credits for a duplicate star, still marks it `confirmed`, records the
  reason in the review note, and never calls the mint path). Gift cards and Quora comments are
  unaffected (repeatable). No schema change — the rule is derived from existing rows.
- **Owner Signal URL is a server-only secret.** `CONTRIBUTIONS_OWNER_SIGNAL_URL` (read in
  `lib/contributions/owner-signal-env.ts`) holds the owner's Signal contact shown to signed-in
  members on the confirmation screen. It is **not** prefixed `NEXT_PUBLIC_`, so it never enters the
  client bundle; it is read server-side only and surfaced through the fundraiser response field
  `ownerSignalUrl`. It is never logged. When unset/empty the field is null and the UI falls back to
  the admin-editable `signal_instructions` copy. Managed in Infisical; documented in rule 123.
- **Unlock boundary:** no `unlock_*` reads or writes; user routes gate at
  `minUnlockTier: 'any_authenticated'`; contributing never changes any access tier.
- **Money-adjacent integrity:** confirmation is exactly-once (row locked, must be `pending`);
  grants go only through the canonical `mintGrant()` with idempotency key
  `contribution-<submissionId>`; Contributions never writes `service_credits_*` tables directly.
- CSRF: every mutation requires the `x-ctf-csrf: 1` header. When both the app URL and the
  request `Origin` header are present they must match host-for-host; when either is absent the
  check passes (fail-open on missing Origin), matching the established repo convention
  (`app/api/foundation/_lib.ts`) so non-browser clients that omit `Origin` still work. The
  required header is what blocks browser CSRF.
- Request bodies on mutations are parsed through a shared `parseJsonObject` guard that rejects
  null, arrays, and primitives with `400 contributions_invalid_payload`, so handlers never read
  properties off a non-object. The admin queue `limit` is validated as a positive integer and
  clamped to 100.
- Audit writes are best-effort: the audit insert on each mutation is wrapped so an audit-only
  failure is reported and swallowed, never turning a successful mutation (or its idempotent credit
  grant) into a 5xx that a client would retry.
- Contracts: see
  [CONTRIBUTIONS_PLUGIN_COMMAND_CONTRACTS.yaml](../../contracts/CONTRIBUTIONS_PLUGIN_COMMAND_CONTRACTS.yaml),
  [CONTRIBUTIONS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/CONTRIBUTIONS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml),
  [CONTRIBUTIONS_PLUGIN_AUDIT_CONTRACTS.yaml](../../contracts/CONTRIBUTIONS_PLUGIN_AUDIT_CONTRACTS.yaml),
  [CONTRIBUTIONS_PROFILE_AND_DELETION_CONTRACT.md](../../contracts/CONTRIBUTIONS_PROFILE_AND_DELETION_CONTRACT.md).
- Account deletion wiring: registered in `lib/account/deletion-registry.ts` (delete
  `contributions_submissions` and `contributions_banner_state`; retain the audit log).

## 8. Web and Android Delivery Status

- Web: **shipped** (schema, contracts, library, API routes, metrics, seed, registry entry, and the
  full UI). The registry entry is `isVisible: true`, `availabilityState: implemented_shell`. The
  member surfaces live at `app/apps/contributions/page.tsx` (gating on `any_authenticated`, not the
  dynamic route's full-Unlock default) with components under `components/contributions/` — signed-out
  public shell, loading, main (drive progress + the three paths + thank-you note + history), the
  post-submit confirmation (Signal URL inline), and the empty-history state. The owner-only admin
  dashboard is at `app/admin/contributions/page.tsx` with components under
  `components/contributions/admin/` — queue, drive management, settings. The app-wide fundraiser
  banner (`components/contributions/contributions-banner.tsx`) is integrated non-blocking at the top
  of the Hub content area for signed-in members. Desktop and phone-width layouts are both built
  (rule 105). The banner's "Not now" dismiss button is currently hidden (owner request) behind the
  `SHOW_DISMISS_BUTTON` flag in that component — the button markup and the server-side snooze
  (`/api/contributions/banner/dismiss`) are left intact so it can be re-enabled by flipping the flag.
- Android: **surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served
  by the installable web app (PWA). Historical detail: it previously shipped at
  `packages/mobile/src/features/contributions/` (`Contributions.tsx`, `ContributionsAdmin.tsx`,
  `ContributionsApi.ts`) mirroring the web behavior one-to-one.
- Parity: `config/plugin-parity-contracts.json` still carries the `contributions` entry; the plugin is
  now web-only per rule 105.

## 9. Seed Coverage Status

- Seed: [scripts/seedContributionsPhase0.mjs](../../../scripts/seedContributionsPhase0.mjs)
  (the `Phase0` suffix is the established seed-script naming convention).
- Deterministic and idempotent (fixed UUIDs and timestamps, upserts). Seeds:
  - the runtime config singleton with the defaults above and **placeholder** Signal instructions
    (no real contact info anywhere in the seed);
  - one demo cycle (2026-05-01 to 2026-08-01, containing the authoring date; goals 100 USD / 50
    comments / 25 stars);
  - three demo claims in mixed statuses: a pending Amazon gift-card claim (placeholder Signal
    contact, no code — codes never exist in the system), a confirmed Quora comment (1 USD
    equivalent, 10 credits), and a rejected GitHub star.
- Known seed limitation: the confirmed demo claim records `credits_granted = 10` for display but
  has no backing governance event (`credit_governance_event_id` is null) because seeding does not
  run the real mint path.

## 10. Gaps and Known Technical Debt

- (Resolved 2026-07-01) The member surfaces previously showed hardcoded credit valuations (10 SC per
  dollar, 50 SC per action) that could drift from the admin config. The fundraiser route now returns
  the live `creditsPerUsd` and `creditsPerActionSc`, and the member cards/disclaimer render those, so
  member copy always matches the settings screen.
- The mobile admin screen mirrors the day-to-day review path (confirm/reject) and shows drive and
  settings as read-only summaries; creating/editing a drive and editing the config knobs is done on
  the web admin dashboard. The GitHub-star brand icon is rendered with lucide's `Star` (the brand
  mark was dropped in the app's lucide-react version).
- The confirmed seed row is display-only (no ledger event behind it); harmless in demo data,
  but anyone reconciling seed data against the credits ledger should expect that one-row gap.
- `getFundraiserSnapshot` records `last_shown_at` on read (so the future banner has an accurate
  shown-state); if read-path writes ever become a performance concern, move the write to the
  banner surface itself.
- Editing only one end of a cycle window is validated against the supplied value, not against the
  stored other end; the owner is the only writer, so this is acceptable for now.
- Metrics are registered in `canonical_metrics.yaml` as calculation definitions; no dashboard
  wiring yet.

## Change Log

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
