# CTF Non-Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- This is the CTF rewrite non-plugin parity inventory for shared app capabilities that are not plugin-owned.
- Plugin-owned features are tracked only in plugin inventories under `ctf/docs/developer/ctf-plugin-feature-inventories/`.

---

## 1) Retained Non-Plugin Capability Clusters

### 1.1 Global Routing, App Shell, and Access Wrappers

1. Shared route-group composition for public, protected, and admin-capable shells.
2. Shared app-shell gating wrappers for authenticated access.
3. Shared approval and terms gating wrappers before app/plugin usage.
4. Shared access-denied and redirect behavior contracts across web and Android.

### 1.2 Auth and Account Lifecycle + Onboarding/Approval/Terms Gating

1. Authenticated current-user session retrieval and lifecycle checks.
2. Account lifecycle controls including logout and full-account deletion entry.
3. Onboarding and account-approval gating state handling.
4. Terms-acceptance requirement and persisted acceptance contract.

**Account and per-service data deletion (cross-plugin, backend):**

- Driven by the account deletion registry (`ctf/packages/web/lib/account/deletion-registry.ts`,
  validated against `schema.sql` in CI). See `ctf/docs/developer/ACCOUNT_DELETION_REGISTRY.md`.
- `ctf/packages/web/lib/account/deletion-engine.ts` — pure planner that turns each registry entry
  into delete / idempotent soft-delete SQL (or nothing for retained money/audit tables); checked by
  `ctf/scripts/check-deletion-engine.mjs`.
- `ctf/packages/web/lib/account/deletion-orchestrator.ts` — runs a service-scope or whole-account
  deletion in a single transaction, records one `account_deletion_events` row, logs an
  `[account.audit]` line. Money is settled only by the existing ServiceCredits reclaim flow, never
  hard-deleted here.
- `ctf/packages/web/lib/account/export-engine.ts` + `export-orchestrator.ts` — the read-side twin of
  the deletion engine (issue #1264, JSON data export). The engine is a pure planner over the SAME
  deletion registry: every table with a `userColumn` becomes
  `SELECT * FROM <table> WHERE <userColumn> = $1` (the authenticated user id is always the bound
  parameter, never inlined); `retain` tables (money ledgers, audit trails, shared content) have no
  user column and are skipped — the MVP export scope, stated honestly in the file's `notes`.
  Checked without a DB by `ctf/scripts/check-export-engine.mjs` (wired into CI beside the deletion
  engine check). The orchestrator assembles the self-describing envelope
  `{ exportVersion: 1, generatedAtIso, userId, scope, services[], notes[] }` in ONE transaction so
  the file is a consistent snapshot; each service carries
  `{ slug, name, tables: [{ table, userColumn, rowCount, rows }] }`.
- API:
  - `GET /api/account/services` — read-only projection of the deletion registry for the Account &
    Data UI. Returns `{ ok, deletable[], retained[], counts }`, where each entry is
    `{ slug, name, summary, serviceScopeSupported, exportable }` taken straight from the registry (no
    copy is stored in the route or the UI). `deletable` = `serviceScopeSupported === true`;
    `retained` = `false` (ServiceCredits wallet/ledger kept for financial integrity, settled at
    full-account deletion; GDP / Weekly Performance hold only community-wide aggregate totals).
    `exportable` marks services with ≥1 user-scoped table, i.e. where the JSON export has anything to
    read — independent of deletability (Notifications and Contributor Access are retained-scope for
    delete but still exportable). Gated by `requireAccountAccess` (any signed-in identity, read-only
    — no CSRF needed).
  - `DELETE /api/account/services/:slug` (one plugin) and `DELETE /api/account/full-account`
    (every plugin + ServiceCredits reclaim). Both are self-service (caller's own rows only) and
    same-origin CSRF-guarded (`x-ctf-csrf: 1`).
  - `GET /api/account/services/:slug/export` and `GET /api/account/full-account/export` (issue
    #1264) — download the member's own data as JSON, per service or whole account. Both gated by
    `requireAccountAccess`, read-only (no CSRF needed on GET), returned with
    `Content-Disposition: attachment; filename="ctf-account-data-<scope>-<date>.json"` and
    `Cache-Control: no-store`. Any registry slug is exportable (a service with nothing user-scoped
    returns an honest zero-table envelope; an unknown slug is 404 `ACCOUNT_UNKNOWN_SERVICE`).
    Audit-logged as `account.data.export.service` / `account.data.export.full` (`[account.audit]`
    line with table/row counts, no personal data), and rate-limited per user (10 service exports /
    3 full exports per 10 minutes → 429 `ACCOUNT_RATE_LIMITED` with `Retry-After`; per-process
    fixed-window brake from `lib/security/rate-limit.ts`).
- Data model: `account_deletion_events` (id, user_id, scope, service_name, requested_at,
  completed_at, status, summary). The `GET /api/account/services` projection adds no tables — it
  reads only the in-code registry.
- The user-facing Account & Data surface is now built (PR `feat/account-data-privacy-deletion-ui`):
  - Web: `ctf/packages/web/app/account/data/page.tsx` (auth-gated, same posture as
    `requireAccountAccess`) renders `ctf/packages/web/components/account-data/account-data-shell.tsx`.
    One responsive component set switches desktop/mobile on `useIsMobile()` (768px), with loading,
    empty, populated, and confirm-delete states matching the survivor-hub mockups. Per-service delete
    uses a two-step confirm; full-account delete requires typing the exact phrase `delete my account`.
    The data view also carries the JSON export controls (issue #1264): a "Download all my data
    (JSON)" action at the top, and a per-service Download button beside each Delete button (also on
    retained-list services whose registry entry is `exportable`), with in-flight spinners and inline
    per-row error states; downloads go through fetch → blob so a failure shows inline instead of
    replacing the page.
    Reached from the community shell icon rail (the previously-disabled settings slot now links to
    `/account/data`).
  - Android: `ctf/packages/mobile/src/features/account-data/` (`AccountData.tsx` + `api.ts`),
    registered in `ctf/packages/mobile/App.tsx`, binding to the same three endpoints.
  - Not added to `ctf/config/plugin-parity-contracts.json`: that file is keyed to the **plugin**
    registry (`lib/plugins/repository.ts`), and `check-web-android-parity.mjs` fails any contract
    slug with no matching registry entry. Account & Data is a non-plugin account surface, so its
    Android parity is satisfied by the real feature directory + `App.tsx` registration, not a plugin
    parity contract row.
  - Omitted vs. mockups (no backing API; real-data-only rule 126): "Export all data" and "Deactivate
    account instead" controls, the static encryption badges, and the icon rail's export/notification
    stubs.

### 1.3 Pricing Tier and Payment Admin (API/Control Contract Only)

1. Pricing tier and payment administration remains a non-plugin backend contract area.
2. In-app admin panel parity is explicitly out of scope for CTF rewrite.
3. Operational control plane for pricing/payment admin is Retool-based, not CTF UI.
4. Required CTF scope is stable API/control contracts, policy checks, and audit evidence only.

### 1.4 External-Link Safety Primitive

1. Shared external-link confirmation and safe-open behavior remains app-level non-plugin scope.
2. Shared primitive is consumed by shell and plugin surfaces without duplicating logic.
3. Contract includes normalized URL handling, warning semantics, and explicit open/cancel actions.

**Implementation Status:**
- **Web (Next.js)**: `ctf/packages/web/components/hooks/useExternalLink.tsx`
  - Origin-based internal/external link detection
  - Dialog confirmation for external links with domain display
  - Copy URL to clipboard and "Open in New Tab" actions
  - Automatic support for beta.chargingthefuture.com and any deployed origin
  - Related components: `ui/button.tsx`, `ui/dialog.tsx` (Radix UI-based)
  
- **Android (React Native)**: `ctf/packages/mobile/src/hooks/useExternalLink.tsx`
  - Parity implementation using React Native `Linking` and `Share` APIs
  - Same origin comparison logic for internal/external detection
  - Native Alert dialogs for confirmation flows
  - Copy link via Share sheet, direct open, or cancel actions
  - Type-safe hook interface matching web implementation
  
- **Web+Android Parity**: ✅ COMPLETE (2026-04-01)
  - Feature parity status: core behavior matches across platforms
  - Platform-specific UI conventions respected (Radix UI on web, native dialogs on Android)
  - Integration ready in both platforms

### 1.5 Settings and Accessibility Personalization

1. App-level personalization surface remains shared non-plugin scope.
2. Persistent settings contract includes high contrast mode, font size (`normal`, `large`, `extra-large`), and dyslexia-friendly font.
3. Runtime accessibility token/class application remains app-shell-owned.
4. Plugins consume settings/accessibility state as read-only dependency and do not fork keys.
5. The per-user UI theme is persisted in `user_ui_preferences` (`user_id` PK, `theme` default `'default'`, `updated_at`) and served by `GET` / `PUT /api/account/ui-preferences` (`getUserTheme` / `setUserTheme`; the value is normalized via `normalizeTheme`, CSRF-guarded on write, and gated by `requireAccountAccess` so any signed-in identity reads and sets only its own row).

### 1.6 Member Blocking (cross-cutting safety control)

1. Any signed-in member can block, unblock, and list who they have blocked — a baseline safety boundary gated by `requireAccountAccess` (the same `any_authenticated` gate as account deletion, never the unlock gate). A block is the member's own private boundary: never visible to the person blocked, and it carries no reason.
2. `GET /api/account/blocks` lists the member's blocks newest-first (`listBlocksForUser`). `POST /api/account/blocks` creates a block (body `{ blockedUserId }`; CSRF-guarded; idempotent; a self-block or a blank target returns 400). `DELETE /api/account/blocks/[blockedUserId]` removes a block (CSRF-guarded; idempotent — unblocking a member who is not blocked still returns ok).
3. Optional safety escalation (opt-in): a `POST` with `safetyConcern: true` and an optional short `safetyDetail` writes the block AND a `member_safety_reports` row in one transaction (they succeed or fail together) — the only path by which a member block reaches an admin. Without the flag, nothing is written to the reports table.

**Web and Android delivery status: complete on both.** Web ships the manage-list (`components/blocks/blocked-members-shell.tsx`, mounted at `/account/blocks`) and the reusable block action (`components/blocks/block-member-button.tsx`, with the opt-in safety escalation). Android ships the matching surface in `packages/mobile/src/features/blocks/`: an API client (`api.ts` — `fetchBlockedMembers`, `blockMember`, `unblockMember`, all through the shared authenticated fetch with the `x-ctf-csrf: 1` header on mutations), the "Blocked members" manage screen (`BlockedMembers.tsx` — loading / empty / error / populated states with per-row Unblock), and the reusable `BlockMemberButton.tsx` (confirm dialog with the same opt-in safety escalation). The screen is mounted in the mobile navigator (`App.tsx`, feature key `blocked-members`). Both clients call the same three account routes; no backend, schema, or contract change.

**Where a member can start a block, and where the block is enforced (updated 2026-08-03).** On web the
reusable `BlockMemberButton` is attached to the LightHouse listing detail — the first real member-to-
member surface to carry it — so a seeker can block a host from the place they meet them. LightHouse
also enforces the block: a blocked host's listings are left out of browse, and a stay request between
a blocked pair is refused with `blocked_pair` (403). See §1.6 of the LightHouse inventory.

**Enforcement now covers every member-to-member surface (issue #809 task 4 closed, 2026-08-05).**
`isBlockedBetween` / `isBlockedBetweenTx` (`lib/blocks/repository.ts`) is the shared check, consulted
on each surface's read path (hide the person) and write path (refuse the contact, always with neutral
copy so a block never reveals itself):

- Chyme Back Channel — invite refusal (`back-channel.ts`, since 2026-07-20).
- LightHouse — browse filter + stay-request refusal (inline SQL that also honors the legacy
  read-only `lighthouse_blocks` rows, since 2026-08-03).
- Foundation — provider search hides a blocked provider; `createConnectionThread` and
  `ringInstantCall` refuse a blocked pair (a block created after the thread exists still stops new
  calls).
- SocketRelay — the browse feed hides a blocked owner's posts (owner "Mine" and admin lists stay
  complete); `claimRequest` refuses a blocked pair before the idempotent-retry branch.
- TrustTransport — helper discovery (`listAvailableRequests`) hides a blocked requester's rides;
  `createOffer` and `acceptOffer` refuse a blocked pair.
- Commons — the timeline hides community posts and replies authored by a blocked pair member
  (announcements and AI answers have no member author and always show); the deep-link
  "load around" offset applies the same filter so pagination stays consistent.

MutualTime needs no enforcement and gets none: an event shows only aggregated anonymous voter counts
— no member identity, no member-to-member contact path — so there is nothing for a block to hide or
stop. Mobile: Android still has no per-member profile menu to host the button (the directory list
navigates to Foundation), so on Android the block is started from the manage screen rather than from
a member's context.

### 1.7 Admin Account Restrictions (platform-wide member restriction)

The admin-imposed counterpart to member-initiated blocking (§1.6): an admin restricts a member across the whole platform, scoped to the kind of action being blocked. One canonical row in `account_restrictions` carries the live state (superseding the retired per-plugin flags — TrustTransport `account_restricted`, ServiceCredits wallet `is_frozen`); every restrict/unrestrict is also appended to an immutable `account_restrictions_audit` trail.

1. A restriction carries a **scope**: `all` (full account block, enforced in the auth gate), `trading` (value movement — ServiceCredits transfers, TrustTransport requests), or `contact` (initiating matches/connections). A restriction of scope S blocks an attempted action of scope A when `S === 'all'` or `S === A` (`lib/auth/account-restrictions.ts`).
2. `POST /api/admin/account-restrictions/restrict` — admin-only (`evaluatePluginAccess({ requiredRoles: ['admin'] })`), CSRF-guarded (`x-ctf-csrf: 1` + same-origin). Body `{ targetUserId, reason?, scope? }`; `scope` defaults to `all` and must be one of `all`/`trading`/`contact` (else 400). Idempotent upsert into `account_restrictions`, writes a `restrict` audit row (`restrictAccount`).
3. `POST /api/admin/account-restrictions/unrestrict` — admin-only, CSRF-guarded. Body `{ targetUserId }`. Clears the live row and writes an `unrestrict` audit row (`unrestrictAccount`).
4. `GET /api/admin/account-restrictions/audit` — admin-only, read-only. Returns the most recent 100 restrict/unrestrict audit entries newest-first (`listAccountRestrictionAudit(100)`).
5. **Data model — `account_restrictions_audit`** (immutable audit trail): `id` (uuid pk), `actor_id` (text — the admin), `action` (text, CHECK `restrict`/`unrestrict`), `target_user_id` (text), `scope` (text, null on unrestrict), `reason` (text, nullable), `metadata` (jsonb, default `{}`), `created_at` (timestamptz, default now). Index `idx_account_restrictions_audit_created` on `created_at DESC`. The live-state table `account_restrictions` is tracked separately; this section adds only the audit table.

### 1.8 Safety Report Admin Review Queue

The admin side of the member-blocking safety escalation (§1.6). When a member blocks with `safetyConcern: true`, a `member_safety_reports` row is written; these admin-gated routes are the review queue for those rows. Ordinary blocks never appear here.

1. `GET /api/safety/admin/reports` — admin-gated (`requireSafetyAdminAccess`). Lists member safety reports for the `/admin/safety` queue: open reports first, then newest first; each row carries resolved reporter/reported display names and a count of **other** OPEN reports about the same reported member (the row itself is excluded) so a repeat report stands out (`listSafetyReportsForAdmin`). The reporter/reported display-name lookups use `LEFT JOIN LATERAL … LIMIT 1` on `directory_profiles` so a member with more than one active profile row never fans a report out into duplicate result rows.
2. `POST /api/safety/admin/reports/[reportId]/review` — admin-gated, CSRF-guarded. Body `{ action }` where `action` is `reviewed` (admin looked at / acted on it) or `dismissed` (not a real concern). Only moves a report that is currently **open**, so a repeat action is a harmless no-op; returns 409 when the report is no longer open and 400 on a non-UUID id or an unknown action (`setSafetyReportStatus`). On a successful move it appends a row to the safety audit trail (`insertSafetyAdminAudit`, best-effort) recording the actor, action, and report id. Triage only — a global ban is a separate, later control.
3. **Data model — `safety_admin_audit_trail`**: append-only record of admin moderation decisions on safety reports, mirroring the per-plugin `*_admin_audit_trail` tables. Columns: `id` (uuid pk), `actor_id`, `command`, `policy_status`, `reason`, `target_type`, `target_id`, `metadata` (jsonb), `created_at`. Indexed on `(target_type, target_id, created_at DESC)`. Rows are never updated or deleted. Marking a report reviewed/dismissed writes one row here in addition to stamping `reviewed_at` / `reviewed_by_user_id` on the `member_safety_reports` row.

### 1.9 Internal / Operator Service Endpoints (secret-gated, called by GitHub Actions)

Backend-only endpoints with no UI, each guarded by a dedicated bearer secret and called by a GitHub Actions workflow rather than a signed-in member.

1. `POST /api/internal/account/delete` — operator-only; `Authorization: Bearer ${ACCOUNT_DELETE_SECRET}` (a dedicated secret, **not** the cron secret, because deletion is irreversible). Deletes ANY user's account by id (the admin counterpart to self-service `DELETE /api/account/full-account`): records the request + queues the ServiceCredits reclaim, then deletes every plugin's data via the deletion registry/orchestrator (`deleteAllAccountData`); optionally also deletes the Clerk identity (`deleteClerk` defaults true). Money is retained (wallets/ledgers are `retain` in the registry, settled by the reclaim flow). Returns 503 when the secret is unset, 403 on a wrong/absent secret, 400 when `userId` is missing; writes a chyme audit row. Called only by the manual `Delete Account (manual)` Actions workflow.
2. `POST /api/internal/product-update` — `Authorization: Bearer ${INTERNAL_SERVICE_SECRET}`. Creates and immediately publishes a feed announcement from `{ title, body }` under the synthetic actor `ci-product-update`, writing a feed audit row. Returns 503 when the secret is unset, 401 on a wrong secret, 400 on missing fields. Lets a release pipeline post a product-update announcement to the feed.

### 1.10 Operational Probes

1. `GET /api/health` — no auth, `force-dynamic`. Returns `{ status: 'ok', featureFlags: 'configured' | 'defaults' }` (the flag reports whether the feature-flag backend is configured). Liveness/readiness probe.
2. `GET /api/plugin/policy-probe` — returns the caller's plugin-access decision via `evaluatePluginAccess`. With `?adminOnly=true` it evaluates the admin gate (`requiredRoles: ['admin']`), otherwise any signed-in identity; returns `{ allowed, userId, requiredRoles }` on allow, or the deny decision with its status. A diagnostics endpoint for verifying the access gate.

### 1.11 Legacy Profile URL Redirects

1. Old `/platform` profile URLs are mapped to current rewrite URLs by the catch-all page route `/apps/[pluginSlug]/[scope]/[id]` (`ctf/packages/web/app/apps/[pluginSlug]/[scope]/[id]/page.tsx`) — e.g. `/apps/directory/public/{legacyId}` → `/apps/directory/{newId}`, `/apps/lighthouse/property/{legacyId}` → `/apps/lighthouse/property/{newId}`. On a miss (deleted or not-yet-migrated entity) it falls back to the plugin shell `/apps/{pluginSlug}`. This is a server-rendered page, not an API route.
2. **Data model — `legacy_profile_redirects`**: composite primary key `(plugin_slug TEXT, scope TEXT, legacy_entity_id UUID)` mapping to `current_entity_id` (uuid) with `created_at` (timestamptz, default now). Read-only during migration; no API route writes it (populated out-of-band).

### 1.12 Public Terms and Privacy Policy Page

1. `/terms` (`ctf/packages/web/app/terms/page.tsx`) is a static, publicly reachable page (no auth gate; the middleware only sets identity headers and never protects routes) that renders both the **Terms and Conditions** and the **Privacy Policy** for `app.chargingthefuture.com/terms`. It is a server component, not an API route, and reads no database table.
2. Copy lives in `ctf/packages/web/app/terms/policy-content.ts` as plain data (so the page component stays a small renderer under the rule-116 max-lines gate); styling is `ctf/packages/web/app/terms/terms.module.css` using the shared `--ctf-*` theme tokens so the page follows both the default and comic themes.
3. The policy copy is written to match actual product behavior and should be kept in sync when that behavior changes: the third parties that process member data (Clerk, GetStream, Sentry; hosting/push transports) — **Formance is NOT a third party: it is the open-source ledger self-hosted inside our own infrastructure (`ctf-formance-ledger` on our hosting, with a Postgres we own and back up), so member transaction records are not shared with an outside provider; the policy lists the ledger under our own hosting/infrastructure, not as a data-sharing recipient** — the non-cash/non-withdrawable nature of ServiceCredits (vs. the separate real-money TrustTransport payouts), the transaction-bound messaging model, the automated-processing disclosure (Questions text is processed by our own self-hosted AI model on our compute infrastructure to draft an answer; not used to train third-party models), what account deletion removes vs. retains (own content and own messages removed; money/ledger/audit/deletion-accountability records retained), the invite-only + verification access model, adults-only (18+) eligibility, and the data-request/rights process. Operator named as "Charging the Future" (unincorporated), governing law Delaware, contact `ctf.connected070@slmails.com`.
4. **Android delivery: link-out (complete).** The React Native app links out to the hosted `/terms` page rather than re-rendering the legal text natively. A "Terms & Privacy Policy" footer link on the Account & Data screen (`ctf/packages/mobile/src/features/account-data/AccountData.tsx`) opens `${APP_URL}/terms` via `Linking.openURL` (falling back to `https://app.chargingthefuture.com/terms` when `APP_URL` is unset). This is a non-plugin account surface, so no `plugin-parity-contracts.json` entry applies (same rationale as the Account & Data screen in §1.2). Closes #1295.

### 1.13 Webhook Receivers

1. `POST /api/webhooks/clerk` (`ctf/packages/web/app/api/webhooks/clerk/route.ts`) — receives Clerk webhook deliveries. Signature-verified: Clerk signs with svix, and the route verifies the `svix-id` / `svix-timestamp` / `svix-signature` headers against `CLERK_WEBHOOK_SIGNING_SECRET` (HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`, constant-time compare, ±5-minute replay window) — this Clerk version ships no verify helper and svix is not a dependency, so verification is done with `node:crypto`. The **only** event actioned is `user.deleted`: when a member deletes their Clerk account directly (Clerk's hosted "Delete account", outside the app's own Delete Account flow), Clerk removes the identity but the app otherwise never hears about it, leaving every plugin's data orphaned on a dead id — and the v2 Quora port then re-approves + re-rewards them. On `user.deleted` it runs the **same** cleanup as the app's Delete Account flow — `markFullAccountDeletionRequested` (records the request + queues the ServiceCredits reclaim) then `deleteAllAccountData` via the deletion registry/orchestrator — forced to the production pool, and never calls Clerk `deleteUser` (the identity is already gone). Idempotent: the app's own delete flow calls Clerk `deleteUser`, which also fires this webhook, so if an account-scope `account_deletion_events` row already exists it skips (no duplicate event, no double reclaim). All other event types are acknowledged (200) so Clerk does not retry. Inert until `CLERK_WEBHOOK_SIGNING_SECRET` is set (returns 503), so it cannot fire before the Clerk dashboard endpoint + secret are configured. Writes a chyme audit row (`account.profile.delete.full`, actor `clerk-user-deleted-webhook`). Related operator report: `ctf/scripts/reportGhostUnlockRewards.mjs` lists v2-ported Unlock submissions whose Clerk user no longer exists (the stranded rewards this webhook now prevents), read-only, for a batch revoke.

### 1.14 Admin Landing "New to Review" Dots

The admin landing (`/admin`) shows a small amber dot on an area's tile when that area has items an admin has not seen yet — a new pending review, report, or dispute since they last opened it. It answers "where is there something new for me to act on" without opening every area. This is admin-facing and separate from the member notifications center.

1. **What counts as "new to review".** For each area with a real review queue on its admin page, the dot counts rows that are actionable (pending/open/unresolved) AND arrived (`created_at`) after this admin last opened that area. The signal registry (`ctf/packages/web/lib/admin/area-attention.ts`) covers: **unlock** (`unlock_verification_submissions` `review_status='pending'`), **comic / AI Assistant** (`comic_review_queue` `status='pending'`), **bug-reports** (`bug_reports` `status IN ('new','held_for_review')`), **contributions** (`contributions_submissions` `status='pending'`), **safety** (`member_safety_reports` `status='open'`), **skills-hunt** (`skills_hunt_submissions` `status='pending'` and `skills_hunt_submission_reports` `status='open'`), **trust-transport** (`trust_transport_disputes` `status='open'` and `trust_transport_risk_signals` `is_resolved=FALSE`), and **what-works** (`what_works_products` `status='pending'`), plus **peer-programming** (`peer_programming_feedback` — no status column, so the dot flags feedback that arrived since the admin last opened the area), **level-up** (`level_up_disputes` `status='open'` and `level_up_milestone_validations` `status='pending'`), and **service-credits** (`service_credits_disputes` with no matching `service_credits_dispute_adjustments` — an open, unadjusted dispute). All read-only counts on tables owned by those plugins.
2. **Areas with no dot.** Areas that are read-only dashboards, config editors, authoring, or browse views never get a dot: directory, beacon, lighthouse, foundation, socket-relay, weekly-performance, workforce, feed-announcements, contributor-access.
3. **Clearing a dot.** Opening a tile marks that area seen for the admin, which clears its dot until newer items arrive. `POST /api/admin/area-seen` (admin-only via `evaluatePluginAccess({ requiredRoles: ['admin'] })`, CSRF-guarded `x-ctf-csrf: 1` + same-origin) upserts the per-admin marker; body `{ areaSlug }`. A slug with no signal is accepted and ignored, so the client can call it for any tile. The landing tile grid (`ctf/packages/web/app/admin/admin-area-grid.tsx`) calls it fire-and-forget on click.
4. **Data model — `admin_area_seen`**: `user_id` (text), `area_slug` (text), `seen_at` (timestamptz, default now), primary key `(user_id, area_slug)`. One row per admin per area, updated to `NOW()` when the admin opens that area. Best-effort: a read/write failure degrades to "no dot" and never breaks the landing.

### 1.15 Community Reviews (public social proof)

An owner-curated list of real community comments, shown two ways on the public (signed-out) web surface as social proof. Member-facing, web-only; there is no Android surface and no member-submission path (the list is curated, not user-generated, so there is no moderation queue or abuse surface). No database table — the list is a code module.

1. **Data source — `ctf/packages/web/lib/reviews/reviews-data.ts`.** A hand-maintained `REVIEWS` array (`Review` type: `id`, `author`, `source`, `sourceUrl`, `quote`, `context?`, `date?`, `consent`, `active`) plus `getActiveReviews()` (active entries, newest first). Attribution policy (owner decision): show a first name + last initial and a link to the original public comment; a full name only when `consent: true`. Only real, attributable, owner-approved entries — never fabricated.
2. `GET /api/reviews` (`ctf/packages/web/app/api/reviews/route.ts`) — public, sign-in-free, read-only. Returns `{ ok, reviews }` from `getActiveReviews()`. Per-IP `enforcePublicReadRateLimit(request, 'reviews-public')`, edge-cacheable (`Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600`), and CORS-open (`Access-Control-Allow-Origin: *`, plus an `OPTIONS` preflight) so the separate marketing landing page (a different origin) reads the same list. No table.
3. **Corner widget — `ctf/packages/web/components/reviews/reviews-widget.tsx`** (client). A calm, auto-cycling "social proof" popup (one review at a time, bottom-left) rendered on every public plugin page from the single public branch of `/apps/[pluginSlug]/page.tsx`. It fetches `/api/reviews`, appears after a short delay, advances slowly, pauses on hover/focus, is dismissible for the session (`sessionStorage`), respects `prefers-reduced-motion` (no auto-advance/fade), uses `aria-live="polite"`, and links each quote to its source and to the wall. Renders nothing when the list is empty or the visitor dismissed it.
4. **Wall page — `/reviews`** (`ctf/packages/web/app/reviews/page.tsx`, "What survivors are saying"). A public, server-rendered card wall (`ctf/packages/web/components/reviews/reviews-wall.tsx`) of the same `getActiveReviews()` list — no client fetch, no flash. Publicly reachable (the middleware only sets identity headers and never protects routes, same as `/terms` in §1.12).
5. **Android delivery: out of scope** — a web-only public marketing surface; the React Native app has no reviews surface (rule 105).

---

## 2) Explicit Exclusions from This Parity Inventory

1. Monitoring, telemetry, and service-status operations are out of this parity inventory.
2. Generic messaging/chat surface is not carried over.
3. Admin activity feed is not carried over as a CTF UI/API requirement.
4. Skills taxonomy is plugin-owned and tracked in its own plugin inventory.
5. Weekly performance is plugin-owned and tracked in its own plugin inventory.

### 2.1 Compliance Position for Admin Activity Feed Removal

1. No admin activity feed UI/API is required for parity if backend audit evidence paths remain enforced and documented.
2. Required controls remain: privileged-action attribution, allow/deny outcome capture, and immutable audit evidence retention per compliance rules.

---

## 3) Rule Alignment

1. `.claude/rules/index.mdc`
   - Keeps rewrite scope in `ctf/`, preserves plugin-first ownership boundaries, and treats legacy as reference-only.
2. `.claude/rules/120-plugin-feature-inventory-lifecycle-rules.mdc`
   - Requires plugin-owned capabilities (weekly-performance, skills-taxonomy) to move into dedicated plugin inventory/checklist docs.
   - This non-plugin inventory is explicitly exempt from Rule 120 plugin-required content sections and uses alternate non-plugin capability criteria.
3. `.claude/rules/004-authz-authn-and-admin-controls.mdc`
   - Requires server-side authz/authn hardening for retained non-plugin auth/account and privileged contract surfaces.
4. `.claude/rules/007-audit-logging-and-monitoring.mdc`
   - Allows admin feed removal while still requiring complete audit logging coverage and protected evidence paths.
5. `.claude/rules/014-compliance-rules-index.mdc`
   - Keeps compliance modules mandatory for retained non-plugin contracts and plugin-owned rewrites.

---

## 4) Legacy Evidence Pointers (Reference-Only)

1. `ctf/docs/developer/non-plugin-feature-inventory.md`
2. `ctf/docs/developer/skills-database-admin-feature-inventory.md`

---

## 6) Governance Note (Rule 120 Exemption)

1. Plugin-first ownership rules still apply to plugin-owned capabilities and must be implemented through plugin inventory/checklist artifacts.
2. This non-plugin inventory remains an exempt parity/governance document under alternate non-plugin capability criteria.
3. This document is not a blocker for plugin coding readiness when plugin-owned requirements are satisfied in their plugin inventories.

---

## 5) Change Log

- 2026-08-03: **The member block now has a real starting point and a first enforcing surface (§1.6).**
  The reusable `BlockMemberButton` had been built, exported, and attached to nothing, so the only way
  to block anyone was the manage-list at `/account/blocks` — which needs you to already know who you
  are blocking. It is now attached to the LightHouse listing detail, and LightHouse honors the block
  on both paths: a blocked host's listings are left out of browse, and a stay request between a
  blocked pair is refused. Recorded plainly in §1.6 which surfaces do and do not yet consult
  `isBlockedBetween`, so the remaining enforcement work is visible instead of implied. No change to
  the block routes, schema, or contracts.
- 2026-07-26: **Orphan v2 table audit tool (issue #520, ops tooling — no app change).** New read-only script `ctf/scripts/audit-orphan-tables.mjs`: run wherever `DATABASE_URL` is available (e.g. through Infisical) to list live production tables, subtract the v3 keep-set derived from `ctf/schema.sql`, scan the whole codebase for references (two strengths: SQL-context hits keep a table; bare-word-only hits are flagged "likely orphan" for hand review — the scan always fails toward keeping, so e.g. `users` is kept on its real SQL references), and write two review artifacts — a `pg_dump` backup command and a guarded `DROP TABLE … CASCADE` script — for the owner to review and run **manually**. The tool never executes a drop (only SELECTs). `--offline` audits the issue #520 candidate list against the codebase without a database; its current result (30 confirmed orphans, `users`/`announcements` kept) is posted on the issue. `ctf/schema-prod4.6.2026.sql` is treated as an annotation source only, NOT a keep-set — it is an April-2026 production snapshot that itself contains the v2 leftovers. Generated artifacts are gitignored.
- 2026-07-26: **JSON data export on Account & Data — download your data, the read-side twin of delete (issue #1264, web).** A signed-in member can now download their data as a JSON file from `/account/data`: per service (a Download button beside each Delete button, and on retained-list services that still hold the member's own rows, e.g. Notifications), or the whole account ("Download all my data (JSON)" at the top of the data view). New pure `lib/account/export-engine.ts` mirrors the deletion engine over the SAME schema-validated registry (`SELECT * FROM <table> WHERE <userColumn> = $1`; retain tables skipped — MVP scope 2a, stated in the file's own `notes`), with `lib/account/export-orchestrator.ts` assembling the self-describing envelope (`exportVersion: 1`, `generatedAtIso`, `userId`, `scope`, `services[].tables[]` with `rowCount` + `rows`) in one transaction for a consistent snapshot. New routes `GET /api/account/services/:slug/export` and `GET /api/account/full-account/export` — auth-gated (`requireAccountAccess`), self-only ($1-bound user id), audit-logged (`account.data.export.service` / `.full`), per-user rate-limited (10 service / 3 full per 10 min → 429), downloaded via `Content-Disposition: attachment`. `GET /api/account/services` gains `exportable` per entry. New CI check `ctf/scripts/check-export-engine.mjs` validates every generated SELECT without a DB, exactly like the deletion-engine check. No schema change (read-only; no new table). Follow-ups deliberately deferred: exporting user-owned retained rows (money/audit ledgers — scope 2b) and the Android share-sheet flow.
- 2026-07-23: **Admin landing "new to review" dots (§1.14).** The admin landing (`/admin`) now shows an amber dot on an area's tile when that area has actionable items an admin has not seen yet — a new pending review, report, or dispute since they last opened it — so an admin knows which area to open without checking each. New table `admin_area_seen` (per-admin, per-area last-opened marker) and route `POST /api/admin/area-seen` (admin-only, CSRF-guarded) that clears a dot on open. The per-area signal registry (`lib/admin/area-attention.ts`) counts actionable rows newer than the marker for: unlock, comic, bug-reports, contributions, safety, skills-hunt (nominations + reports), trust-transport (disputes + risk signals), and what-works. Areas that are dashboards/config/browse (directory et al.) get no dot. Server-computed on the landing (`app/admin/page.tsx`), rendered by the new client tile grid (`app/admin/admin-area-grid.tsx`). Best-effort throughout: any failure degrades to "no dot" and never breaks the landing. `schema.demo.sql` regenerated. Admin-facing and separate from the member notifications center.
- 2026-07-22: **Standardized internal-route "not configured" responses and small cleanups (code-review sweep #1819–#1824).** No behavior change for correctly-configured callers. The internal service routes returned inconsistent status codes when their secret env var was absent; they now uniformly return **503** ("not configured") so a workflow/cron caller can tell a misconfigured deployment from a wrong credential (401/403): `POST /api/internal/product-update` and `POST /api/internal/weekly-performance/goal-snapshot` and `POST /api/internal/contributor-access/recompute` were **501 → 503** (#1821, #1822); `POST /api/internal/service-credits/accounts/[accountId]/deletion-reclaims/[deletionRequestId]/execute` now returns **503** (`service_credits_internal_not_configured`) when its token is unset instead of a 403 that looked like an auth failure (#1823). In `account/delete` and the service-credits reclaim route the env-var presence check now lives only in the 503 guard, and `isAuthorized` takes the validated secret and checks correctness only (removes the duplicated/unreachable check, #1820). Added a comment in `account/delete` clarifying that the failure-path audit's `status: 'allow'` is the policy-gate decision (not the outcome, which is `result: 'failure'`) — semantically correct, no change (#1819). `unlock/reconcile-rewards` now coerces `body.limit` with a `typeof`/`Number.isFinite` guard instead of a redundant `Number()` cast (#1824). Copy of the §1.9 product-update status code updated to 503. No schema or contract change.
- 2026-07-20: **Privacy policy corrected — Formance is self-hosted, not a third party (owner report).** The `/terms` Privacy Policy listed Formance under "Service providers we share information with," stated it was "bound by a data-processing agreement," and said it "Receives transaction records" — implying member transaction data is sent to an outside company. That is inaccurate: Formance is the open-source ledger, self-hosted inside our own infrastructure (`ctf-formance-ledger` on our hosting, with a Postgres we own and back up nightly via `backup-formance.yml`), so no member data leaves to a third party. `policy-content.ts` now: (1) removes the Formance bullet from the third-party sharing list (§4) and instead names the self-hosted ledger inside the "hosting and infrastructure (our own systems)" bullet; (2) §1 "What we collect" describes transactions as "recorded in our own self-hosted ledger (Formance), which runs inside our infrastructure"; (3) the ServiceCredits/payments section describes real-money payouts as "recorded in our own self-hosted ledger (Formance)…" rather than "handled through our ledger provider, Formance." The other listed providers (Clerk, GetStream, Sentry, hosting/push transports) are genuine third parties and are unchanged; Supabase is not listed because the web app does not use it for any member data. Also added an **automated-processing disclosure** to §3 ("How we use your information"): the Questions feature sends the member's question text to our own self-hosted AI model (Ollama, running on our compute infrastructure) to draft an answer, the content is not used to train any third-party model, and a draft answer is a suggestion (not a decision with a legal/similarly significant effect). Infrastructure hosts (Render/Railway/RunPod) are deliberately kept as categories, not named, per owner decision — category disclosure is sufficient and avoids drift on host migrations. Copy-only; no route, schema, or contract change.
- 2026-07-17: **History-aware back navigation (owner directive) + shared admin↔member navigation
  controls.** The in-app back control (the shared chevron on every screen) now returns to the
  **previous in-app page** when there is one, instead of always jumping one level up; the tailored
  one-level-up destination (`resolveBackTarget`) remains the fallback for screens opened with no
  in-app history (deep links, installed-app cold starts). Implemented centrally in
  `ctf/packages/web/lib/nav/back-history.tsx`: `NavHistoryTracker` (mounted once in the root layout)
  keeps a per-tab pathname stack in sessionStorage, `useSmartBack()` picks real history back vs the
  fallback, and `BackChevronButton` is the standalone shared chevron for shells with their own
  phone-width headers. `MobileScreenHeader` and `PluginRailFooter` now route through `useSmartBack`
  (buttons instead of fixed links; identical styling), and `MobileScreenHeader` gained an `actions`
  prop for extra header controls on both breakpoints. New shared `PluginUserShellButton`
  (`components/shared/plugin-user-shell-button.tsx`) — the admin-side counterpart of
  `PluginAdminButton` — links an admin surface to its plugin's member shell. Rule
  `.claude/rules/134-navigation-and-back-control-rules.mdc` updated with the superseding owner
  decision (2026-07-17). UI-only; no schema, route, or contract change.

- 2026-07-18: **Public user guide at `/guide` + grounded auto-generator.** New public, no-auth page
  (`ctf/packages/web/app/guide/`, modeled on `/terms`): one branded page with a jump-link table of
  contents, a per-section "Last updated" date, and back-to-top links, rendering a generated
  `guide-content.json`. `ctf/scripts/generate-user-guide.mjs` builds that file (and a shareable
  `ctf/docs/USER_GUIDE.md` copy) from each member-facing plugin's inventory "User Features" section
  and its test script "Core smoke" steps, rewritten in the project's plain voice under the same
  anti-fabrication grounding as the product-update generator (issue #1471): it can only describe what
  those docs already state, never "verified/vetted/score" or any invented capability, and dates each
  section from the last commit touching its source docs. `.github/workflows/generate-user-guide.yml`
  regenerates on plugin-doc changes and opens a PR for review before the public page updates; a manual
  run with `publish_wiki=true` also pushes the markdown copy to the GitHub wiki. The `/terms` footer
  links to it. Content-only public surface; no schema, route, or contract change.
- 2026-07-17: **Public-read rate limiter hardening (code-review findings #1579, #1581).** `getClientIp`
  in `ctf/packages/web/lib/security/rate-limit.ts` no longer keys on the **first** `x-forwarded-for`
  value: that entry travels in from the outside world (Render's proxy appends to the incoming list
  rather than replacing it), so a caller could send a fake header and rotate through fresh per-request
  buckets, voiding the limit. It now prefers `cf-connecting-ip` (set by Cloudflare, which fronts
  Render services, to the address it actually accepted the connection from) and falls back to the
  **last** `x-forwarded-for` entry — appended by the nearest proxy hop, which a caller cannot forge;
  with several trusted hops that collapses callers into the upstream proxy's address, which fails
  toward limiting too much, never toward a bypass. Also moved the `lastPruneMs` stamp to after the
  prune loop with a comment on why (re-entry safety if the loop ever gains an await). Same 30/min
  limit, same endpoints, no route or contract change.
- 2026-07-17: **Clerk `user.deleted` webhook + ghost-reward report (§1.13).** Closes a data-integrity gap: a member who deletes their Clerk account directly (Clerk's hosted "Delete account", outside the app's own flow) left every plugin's data orphaned on a dead id, and the v2 Quora port re-approved + re-rewarded them (surfaced by a real case — an `approved_full`, reward-granted Unlock row whose Clerk user was gone). New signature-verified `POST /api/webhooks/clerk` runs the same cleanup as the app's Delete Account flow on `user.deleted` (record + ServiceCredits reclaim + `deleteAllAccountData`), idempotent against the app flow's own Clerk `deleteUser` (which fires the same webhook), and inert until `CLERK_WEBHOOK_SIGNING_SECRET` is configured. New read-only `ctf/scripts/reportGhostUnlockRewards.mjs` lists existing v2-ported submissions whose Clerk user no longer exists (stranded rewards) for a batch revoke. Preventive companion (owner action, no code): disable the "Delete account" option in Clerk's hosted user profile so all deletions route through the app flow. No schema change.
- 2026-07-16: **Crawler policy and public-endpoint rate limiting (owner approved).** New
  `ctf/packages/web/app/robots.ts` serves `/robots.txt`: allow `/` (the public marketing shells are
  meant to be crawled), disallow `/api/`, `/admin/`, `/account`, `/plugin/`; no sitemap reference (the
  app has no sitemap route). New shared limiter `ctf/packages/web/lib/security/rate-limit.ts` — an
  in-memory fixed-window per-process brake (`checkRateLimit`, plus `enforcePublicReadRateLimit` which
  keys per IP from the first `x-forwarded-for` value, falling back to `unknown`) — applied at
  30 requests/minute per IP to the unauthenticated public read endpoints only:
  `GET /api/feed/public/community`, `GET /api/chyme/public/room`, `GET /api/what-works/public`,
  `GET /api/socket-relay/public`, `GET /api/socket-relay/public/[id]`,
  `GET /api/workforce/public-snapshot`, `GET /api/skills-taxonomy/summary`, `GET /api/beacon/current`.
  Over-limit callers get `429` with a `Retry-After` header and a plain JSON `{ error }`.
  `GET /api/health` is deliberately not limited (uptime probes). Limits are per server process
  (reset on deploy, per-instance) — a first bulk-abuse brake, not a distributed quota; authenticated
  plugin routes are untouched. No schema or contract change.
- 2026-07-15: **Plugin registry/catalog code-review fixes (findings #1533, #1534, #1536, #1537).**
  `GET /api/plugins` now double-gates the non-admin list: on top of the admin-only-slug filter
  (`filterPluginsForViewer`), non-admin responses explicitly drop rows with `isVisible === false`
  instead of relying only on the upstream DB/fallback exclusion (no behavior change today; defense in
  depth). `buildSummary` in `lib/plugins/repository.ts` gained a comment documenting that `alpha`/
  `beta` availability states deliberately fold into the `planned` bucket until a real alpha/beta
  plugin exists (no API shape change). The generic public visitor shell
  (`components/plugins/generic-public-shell.tsx`) now branches its paragraph copy on `verifyUrl`, so a
  signed-in-but-unverified member sees "finish verifying" copy that matches the "Finish verifying"
  button instead of a sign-in invitation. `lib/plugins/plugin-catalog.ts` was re-synced with the
  registry: added `recurring-activity` and removed `feed-announcements` (retired as a navigable app;
  the catalog is imported by no code and feeds no validation allowlist — the money-transfer
  originPlugin allowlist reads the fallback registry in `repository.ts` — so nothing can reference
  the removed id). No schema, route-surface, or contract change.
- 2026-07-14: **Android pull-to-refresh on Account & Data and Blocked members.** The React Native `AccountData.tsx` and `BlockedMembers.tsx` screens now support pull-to-refresh: dragging down re-pulls the service list / block list in the background (the load functions gained a background flag so the full-screen spinner does not flash). Mobile-client only — no backend, schema, route, or contract change.
- 2026-07-01: **Public Terms and Privacy Policy page added** (`/terms`). New static, public server component `ctf/packages/web/app/terms/page.tsx` with copy in `policy-content.ts` and styling in `terms.module.css`, rendering both the Terms and Conditions and the Privacy Policy for `app.chargingthefuture.com/terms`. No API route, no schema, no contract change; no middleware change needed (routes are not gated in middleware). Documented in §1.12. Copy is source-accurate (third-party processors — Clerk, GetStream, Formance, Sentry, hosting/push; ServiceCredits non-cash nature, transaction-bound messaging, deletion keep/remove behavior, invite-only + verification access, 18+ eligibility, data-request rights) and must be kept in sync if that behavior changes.
- 2026-06-26: **Android member-blocking surface delivered** (issue #809 Android parity; mobile-client only, no backend/schema/contract change). Added `packages/mobile/src/features/blocks/`: an API client (`api.ts`) binding the existing `GET`/`POST /api/account/blocks` and `DELETE /api/account/blocks/[blockedUserId]` routes through the shared authenticated fetch (Clerk bearer token + `x-ctf-csrf: 1` on mutations, with a request timeout and server-message error mapping); a "Blocked members" manage screen (`BlockedMembers.tsx`) with loading / empty ("You haven't blocked anyone") / error / populated states and a per-row Unblock; and a reusable `BlockMemberButton.tsx` confirm-dialog action that mirrors the web's optional safety escalation. Mounted the manage screen in the mobile navigator (`App.tsx`, feature key `blocked-members`). Updated §1.6 with the web+Android delivery status. Mobile gap recorded in §1.6: the reusable block action is exported for reuse but not yet attached to a per-member profile menu on Android (none ships yet), matching the web.
- 2026-06-25: **Documented non-plugin/infra tables and routes** (inventory-debt burn-down — documentation catch-up, no code change). Added §1.7 admin account restrictions (`account_restrictions_audit` table + `POST /api/admin/account-restrictions/restrict`, `/unrestrict`, `GET /api/admin/account-restrictions/audit`), §1.8 safety report admin review (`GET /api/safety/admin/reports`, `POST /api/safety/admin/reports/[reportId]/review`), §1.9 internal/operator endpoints (`POST /api/internal/account/delete`, `POST /api/internal/product-update`), §1.10 operational probes (`GET /api/health`, `GET /api/plugin/policy-probe`), and §1.11 legacy profile URL redirects (`legacy_profile_redirects` table). Each verified against the route handlers and `schema.sql`. Removed these 2 tables and 9 routes from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-25: **Documented account-level surfaces** (inventory-debt burn-down — documentation catch-up, no code change). Added the per-user theme table `user_ui_preferences` and `GET`/`PUT /api/account/ui-preferences` to §1.5, and a new §1.6 covering member blocking: `GET`/`POST /api/account/blocks` and `DELETE /api/account/blocks/[blockedUserId]` (with the optional safety-escalation path). Each verified against the route handlers and `schema.sql`. Removed these four items from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-12: Android Account & Data API client (`packages/mobile/src/features/account-data/api.ts`) now calls the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain fetch against an environment-variable base URL with no auth token. The request-timeout guard is kept. No backend, schema, or contract change.
- 2026-06-08: Recorded the removal of two off-brand "coming soon" placeholders from the community shell, which the readiness audit (#344) flagged as out of scope and the owner confirmed are not part of the product. The general person-to-person **Direct Messages** list (left sidebar; no backend, dead click handler, fake unread counts) and the permanently disabled **Notifications** bell button (icon rail) are gone, along with their now-unused props, state, fetch call, `/api/hub/dms` route, types, and CSS. The homepage hub's open community channel list and the feed stay exactly as they were. (The code for these removals already landed in #346 for Direct Messages and #350 for Notifications; this entry documents the decision and confirms the channel/feed were preserved.)
- 2026-06-01: Added the cross-plugin account/per-service data deletion backend (registry-driven engine + orchestrator, `account_deletion_events` table, `DELETE /api/account/services/:slug` and `DELETE /api/account/full-account`, which now orchestrates the mixed delete/soft-delete/retain plan across every plugin instead of only recording a request). Documented in section 1.2 and `ACCOUNT_DELETION_REGISTRY.md`. No UI (design-gated).
- 2026-04-01: Completed external-link safety primitive parity implementation across web and Android with full feature feature parity (origin-based detection, safe-open dialogs, copy/open actions).
- 2026-02-25: Expanded CTF non-plugin parity inventory to full retained/excluded scope; marked weekly performance and skills taxonomy as plugin-owned; removed generic chat/admin activity feed carryover requirements; documented compliance position for audit-evidence-first admin activity feed removal.
- 2026-02-25: Removed weekly-performance legacy-evidence pointer so weekly rewrite parity remains sourced from plugin-inventory documents.
- 2026-02-25: Added Rule 120 non-plugin exemption governance note and clarified non-blocking status for plugin coding readiness.


## Build Checklist


### Scope (Settings + Accessibility Personalization Only)

- [ ] Confirm this checklist tracks only the app-level `Settings and Accessibility Personalization` cluster from `ctf-plugin-feature-inventories/ctf-non-plugin-feature-inventory.md`.
- [ ] Confirm work is limited to rewrite target (`ctf/`) and does not modify legacy `platform/`.

### App-Level User Capabilities

- [ ] Provide a shared app-level settings/personalization route or surface (not plugin-local).
- [ ] Persist user preferences through the approved app-level settings contract.
- [ ] Support personalization controls for:
  - [ ] High contrast mode
  - [ ] Font size: `normal`, `large`, `extra-large`
  - [ ] Dyslexia-friendly font
- [ ] Apply accessibility classes/tokens at runtime through shared app-shell behavior.

### Cross-Plugin Consumption Contract

- [ ] Ensure plugins consume settings/accessibility state as read-only.
- [ ] Prevent plugin-specific duplicate settings keys for these controls.
- [ ] Keep web and Android behavior aligned to the shared contract.

### Explicit Exclusions

- [ ] Do not add a GentlePulse plugin-local Settings page for CTF parity.
- [ ] Exclude third-party admin tooling from this checklist and implementation scope.

### Completion Gate

- [ ] Verify all checklist items map directly to Section 1 (1.1–1.3) of `ctf-plugin-feature-inventories/ctf-non-plugin-feature-inventory.md`.
- [ ] Record any out-of-scope requests as follow-ups rather than expanding this checklist.
