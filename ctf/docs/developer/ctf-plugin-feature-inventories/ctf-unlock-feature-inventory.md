# Unlock Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` remains reference-only and must not be modified.
- Plugin name: `Unlock`
- Plugin slug / service key: `unlock`
- Visibility requirement:
  - hidden from end-user plugin listings,
  - available in admin contexts where applicable.

## Intent and Outcome

Unlock governs staged access for new accounts that must submit a Quora profile URL for trust verification.

This plugin must:

1. collect and normalize Quora profile submissions,
2. keep users in read-only access while pending review,
3. move expired/unverified users to support-only access tier,
4. allow admin moderation decisions (approve/reject/spam),
5. award one-time service-credit incentive on approval,
6. preserve full audit trail for allow/deny/moderation/reward operations.

## 1) User Features

### 1.1 Verification Submission

1. Submit a Quora profile URL.
2. Validate and normalize URL before persistence.
3. Replace previous pending submission for the same user deterministically.

### 1.2 Staged Access Experience

1. Pending users are read-only until verified.
2. Unverified users after window expiry become support-only.
3. Approved users transition to full access.

### 1.3 Verification Guidance

1. Show concise safety copy for why Quora URL is requested.
2. Show acceptable URL format examples.
3. Show review state and next-step status text.

## 2) Admin Features

### 2.1 Moderation Queue

1. List submissions by status/access-tier filters.
2. Review with decisions: `approved`, `rejected`, `spam`.
3. Capture reviewer and optional moderation note.
4. A `spam` decision blocks the member from the whole app, not just the Unlock tier: in addition to
   dropping the access tier to `locked_support_only`, it places a platform-wide (`all`-scope)
   `account_restrictions` record (reason `unlock:spam`), which the auth gate enforces across every
   product surface (Commons/Hub included). The member keeps only their own status and
   account/data-deletion routes. An `approved` or `rejected` decision lifts a restriction that carries
   the `unlock:spam` marker (leaving any unrelated admin restriction untouched), so a mistaken spam
   mark is fully reversible.
5. A `spam` decision also records the submission's normalized Quora URL on the persistent
   `unlock_spam_quora_urls` denylist, so the admin does not have to review the same spam Quora account
   again: the URL survives the member's account/data deletion (the denylist holds no member id and is
   retained), and any later submission of that URL — even from a brand-new account — is auto-marked
   `spam` and app-blocked at submission time instead of re-entering the pending queue. Approving or
   rejecting the URL removes it from the denylist.
6. **Spam denylist panel.** The admin shell shows a "Spam Quora-URL denylist" panel (component
   `unlock-spam-denylist-panel.tsx`, fed by `listSpamQuoraUrls` from the admin page) listing every
   denylisted URL with when/how many times it was flagged, and a confirm-gated **Remove** button
   (`POST /api/unlock/admin/spam-denylist/remove`). Removing a URL only stops future submissions of it
   from being auto-blocked; it does not unblock a member already restricted for it (re-review their
   submission to approved/rejected for that).

### 2.2 Incentive Governance

1. On approval, issue a one-time 100 service-credit reward.
2. Enforce deterministic idempotency for reward grants.
3. Persist grant timestamp on unlock submission state.

### 2.3 Auditability and Operations

1. Audit allow/deny outcomes for submission and moderation commands.
2. Audit service-credit governance event correlation for reward grants.
3. Provide API contracts suitable for Retool-based admin queue UX.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface (Authoritative)

1. `unlock.verification.submit`
2. `unlock.admin.submission.list`
3. `unlock.admin.submission.review`
4. `unlock.admin.submission.url.edit`
5. `unlock.incentive.approval.credit-grant`
6. `unlock.admin.rewards.reconcile`
7. `unlock.admin.submission.revoke`
8. `unlock.admin.reward.grant`
9. `unlock.admin.experiment.read`
10. `unlock.admin.spam_denylist.remove`

### 3.2 HTTP Projection Routes

User routes:

- `POST /api/unlock/submission`

Admin routes:

- `GET /api/unlock/admin/submissions` — admin-session-gated queue list. Each row now also carries `quoraUrlChangeCount` (how many times the member changed their Quora URL, from `directory_quora_url_history`) alongside the existing `sharedUrlAccountCount`, so a member who changed their social-proof URL is visible at a glance.
- `GET /api/unlock/admin/quora-history?userId=<id>` — admin-session-gated (`requireUnlockAdminAccess`). Returns the member's full Quora URL change history (`listQuoraUrlHistory`), newest first: each entry is `{ id, userId, previousUrl, newUrl, changedByUserId, source, createdAtIso }` where `source` is `unlock_onboarding | directory_self | directory_admin`. Read-only (no CSRF). Lets a reviewer see whether a member changed or tried to remove their Quora URL (an empty submission keeps the previous one) and manually revoke via the existing revoke route if they are gaming the low-bar proof — a change is not itself proof of anything (Quora sometimes deletes accounts). Audited as `unlock.admin.quora.history.read`.
- `GET /api/unlock/admin/experiment-split` — admin-session-gated (`requireUnlockAdminAccess`). Read-only readout of the early-Commons A/B experiment split: calls the same `getUnlockExperimentSplit()` the web admin page reads server-side and returns `{ ok: true, experimentSplit }`, where each row is `{ bucket, exposed, submitted, completionPct }` (per-bucket Quora-URL completion rate). An empty array is the normal "rollout not started" state. No CSRF (a read). Added so the mobile Unlock admin can render the same panel the web shell renders server-side. Audited as `unlock.admin.experiment.read`.
- `POST /api/unlock/admin/submissions/:submissionId/review`
- `PATCH /api/unlock/admin/submissions/:submissionId` — admin-session-gated (`requireUnlockAdminAccess`). Edits a submission's Quora profile URL (e.g. fixing a typo). Body `{ quoraProfileUrl }`; the URL is re-validated and re-normalized with the same `normalizeQuoraProfileUrl` shared with the member submit path, so the stored normalized form stays canonical. Returns `{ ok: true, submission }`; 400 on missing/invalid URL, 404 if no submission matches. Does not change review status, access tier, or the verification window. Audited as `unlock.admin.submission.url.edit`. Client sends `x-ctf-csrf: '1'`, matching the review route.
- `POST /api/unlock/admin/reconcile-rewards` — admin-session-gated (`requireUnlockAdminAccess`, no `CRON_SECRET`). Runs the same idempotent reward drain as the cron and returns `{ scanned, granted, alreadyGranted, withheld, failed }`. Lets an admin grant any approved-but-uncredited reward on demand from the Unlock admin screen (the "Retry pending rewards" button), independent of the GitHub cron. Audited as `unlock.admin.rewards.reconcile`.
- `POST /api/unlock/admin/submissions/:submissionId/revoke` — admin-session-gated (`requireUnlockAdminAccess`) + CSRF (`x-ctf-csrf: '1'` + same-origin). Duplicate-identity determination "loser" path: claws a granted reward back (best-effort `burnCredits`, key `unlock-revoke-submission-<id>`) and sets the submission to `rejected` + `locked_support_only` with `reward_revoked_at`, so reconcile never re-grants it. Body `{ reviewNote? }`. Returns `{ ok, submission, creditsReclaimed, reclaimAmount }`; idempotent (a second call on an already-revoked submission is a no-op). Audited as `unlock.admin.submission.revoke` (+ `service-credits.governance.burn.unlock.revoke` when credits were reclaimed).
- `POST /api/unlock/admin/submissions/:submissionId/grant-reward` — admin-session-gated + CSRF. Duplicate-identity determination "winner" path: clears the hold and grants the reward to the chosen account through the shared guard. Returns 409 `unlock_reward_still_held` (with `holderUserId`) if another account still holds the identity's reward (revoke that one first); 409 if the submission is not approved; otherwise `{ ok, submission }`. Idempotent if the reward already landed. Audited as `unlock.admin.reward.grant` (+ `service-credits.governance.mint.grant.unlock.determination` on a fresh grant).
- `POST /api/unlock/admin/spam-denylist/remove` — admin-session-gated (`requireUnlockAdminAccess`) + CSRF (`x-ctf-csrf: '1'`). Removes one normalized Quora URL from `unlock_spam_quora_urls`. Body `{ quoraProfileUrlNormalized }`; returns `{ ok: true }`, 400 if missing. Only stops future submissions of that URL from being auto-blocked — it does not lift the restriction on a member already blocked for it (re-review their submission to approved/rejected for that). The denylist itself is read server-side by the admin page (`listSpamQuoraUrls`) and shown in the admin shell's denylist panel. Audited as `unlock.admin.spam_denylist.remove`.

Internal (cron) routes:

- `POST /api/internal/unlock/reconcile-rewards` — `CRON_SECRET`-guarded (Bearer). Drains the approved-but-uncredited reward backlog and mints each idempotently (actor `unlock-incentive-system`, key `unlock-approval-submission-<id>`), then sets `incentive_granted_at`. Self-heals a reward whose mint failed on approval; can never double-grant. Returns `{ scanned, granted, alreadyGranted, failed }`. Scheduled hourly by `.github/workflows/unlock-reward-reconciliation.yml`, which resolves the app URL from the `APP_BASE_URL` variable / `NEXT_PUBLIC_APP_URL` secret and needs `CRON_SECRET` in both GitHub Actions and the app runtime; when either is missing it now skips with a visible warning instead of a silent green pass.

Admin page:

- `GET /admin/unlock`

## 4) Data Model and Storage Contracts

### 4.1 Domain Entities

1. `unlock_runtime_config`
2. `unlock_verification_submissions`
3. `unlock_audit_log`
4. `unlock_spam_quora_urls` — persistent spam denylist of normalized Quora profile URLs. Keyed on
   `quora_profile_url_normalized` (primary key); also stores `quora_profile_url` (last-seen original, for
   admin readability), `flagged_by_user_id` (admin who flagged, or the system actor on an auto-block),
   `flag_count`, `first_flagged_at`, `last_flagged_at`, `updated_at`. It holds **no member identifier**,
   so it is retained through account/data deletion (registered `retain` in the account deletion
   registry). Written when a submission is marked spam; a row is removed when the same URL is later
   approved or rejected (the spam mark is reversible).

Multi-currency (issue #120): `unlock_runtime_config` carries `incentive_currency` (FK → `currencies.code`),
naming the currency of `incentive_amount`. It defaults to ServiceCredits (code `SC`) — the approval
incentive is an internal token grant. No surface renders a ServiceCredits amount at a fiat equivalent.

### 4.2 Stored State

1. review status: `pending | approved | rejected | spam`
2. access tier: `pending_readonly | locked_support_only | approved_full`
3. unlock window expiration timestamp
4. reminder stage marker
5. incentive grant timestamp
6. `reward_withheld_at` — set when the verification reward is held by the duplicate-identity guard (another account already holds this normalized Quora URL's reward); awaits an admin determination and is excluded from the reconcile backlog.
7. `reward_revoked_at` — set when an admin claws a reward back (the determination "loser", or a perp); the account is dropped to `rejected` + `locked_support_only` and the row is excluded from the reconcile backlog.

Index `idx_unlock_verification_submissions_url_normalized` on `quora_profile_url_normalized` backs the guard's per-URL lookups (who else claimed this identity, and which account currently holds its reward).

## 5) Security, Privacy, and Compliance Controls

1. Server-side auth gates for all routes.
2. Admin-only moderation and queue access.
3. Input normalization and strict Quora URL shape validation.
4. Auditable moderation and reward grant traces.
5. Plugin remains hidden from end-user plugin registry navigation.
6. **Unlock is the single source of truth for full app access (hard cutover, 2026-06-09).** The old v2 `isApproved` flag — which came from an `x-ctf-user-approved` header the middleware never set, so it defaulted to true for everyone — has been removed entirely from the request identity, the bearer-token identity, and the access decision. The central gate `evaluatePluginAccess` now resolves the Unlock tier via `getUnlockAccessTier` (Unleash flag, then DB tier with lazy expiry) and enforces a single `minUnlockTier` option:
   - `approved_full` (default): only fully-approved members or admins may enter. Every plugin route, the Chyme service routes, and all admin pages use this. A not-yet-verified member is denied with reason `unlock_required` and sent into the Unlock flow.
   - `support_only`: approved or `locked_support_only` members may enter. Used by the Hub general channel (`/api/hub/**`), which is the support surface for not-yet-verified members — they can read and post there to ask for help (for example, finding their Quora profile link).
   - `any_authenticated`: any signed-in member may enter regardless of tier. Used by the Unlock submission/status routes (so a gated member can always submit) and the account/profile/deletion routes (so a gated member can always see and delete their own data, i.e. exercise the right to be forgotten).
7. Admins always pass the tier check.
8. **Chyme is no longer granted to not-yet-unlocked members.** Chyme requires `approved_full`; degraded members are pointed at the Hub general channel and the Unlock flow instead. Chyme's anonymous public visitor shell (for signed-out browsing) is unchanged.
9. **Duplicate-identity guard (one Quora profile, one reward).** A normalized Quora URL earns the verification reward on a single account. The shared reward grant (`grantUnlockRewardForSubmission`, used by the approval handler, the hourly reconcile, and the admin determination) checks `getUnlockRewardHolderForUrl` before minting: if another non-revoked account already holds the identity's reward, the reward is **held** (`reward_withheld_at`) for an admin determination rather than auto-minting a second reward for the same person. The admin then awards the chosen account (`grant-reward`) and/or revokes the others (`revoke`, which burns the credits back and locks the account). This blocks both honest cross-account reuse and a perp who pastes a victim's Quora URL onto an impersonation account. The reward verbs are admin-gated + CSRF-guarded and fully audited.
10. **A `spam` decision is a whole-app block, not just a tier drop (2026-07-30).** `rejected` and `spam` both drop the Unlock tier to `locked_support_only`, which by itself still lets a member into the Commons/Hub support surface and every `any_authenticated` route. To make `spam` mean "removed from the app", the review handler (`POST /api/unlock/admin/submissions/[submissionId]/review`) additionally places a platform-wide (`all`-scope) `account_restrictions` record with reason `unlock:spam`. The central auth gate (`evaluatePluginAccess`) denies every `support_only` and `approved_full` route for an `all`-scope restriction (reason `account_restricted`), so a spammed member is shut out of the Commons and all plugins — only their own status and account/data-deletion (`any_authenticated`) routes stay reachable, preserving the right to be forgotten. A subsequent `approved` or `rejected` decision lifts the restriction **only** when the stored reason is the `unlock:spam` marker, so it never clears an unrelated admin restriction; this makes a mistaken spam mark fully reversible. The restriction upsert and its audit row are written by `restrictAccount` / `unrestrictAccount` (tables `account_restrictions`, `account_restrictions_audit`).

## 6) Web and Android Delivery Strategy

1. Backend-first delivery with web admin moderation shell.
2. Android parity for submission/status surfaces follows shared contracts.
3. Access-tier semantics remain consistent across web and Android.
4. Web pixel pass (design `c5d83c0`): the user-facing `/plugin/unlock` page is rebuilt to `design/.../survivor-hub/Unlock.tsx` and its Empty/Loading states. `UnlockShell` reads `GET /api/unlock/status` and renders the loading state, the submission form (no submission), or the status view (pending/approved/rejected, with a re-submit form on rejection). Submission and re-submission POST to `/api/unlock/submission` (replacing the previous stub form, which never called the API). Status label, the timeline, the "what you unlock" checklist, and the approved/rejected variants are driven by the real `UnlockStatus`; the mockup's dummy URL, rejection text, and timestamps (absent from the status endpoint) are not fabricated. ClickLog-style dark layout decomposed into modular sub-components within rule-116 limits.
5. Android pixel pass (2026-05-31): `ctf/packages/mobile/src/features/unlock/Unlock.tsx` rewritten to `MobileUnlock.tsx` / `MobileUnlockEmpty.tsx` / `MobileUnlockLoading.tsx` / `MobileUnlockPublic.tsx` mockup. Created `api.ts` binding `GET /api/unlock/status` and `POST /api/unlock/submission`. Four states: loading (tagline splash), public (unauthenticated — 401/403 path), submission form (no prior submission), status view (pending/approved/rejected with re-submit on rejection). MockUnlock.tsx was already empty and is not exported. Real-data bindings: `UnlockStatus.reviewStatus`, `.accessTier`, `.hasSubmission`. Omitted per real-data-only rule: `quoraProfileUrl` (absent from status endpoint), timeline dates (`submittedAt`/`reviewedAt` absent), `reviewNote` (absent from status endpoint). No CSRF header needed (mirrors web unlock shell which does not set `x-ctf-csrf`).
6. Android admin surface **removed 2026-07-20 (rule 105, PR #1742)** — the Unlock **admin** surface
   (queue review, duplicate-identity determination / grant / revoke, badges) is now **web-only**; only
   the member Unlock access-wall/status screen remains on Android. Historical detail (the admin screen
   previously shipped 2026-06-07): added `ctf/packages/mobile/src/features/unlock/AdminUnlock.tsx` (new `unlock-admin` App.tsx key) and `admin-api.ts`. The screen lists the pending verification queue and adds per-submission Approve / Reject actions, mirroring the web admin's review action and the `MobileUnlockAdmin.tsx` mockup. Binds only existing endpoints — `GET /api/unlock/admin/submissions?reviewStatus=pending` and `POST /api/unlock/admin/submissions/:submissionId/review` (with `x-ctf-csrf: '1'`). Admin-gated server-side (`requireUnlockAdminAccess`); a 401/403 shows an "admins only" notice. Each decision is confirm-gated via `Alert.alert`. Reject sends `reviewStatus: 'rejected'` with no free-text reason (the route's `reviewNote` is optional and `Alert.prompt` is iOS-only); the `spam` decision the route also accepts is not surfaced, matching the web admin and the mockup's two-button Grant/Deny.
7. Android A/B experiment readout (admin) — **removed 2026-07-20 (rule 105, PR #1742)** along with the
   rest of the Android Unlock admin surface (web-only now). Historical detail (#1602): the mobile Unlock admin (`AdminUnlock.tsx` + `admin-api.ts`) showed the same "Early Commons access — A/B experiment" panel the web shell renders — per-bucket treatment vs control with completion %, "N of M submitted", and the same Unleash-rollout empty state. The web reads the split server-side in the admin page component, so a new read-only admin-gated route `GET /api/unlock/admin/experiment-split` was added to expose it over HTTP; the mobile client (`fetchExperimentSplit`) fetches it alongside the queue (best-effort — a failure never blocks the queue). Read-only; no new mutation.

## 7) Seed Coverage Status

Seed script requirement: deterministic Unlock seed scenarios for pending, approved, rejected, and spam states.

## 8) Gaps and Known Debt

1. Platform-wide, centralized enforcement for support-only tier is implemented in the auth layer (`evaluatePluginAccess`).
2. `/api/unlock/status` endpoint provides current Unlock access tier and status for the authenticated user.
3. Incentive amount is now sourced from runtime config.
4. Reminder scheduler and cadence delivery worker are pending implementation.
5. Duplicate-identity guard: the holder check + mint are not wrapped in a per-URL advisory lock, so two brand-new accounts with the same URL approved in the same instant could in theory both be granted before either is recorded as the holder. With serialized reconcile and the per-submission idempotency this is negligible in practice; the admin revoke path cleans up any stray. A per-URL `pg_advisory_xact_lock` around the grant would close it fully.
6. Duplicate-identity guard is web + backend only. The React Native Unlock **admin** screen (`AdminUnlock.tsx`) was **removed 2026-07-20 (rule 105, PR #1742)** — all Unlock admin (queue review, grant/revoke determination, badges) is now web-only; the earlier "Android parity follow-up" for the per-row withheld/revoked badges and grant/revoke actions no longer applies.

## 9) Change Log

- 2026-07-30: **Admin denylist panel — view and remove spam Quora URLs.** Added a "Spam Quora-URL
  denylist" panel to the Unlock admin shell (`unlock-spam-denylist-panel.tsx`, in its own component to
  keep the shell under the rule-116 size/complexity limits), fed by `listSpamQuoraUrls` from the admin
  page. Each row shows the URL, when it was last flagged, and the flag count, with a confirm-gated
  Remove that calls the new `POST /api/unlock/admin/spam-denylist/remove` (admin-gated + CSRF, audited
  `unlock.admin.spam_denylist.remove`, command contract `unlock.admin.spam_denylist.remove` v1.0.0).
  Removing a URL only stops future auto-blocking of it; it does not lift an existing member's
  restriction. No schema change.
- 2026-07-30: **Persistent spam Quora-URL denylist — the same spam account is never reviewed twice.**
  Added `unlock_spam_quora_urls` (new table), keyed on the normalized Quora URL and holding no member
  id. Marking a submission `spam` records its normalized URL here; approving/rejecting removes it. Two
  effects: (1) the URL survives the flagged member's account/data deletion — the per-member submission
  row is hard-deleted, but this denylist is registered `retain` in the account deletion registry — so
  the flag is not lost; (2) a later submission of a denylisted URL (even from a new account) is
  auto-marked `spam` and app-blocked at submission time (`createOrUpdateUnlockSubmission` sets the
  status; the submission route places the `unlock:spam` account restriction, attributed to the system
  actor `system:unlock-spam-denylist`) instead of re-entering the pending queue. New module
  `lib/unlock/spam-denylist.ts` holds the denylist read/write and the shared `unlock:spam`
  restriction-reason constant. Contracts `unlock.verification.submit` (→ `1.1.0`) and
  `unlock.admin.submission.review` gained `unlock_spam_quora_urls` in `dataAccess` (submit also gained
  `account_restrictions`/`account_restrictions_audit` for the auto-block). Schema adds one table; the
  deletion registry, deletion contract, and manual test script were updated to match.
- 2026-07-30: **A `spam` decision now removes the member from the app, not just from the full tier.**
  Before this change, marking a submission `spam` set the same `locked_support_only` tier a `rejected`
  submission gets, which still left the member inside the Commons/Hub support surface and every
  `any_authenticated` route — so a spammed member could keep using the support surfaces. The review
  handler (`POST /api/unlock/admin/submissions/[submissionId]/review`) now also places a platform-wide
  (`all`-scope) `account_restrictions` record (reason `unlock:spam`) on a `spam` decision, which the
  central auth gate enforces across every product surface — the member is shut out of the Commons and
  all plugins, keeping only their own status and account/data-deletion routes. An `approved` or
  `rejected` decision lifts a restriction carrying the `unlock:spam` marker (never an unrelated admin
  restriction), so a mistaken spam mark is fully reversible. The command contract
  `unlock.admin.submission.review` was bumped to `1.1.0` and its `dataAccess` now lists
  `account_restrictions` and `account_restrictions_audit`. Route logic only — no schema change (both
  tables already exist).
- 2026-07-29: **Quora space renamed — help links now point to `skillseconomy.quora.com`.** The owner
  renamed the network's Quora space from `tiskillsnetwork.quora.com` to `skillseconomy.quora.com`, so
  every "Can't find your Quora profile URL?" help callout that pointed members at the old address was
  updated to the new one: the web help block (`unlock-quora-help.tsx`, `UNLOCK_QUORA_HELP_URL` +
  `UNLOCK_QUORA_HELP_DOMAIN`), the web Commons verify banner
  (`components/community-shell/unlock-verify-banner.tsx`), and the mobile Unlock submission/re-submit
  screens and `UnlockVerifyBanner` (`packages/mobile/src/features/unlock/`). The Jen S. Quora review
  source link in `lib/reviews/reviews-data.ts` and the UNLOCK-M1/M2 steps in the Unlock test script
  were pointed at the new host too. Copy/link only — no route, schema, or contract change. The owner
  also confirmed the space's visible display name changed from "TI Skills Network" to "Skills
  Economy", so the `space` label on the 70 Quora-export rows for that space in
  `ctf/scripts/data/comic-knowledge-seed-2.jsonl` was updated (that label is imported as the comic
  knowledge-entry title — see the comic inventory). Left as-is in that file: the post `url` values
  (never imported, and several encode the old subdomain inside the canonical slug, so rewriting would
  corrupt them) and any "TI Skills Network" mention inside verbatim post `content` (a member's own
  words, kept exact). The old space redirects to the new one on Quora.
- 2026-07-26: **Fix: the "Member view" button in the Unlock admin header 404'd.** It pointed at
  `/apps/unlock`, but Unlock is registered with `isVisible: false` (it is deliberately kept out of
  the app launcher) and `app/apps/[pluginSlug]/page.tsx` calls `notFound()` for any plugin that is
  not visible — so the link 404'd for everyone, admins included, even though the member Unlock
  screen was live. Unlock's member surface is its own route, `/plugin/unlock`; the button now points
  there. One-line href fix in `unlock-admin-shell.tsx`; no route, schema, or contract change.
- 2026-07-29: **Support-only filter in the admin queue (web).** The admin dashboard already counted
  Support-only members, but there was no way to see *who* they were — only Pending and All submissions.
  Added a third tab, `Support-only`, filtering the loaded page on `accessTier === 'locked_support_only'`.
  Filtered on access **tier**, not review status, on purpose: a member reaches that tier by more than
  one route — rejected, marked spam, or a `pending` submission whose window lapsed and was swept by
  `supportOnlyAfterExpiry` — and the tier is the only thing all of those share. It is also exactly what
  the Support-only counter counts, so the number and the list cannot disagree. Two supporting bits: each
  card now shows a grey `Support-only` pill when the member is on that tier (review status alone does not
  explain a swept `pending` row), and the tab prints how many of the counter's total this page is
  actually showing, so once there are more submissions than the page cap a short list reads as a
  shortfall rather than as everyone. Client-side filter over already-loaded data; combines with the
  existing search box. No route, schema, or contract change. **Parity:** web + mobile-responsive;
  Android out of scope (web-only per rule 105).
- 2026-07-23: **Quora URL history in the admin queue + revoke (web).** The Quora profile URL is the only social proof and can be changed after approval (in Directory). The admin queue now surfaces the trail so a reviewer can catch someone gaming it: each submission row shows a `quoraUrlChangeCount` badge ("URL changed N×"), and a "URL history" toggle opens the full change list from a new admin route `GET /api/unlock/admin/quora-history?userId=<id>` (`listQuoraUrlHistory` over the new `directory_quora_url_history` table). Each entry shows the previous → new URL, when, and the source (set at onboarding / changed by the member in Directory / changed by an admin). The existing `POST /revoke` is the manual response (drops the member to `rejected` + `locked_support_only` and claws the reward). The Unlock onboarding submission now records the captured URL into the shared history (best-effort, `recordQuoraUrlChangeStandalone`, source `unlock_onboarding`) so the trail includes the baseline. Framed as a human watch tool, never an automatic flag — a change is legitimate when Quora deletes an account. New audit command `unlock.admin.quora.history.read`. Schema change: `directory_quora_url_history` (owned by Directory). Verified: `@ctf/web` typecheck, lint, a11y lint, build. Owner-review lane.
- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/unlock`. The member shell header now shows the shared Admin shortcut
  (`PluginAdminButton`, admins only). UI-only; no schema, route, or contract change.
- 2026-07-17: **Android parity — early-Commons A/B experiment readout in the Unlock admin (#1602).** The mobile Unlock admin (`packages/mobile/src/features/unlock/AdminUnlock.tsx` + `admin-api.ts`) now shows the "Early Commons access — A/B experiment" panel that was web-only: per-bucket treatment vs control with the Quora-URL completion %, "N of M submitted", and the same "turn on the `feature-unlock-early-commons-access` Unleash rollout" empty state. The web reads the split server-side in `app/admin/unlock/page.tsx` via `getUnlockExperimentSplit()`, so there was no HTTP route; added a read-only admin-session-gated route `GET /api/unlock/admin/experiment-split` (`requireUnlockAdminAccess`; no CSRF — a read) that calls the same repository function and returns `{ ok: true, experimentSplit }` (each row `{ bucket, exposed, submitted, completionPct }`). New mobile client `fetchExperimentSplit()` loads it alongside the queue and on pull-to-refresh, best-effort so a failure never blocks the queue. New command `unlock.admin.experiment.read` added to the command / access-policy / audit contracts (reads only `unlock_audit_log`, the same source the web readout uses). No schema change; web behavior unchanged.
- 2026-07-14: **Android pull-to-refresh on the Unlock screens.** The member screen (`Unlock.tsx`, submission form + status view) and the admin queue (`AdminUnlock.tsx`) now support pull-to-refresh: dragging down re-pulls the verification status / submissions queue in the background without flashing the full-screen loading state. Mobile-client only — no backend, schema, route, or contract change.
- 2026-07-12: **Admin submissions search (web + android).** The Unlock admin submissions list now has a search box above the list on both surfaces (`unlock-admin-shell.tsx` and mobile `AdminUnlock.tsx`), so an operator can find a submission by Quora URL, user id, or submission number instead of scrolling the whole queue (37+ approved rows). Client-side filter over the already-loaded page, case-insensitive, and combines with the existing Pending/All (web) and Pending/Approved/All (mobile) tabs; an empty result shows "No submissions match your search." No route, schema, or contract change — read-only client filter.
- 2026-07-12: **Quora-URL help copy — restored the "Can't find your Quora profile URL?" lead, first person.** Reverted to the earlier phrasing ("Can't find your Quora profile URL? Go to tiskillsnetwork.quora.com and comment on any post asking for help — …") but in the **first person**: "**I'll** reply with your profile URL" (not "we'll"), so the app never reads as though more than one person maintains it. Applies to every Quora-help surface, both A/B arms; copy only.
- 2026-07-12: **Quora-URL help copy finalized (owner wording).** The universal Quora help callout now reads, in the owner's first-person voice: "If you have trouble finding your Quora profile URL, comment on any post at tiskillsnetwork.quora.com and I will provide you with your URL." Same placement (every surface that requests the Quora URL, both A/B arms) and the same `tiskillsnetwork.quora.com` link — copy only.
- 2026-07-03: **Quora-URL help now points to the network's Quora space (replaces "Ask in the Commons").** Owner decision: a member who can't find their Quora profile URL is told to go to **tiskillsnetwork.quora.com**, comment on any post asking for help, and the team replies with their profile URL — a cleaner, single support path. A new prominent, **universal** callout (shown to every member, not just the A/B treatment bucket) appears on every surface that requests the Quora URL: the web submission form and status/re-submit view (`unlock-quora-help.tsx`, replacing the treatment-only `unlock-commons-help.tsx`), the web Commons verify banner (`components/community-shell/unlock-verify-banner.tsx`), and the mobile Unlock submission/re-submit screens and `UnlockVerifyBanner`. The `tiskillsnetwork.quora.com` link opens the Quora space (new tab on web; `Linking.openURL` on mobile). The old "Trouble finding your Quora URL? Ask in the Commons" link/nudge (and the mobile `onNavigateToCommons` plumbing it needed) is removed. **The early-Commons A/B experiment itself is unchanged** — treatment members still land on the Commons and see the verify banner; only the help copy changed. No route, schema, or contract change.
- 2026-07-02: **Android parity — verify prompt on the mobile Commons for early-Commons treatment members (#1315).** Completes the mobile side of the web fix below. Two changes to the RN app: (1) the client Unlock gate in `App.tsx` now passes a treatment-bucket member (`status.earlyCommonsAccess === true`) through to the navigator instead of walling them to the Unlock screen — mirroring the web redirect exception, and matching the server, which already admits them to the Commons via the support-only widening; without this a treatment member could never reach the early Commons access the experiment grants. (2) A new `UnlockVerifyBanner` (`packages/mobile/src/features/unlock/UnlockVerifyBanner.tsx`) renders at the top of `HubHome` (the mobile Commons) for treatment members who have not yet verified: it prompts for the Quora profile URL inline (posting to the existing submission endpoint), tells a stuck member to ask for help in the Commons chat below, and switches to an "under review" note after submit / for a pending submission. The banner fetches its own status and self-hides for control / verified members, so `HubHome` needs no new props. No backend, schema, or contract change — binds only the existing `earlyCommonsAccess` status field; inert until the `feature-unlock-early-commons-access` Unleash rollout is enabled.
- 2026-07-02: **Fix: early-Commons treatment members had no verify prompt on the Commons.** A member in the early-Commons A/B treatment bucket lands directly on the Commons (chat) and saw no indication they still needed to verify — a reported bug. The Commons shell now shows a persistent `UnlockVerifyBanner` (`components/community-shell/unlock-verify-banner.tsx`) at the top of the content area for treatment members: it prompts for the Quora profile URL inline (posting to the same `POST /api/unlock/submission`), tells a stuck member to just ask for help in the Commons chat below, and switches to an "under review" note after a successful submit or for an already-pending submission. Wired via a new `verification` prop on `CommunityShell` (`{ hasSubmission, reviewStatus }`), populated in `app/page.tsx` only for treatment-bucket members (`earlyCommons`) — deliberately not for support-only members, because submitting moves a member to `pending_readonly` and only a treatment member stays on the Commons afterward. No new route, schema, or contract; reuses the existing submission endpoint. Mobile parity: the RN app already shows the "Ask in the Commons" help link on its Unlock screen (#1034); the equivalent mobile-Commons verify prompt is a follow-up.
- 2026-06-29: **Android parity — early Commons access help link (#1034).** The mobile Unlock submission and status screens (`packages/mobile/src/features/unlock/Unlock.tsx`) now show the "Trouble finding your Quora URL? Ask in the Commons" link for treatment-bucket members only, gated on the `earlyCommonsAccess` field already returned by `GET /api/unlock/status`. Tapping it navigates to the Hub home (Commons) via a new optional `onNavigateToCommons` prop wired in `App.tsx` (`unlock` navigator entry → `setSelected('home')`); the link renders nothing without that handler, so it can never be a dead link. Mobile landing/routing needed no change: the App.tsx unlock gate already passes `locked_support_only` (the treatment tier) through to the navigator, which lands on `HubHome`. A control member sees no link (parity with web). No backend, schema, or contract change — binds only the existing status field. Behavior stays inert until the `feature-unlock-early-commons-access` Unleash rollout is enabled.
- 2026-06-27: **Admin readout for the early-Commons A/B experiment.** The Unlock admin screen now shows an "Early Commons access — A/B experiment" panel with the Quora-URL completion rate per bucket (treatment vs control), so the split can be read in the app without running SQL. New `getUnlockExperimentSplit()` in `lib/unlock/repository.ts` aggregates the `experimentBucket` recorded on `unlock.status.get` / `unlock.verification.submit` audit rows (exposed members per bucket, how many submitted, completion %); it is best-effort (returns empty on query failure) and reads only the existing `unlock_audit_log` table. Surfaced server-side through `app/admin/unlock/page.tsx` as a new `experimentSplit` prop on `unlock-admin-shell.tsx`; empty state points the operator at the Unleash rollout. No new route, schema, or contract. Mobile admin readout deferred (parity note).
- 2026-06-26: **A/B experiment — early Commons access for not-yet-verified members (flag-gated, default off).** Motivation: ~50% of signups never submit their Quora URL; this tests whether giving an unverified member early support-only access to the Commons (the Hub general channel) — a place to ask for help, e.g. trouble finding their Quora URL — lifts the submission/completion rate, instead of confining them to the Unlock screen. New Unleash flag `UNLOCK_FLAGS.EARLY_COMMONS_ACCESS` (`feature-unlock-early-commons-access`), bucketed as a gradual rollout sticky on `userId`; default false (control) and when Unleash is unconfigured, so production routing is unchanged until the rollout is enabled. New helper `isUnlockEarlyCommonsEnabled(userId)` in `lib/unlock/access.ts` (errors resolve to control — a flag-backend failure never widens access). Access change, scoped strictly to `support_only` surfaces (the Commons is the only `support_only` caller, via `requireHubAccess`): `lib/auth/server-authz.ts` now also admits a treatment-bucket member to `support_only` routes, and `app/page.tsx` lands a treatment-bucket member on the Commons instead of redirecting to `/plugin/unlock`. Full (`approved_full`) plugin surfaces are unaffected. UI: the Unlock submission and status screens show a "Trouble finding your Quora URL? Ask in the Commons" link (new `unlock-commons-help.tsx`) for treatment members only (a control member never sees it and could not post there anyway); `GET /api/unlock/status` now returns `earlyCommonsAccess` on the status payload (resolved in the route, not the repository, to avoid a circular import). Measurement: the `unlock.verification.submit` and `unlock.status.get` audit rows now record `experimentBucket` (`early_commons` | `control`) in metadata, so the completion rate can be compared per bucket from `unlock_audit_log`. No schema change; no command/access/audit contract change (the `support_only` widening is an experiment gate inside the shared authz, not a new command). Android: the mobile `UnlockStatus` type mirrors the new `earlyCommonsAccess` field; the mobile Commons help link is deferred (see Android parity note).
- 2026-06-26: **Code-review hardening sweep (issues #958–#965).** Closed a set of code-review findings for the plugin. Security: the three admin mutations that were missing the CSRF guard — `POST …/submissions/:id/review`, `PATCH …/submissions/:id` (URL edit), and `POST …/admin/reconcile-rewards` — now call `ensureUnlockMutationCsrf` first (the `reconcile-rewards` POST gained a `request: Request` parameter), matching the revoke/grant-reward routes. Reward state machine: `createOrUpdateUnlockSubmission`'s `ON CONFLICT DO UPDATE` now also clears `incentive_granted_at`, `reward_withheld_at`, and `reward_revoked_at`, so a re-submission starts a clean cycle instead of a prior revoke/withhold/grant stamp stranding the new submission (the per-submission mint idempotency key still prevents any double-credit on the same row). Idempotency: `mintGrant` now returns a `replayed` flag, and `grantUnlockRewardForSubmission` treats an idempotency replay as `already_granted` (repairing the per-submission flag) instead of counting it as a fresh grant or writing a duplicate follow-up audit when a prior run crashed after minting but before marking. Audit: a new `resolveUnlockRequestId(request)` helper (in `app/api/unlock/_lib.ts`) threads a request id into every `insertUnlockAudit` call across the plugin (the `request_id` column already existed), so the contract's required `requestId` field is populated. Mobile: `AdminUnlock.tsx` gains Pending/Approved/All status tabs (`fetchPendingSubmissions` → `fetchSubmissions(filter)`), so approved-but-uncredited submissions are visible to the mobile operator and the reward-status pill is no longer dead code; the reconcile result type and operator notice now include `withheld` and `errors`, matching the web shell. No schema change (all columns already existed); no command/access/audit contract change.
- 2026-06-25: **Duplicate-identity guard for the verification reward (flag-for-admin).** A normalized Quora URL now earns the reward on one account. Schema: `unlock_verification_submissions` gains `reward_withheld_at` + `reward_revoked_at` (guarded ALTERs) and an index on `quora_profile_url_normalized`. The reward grant was centralized into `grantUnlockRewardForSubmission` (in `lib/unlock/reconcile-rewards.ts`), shared by the approval handler, the reconcile job, and the new admin determination; before minting it calls `getUnlockRewardHolderForUrl` and, if another non-revoked account already holds the identity's reward, **holds** this one (`reward_withheld_at`) instead of minting a second reward for the same person. `listApprovedUnincentivizedSubmissions` excludes withheld/revoked rows so reconcile never retries them; the admin queue list now reports `sharedUrlAccountCount` (a per-URL count) so duplicates are visible. Two new admin-session-gated + CSRF-guarded routes: `POST …/submissions/:id/revoke` (claws the reward back via best-effort `burnCredits` and locks the account → `rejected` + `locked_support_only` + `reward_revoked_at`) and `POST …/submissions/:id/grant-reward` (the determination "winner" — clears the hold and grants the chosen account, refusing with 409 + the current `holderUserId` if another account still holds it). `unlock-admin-shell.tsx` adds "Shared by N" / "Reward withheld" / "Reward revoked" badges and inline "Grant reward" / "Revoke reward" (confirm-gated) actions. New commands `unlock.admin.submission.revoke` + `unlock.admin.reward.grant` added to the command / access-policy / audit contracts; `unlock.incentive.approval.credit-grant` `dataAccess` now also reads other submissions for the holder check. Motivating case: a perp creating impersonation accounts that paste a real victim's Quora URL no longer auto-collects the reward — it is held for the admin. Web + backend; Android admin parity deferred (see Gaps).
- 2026-06-23: **One-time port of v2 Quora verifications into v3 Unlock.** v3's database is a clone of v2 prod, so the legacy `public.users.quora_profile_url` values are still present. New script `ctf/scripts/portV2QuoraUnlocks.mjs` (run by the manual `Port v2 Quora verifications into v3 Unlock` workflow, `.github/workflows/port-v2-quora-unlocks.yml`) reads those and inserts an APPROVED submission (`review_status = 'approved'`, `access_tier = 'approved_full'`, `reviewed_by_user_id = 'v2-quora-port'`) for each member who gave a Quora URL in v2 and does not already have a v3 submission, so returning members skip the Unlock screen. It mints no credits itself — `incentive_granted_at` is left NULL, so the existing `reconcileUnlockRewards` job grants each ported member 100 credits idempotently on its next run. Dry-run by default (writes nothing unless `APPLY=1`); idempotent via `ON CONFLICT (user_id) DO NOTHING` so a member already present in v3 is never overwritten or double-granted. No schema or contract change.
- 2026-06-20: Admins can now edit a submission's Quora profile URL (e.g. to fix a typo a member submitted). New admin-session-gated route `PATCH /api/unlock/admin/submissions/:submissionId` (`requireUnlockAdminAccess`); body `{ quoraProfileUrl }`. The URL is re-validated and re-normalized on save using `normalizeQuoraProfileUrl`, which was factored out of `app/api/unlock/submission/route.ts` into the shared `app/api/unlock/_lib.ts` so the member submit path and the admin edit path apply identical rules. Repository gained `updateUnlockSubmissionQuoraUrl(id, url, normalized)`, which overwrites only `quora_profile_url` / `quora_profile_url_normalized` (plus `updated_at`) and leaves review status, access tier, and the verification window untouched; returns 404 when no row matches. `unlock-admin-shell.tsx` adds a small "Edit" (pencil) button next to each submission URL that swaps the link for an inline input with Save / Cancel; Save sends the `PATCH` with `x-ctf-csrf: '1'`, then updates local state from the returned submission and refreshes. Audited as `unlock.admin.submission.url.edit` (metadata records only the new normalized URL). New command added to the command / access-policy / audit contracts. No schema change.
- 2026-06-19: Fixed approval rewards stranded as "pending." Two members stayed at "Reward pending" for hours after approval. Root cause: the inline mint at approval is best-effort, and the only retry — the hourly reconciliation cron — had never run, because its `APP_BASE_URL` variable and `CRON_SECRET` secret were unset, so every scheduled job skipped *silently* (a green pass that hid the dead self-heal). Two fixes: (1) **admin manual drain** — new admin-session-gated route `POST /api/unlock/admin/reconcile-rewards` (no `CRON_SECRET`) plus a "Retry pending rewards" button in `unlock-admin-shell.tsx`, so an admin can grant any approved-but-uncredited reward on demand from the screen; it calls the same idempotent `reconcileUnlockRewards`, so it can never double-grant. (2) **cron hardened** — `.github/workflows/unlock-reward-reconciliation.yml` now resolves the app URL from `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL`, and when the URL or `CRON_SECRET` is missing it skips with a visible warning + run-summary note (not a silent green pass); a configured run that gets a non-200 now fails red. Admin footer copy corrected to point at the manual retry. New command `unlock.admin.rewards.reconcile` added to the command/access/audit contracts. No schema change.
- 2026-06-15: Self-healing reward reconciliation + reward-status UI. The approval reward mint is best-effort (it must not fail the approval), so a transient failure left the reward unissued with no retry. Added a background reconciliation: `lib/unlock/reconcile-rewards.ts` (`reconcileUnlockRewards`) + `listApprovedUnincentivizedSubmissions` find approved submissions with `incentive_granted_at IS NULL` and mint each idempotently (actor `unlock-incentive-system`, key `unlock-approval-submission-<id>`, then `markUnlockIncentiveGranted`); exposed at `POST /api/internal/unlock/reconcile-rewards` (`CRON_SECRET` Bearer) and scheduled hourly by `.github/workflows/unlock-reward-reconciliation.yml`. UI: the admin submission view now shows "Reward granted" vs "Reward pending" (from `incentiveGrantedAt`) on approved submissions, and member + admin copy states the reward "arrives within N hours" using `UNLOCK_REWARD_SLA_HOURS` (24), defined in web (`lib/unlock/constants.ts`) and mirrored in mobile. No schema change. So a member can be told a definite window and the operator can see at a glance whether a reward landed.
- 2026-06-13: Fixed the admin Approve action returning `503` (review failed). On approval the route also grants the Unleash flag and mints the ServiceCredits verification reward; if a provider (Unleash admin API or the Formance ledger) was unavailable, the thrown error fell through to the route's catch and 503'd the whole approval (Reject/Spam, which have no such follow-ups, worked). The verification decision is committed before those follow-ups, so they are now wrapped in a best-effort `try/catch` (reported to Sentry) and no longer fail the approval. The mint stays idempotent (`idempotencyKey` + `markUnlockIncentiveGranted`), so a later retry will not double-grant. No schema or contract change.
- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/unlock` page with `components/unlock/unlock-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, Pending/All tabs, status-pill submission cards) following the `MobileUnlockAdmin.tsx` mockup's visual language but bound to the real Quora-verification queue. Shows the real `getUnlockDashboardSnapshot` counts and `listUnlockSubmissions` records; Approve / Reject / Spam call the existing `POST /api/unlock/admin/submissions/:submissionId/review` (with `x-ctf-csrf: '1'`) and refresh. No fabricated data — the mockup's invented "access gates" model was not implemented because it does not match this backend. No new endpoint, schema, or contract.
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminUnlock.tsx` call sites updated. No backend, schema, or contract change.
- 2026-06-09: Unlock made the single source of truth for full app access (hard cutover). Removed the vestigial v2 `isApproved` flag everywhere — `RequestIdentity`, the bearer-token `VerifiedBearerIdentity`, and the `AllowDecision` no longer carry it, and the `x-ctf-user-approved` / `is_approved` reads are gone. `lib/unlock/access.ts` gained `getUnlockAccessTier(userId)` (Unleash flag first, then the DB tier with lazy expiry) and `isUserUnlocked` now wraps it. `evaluatePluginAccess` replaced its two old options (`requireApprovedUserOrAdmin`, `allowUnlockSupportOnly`) with one `minUnlockTier` (`approved_full` default / `support_only` / `any_authenticated`); denials use the new `unlock_required` reason (the old `unlock_support_only` reason was removed). Hard cutover: only `approved_full` members (or admins) get full app access — everyone else lands in the Unlock flow. `locked_support_only` members get the Hub general channel (read + post) as their support surface; the home page renders the normal Hub for them (nothing is hidden), and redirects `pending_readonly`/unsubmitted members to `/plugin/unlock`. On a plugin route, a not-yet-verified signed-in member (and a signed-out visitor) sees that plugin's public landing page instead of a denial wall, so they can browse and are nudged toward the Unlock flow. Chyme is no longer granted to not-yet-unlocked members (its anonymous public shell is untouched); copy that previously pointed degraded users at Chyme now points them at the Hub general channel and the Unlock flow. Route access posture: Unlock submission/status and account/profile/deletion routes use `any_authenticated`; the Hub uses `support_only`; everything else uses the default `approved_full`. The now-dead `lib/chyme/policy.ts` (`ensureApprovedUserOrAdmin`) was removed. No schema or contract change.
- 2026-06-07: Android Unlock admin actions. Added `ctf/packages/mobile/src/features/unlock/AdminUnlock.tsx` and `admin-api.ts`, registered as a new `unlock-admin` key in `App.tsx`. The Android admin now has the review actions (Approve / Reject) the web admin already supports, instead of being status-only. Binds only the existing endpoints `GET /api/unlock/admin/submissions` and `POST /api/unlock/admin/submissions/:submissionId/review` (mutations send `x-ctf-csrf: '1'`); no new backend. Admin enforcement is server-side; non-admins see an "admins only" notice. Actions are confirm-gated. List keys sit on `<React.Fragment>`, never on host components. Web admin `/admin/unlock` reviewed for responsiveness: already single-column (`max-w-5xl`, stacked `space-y` sections) so no breakpoint change was needed. Gap noted: the review endpoint also accepts a `spam` decision and an optional `reviewNote`, neither of which is surfaced on mobile (matches the web admin and the mockup).
- 2026-06-01: Home page (`app/page.tsx`) now forwards a signed-in-but-not-yet-unlocked member to `/plugin/unlock` instead of rendering the anonymous "please sign in" community shell, which made signing in look like it did nothing. The home access check denies an anonymous visitor with 401 (`AUTH_UNAUTHORIZED`) and a signed-in pending member with 403; only the 403 case is redirected. No route, schema, or contract change — entry-point routing only.
- 2026-05-31: Android pixel pass. Rewrote `ctf/packages/mobile/src/features/unlock/Unlock.tsx` to the `MobileUnlock.tsx` + Empty/Loading/Public mockup; created `api.ts` (GET status, POST submission). Four RN states (loading, public, submission form, status view). MockUnlock.tsx was already empty. No schema/API change.
- 2026-05-29: Web UI circle-back (first design pass; unblocked by the `c5d83c0` design re-pin). Rebuilt the `/plugin/unlock` page to the `Unlock.tsx` mockup + Empty/Loading states, wired to `/api/unlock/status` and `/api/unlock/submission` (the prior `UnlockSubmission` stub never posted; removed). Decomposed into modular sub-components (`unlock-shared`, `unlock-loading`, `unlock-icon-rail`, `unlock-submission-view`, `unlock-sidebar`, `unlock-status-card`, `unlock-right-rail`, `unlock-status-view`, `unlock-shell`). Status/timeline driven by real data; no fabricated URL/reason/timestamps. No schema/API change.
- 2026-03-25: Created initial Unlock CTF rewrite inventory with staged access, admin moderation queue, and one-time approval incentive scope.
- 2026-03-25: Updated for platform-wide enforcement, runtime-config incentive, and status endpoint implementation.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work required in `platform/`.
- [ ] Confirm plugin slug and command namespace lock.
  - Acceptance criteria:
    - Stable plugin slug is `unlock` across docs/contracts/routes.
- [ ] Confirm visibility policy.
  - Acceptance criteria:
    - Hidden in end-user plugin listing and available in admin contexts.

### �� Contract Lock

- [ ] Define Unlock plugin command contracts for v1.
  - Acceptance criteria:
    - Every command conforms to `201-plugin-command-schema-template.mdc`.
- [ ] Define Unlock access policy contracts for v1.
  - Acceptance criteria:
    - Every command has role/attribute/consent/region/deny semantics under `202` template.
- [ ] Define Unlock audit contracts for v1.
  - Acceptance criteria:
    - Every command has allow/deny + result audit coverage under `203` template.
- [ ] Verify command parity across command/access/audit files.
  - Acceptance criteria:
    - Command set matches across all three contract files.

### �� Schema and Persistence

- [ ] Implement Unlock schema and migration(s) in `ctf/migrations/`.
  - Acceptance criteria:
    - Runtime config, submissions, and audit tables exist with constraints/indexes.
- [ ] Implement submission state model and transitions.
  - Acceptance criteria:
    - `pending`, `approved`, `rejected`, `spam` and access-tier transitions are deterministic.
- [ ] Implement incentive grant state marker.
  - Acceptance criteria:
    - Incentive grant is tracked and cannot be double-marked.

### �� User Submission Flow

- [ ] Implement Quora URL submission endpoint.
  - Acceptance criteria:
    - URL required, normalized, host/path validated, and persisted by user.
- [ ] Implement audit writes for allow/deny submissions.
  - Acceptance criteria:
    - Invalid URL and accepted submission outcomes are auditable.

### �� Admin Moderation Flow

- [ ] Implement admin queue listing endpoint.
  - Acceptance criteria:
    - Supports status/tier filters and bounded limit.
- [ ] Implement admin moderation endpoint.
  - Acceptance criteria:
    - Supports approve/reject/spam with reviewer attribution.
- [ ] Implement admin Unlock shell page.
  - Acceptance criteria:
    - Queue snapshot and pending submissions render for admins only.

### �� Incentive Integration

- [x] Implement one-time service-credits grant on approval (runtime-configurable).
  - Acceptance criteria:
    - Approval triggers service-credit mint (amount from runtime config) with deterministic idempotency key.
- [ ] Persist incentive grant marker and audit correlation.
  - Acceptance criteria:
    - Unlock submission stores grant timestamp and service-credits event is auditable.

### �� Access-Tier Enforcement

- [x] Implement platform-wide, centralized access-tier policy integration.
  - Acceptance criteria:
    - Pending users are read-only, expired users are support-only, approved users get full access. Centralized in auth layer with explicit exceptions for Chyme/Unlock APIs and deletion.
- [ ] Implement expiry transition job/path.
  - Acceptance criteria:
    - Pending submissions past window can transition to support-only without manual edits.

### �� Validation and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command schema design documentation.
  - Acceptance criteria:
    - Invalid/unknown field behavior is documented.
- [ ] Access policy and audit design documentation.
  - Acceptance criteria:
    - Unauthorized/invalid transition cases are documented.
- [ ] Deterministic seed scenarios.
  - Acceptance criteria:
    - Seed data includes pending/approved/rejected/spam sample paths.

### Open Decisions Tracker

- [ ] Final copy for survivor-facing verification messaging.
- [ ] Reminder delivery mechanism (cron worker vs event queue).
- [ ] Dynamic incentive amount source of truth (runtime config vs policy constant).

### Change Log

- 2026-06-23: **Android parity — "Retry pending rewards" in Unlock admin (#640).** The React Native Unlock admin screen (`packages/mobile/src/features/unlock/AdminUnlock.tsx` + `admin-api.ts`) gained the same on-demand reward drain as the web `unlock-admin-shell.tsx`. New `reconcileRewards()` client posts to `POST /api/unlock/admin/reconcile-rewards` (admin-session gated, `x-ctf-csrf: '1'`); a confirm-gated "Retry pending rewards" button shows a busy state, surfaces the `{ scanned, granted, alreadyGranted, failed }` result in the existing notice banner, then refreshes the queue. Runs the same idempotent `reconcileUnlockRewards`, so it can never double-grant. No backend, schema, or contract change — binds only the existing endpoint.
- 2026-06-09: A signed-in member who is not yet verified, when browsing a plugin's public landing page, now sees a single "Finish verifying" call-to-action that points at the Unlock flow (`/plugin/unlock`) instead of the anonymous "Sign In" / "Join Free" buttons. This is delivered through a new optional `verifyUrl` prop on the public visitor shells (`PublicVisitorShellProps`); the plugin route page (`app/apps/[pluginSlug]/page.tsx`) passes `verifyUrl="/plugin/unlock"` only when access is denied with `unlock_required` (a signed-in-but-not-verified member) and omits it for an anonymous visitor. Anonymous visitors are unchanged. No schema or contract change.

- 2026-06-01: Multi-currency (issue #120): added `incentive_currency` (FK → `currencies.code`, default ServiceCredits) to `unlock_runtime_config`, naming the currency of `incentive_amount`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.

- 2026-03-25: Created initial Unlock rewrite checklist with contracts, schema, submission/moderation, incentive, and access-tier enforcement phases.
