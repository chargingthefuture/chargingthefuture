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
- API:
  - `GET /api/account/services` — read-only projection of the deletion registry for the Account &
    Data UI. Returns `{ ok, deletable[], retained[], counts }`, where each entry is
    `{ slug, name, summary, serviceScopeSupported }` taken straight from the registry (no copy is
    stored in the route or the UI). `deletable` = `serviceScopeSupported === true`; `retained` =
    `false` (ServiceCredits wallet/ledger kept for financial integrity, settled at full-account
    deletion; GDP / Weekly Performance hold only community-wide aggregate totals). Gated by
    `requireAccountAccess` (any signed-in identity, read-only — no CSRF needed).
  - `DELETE /api/account/services/:slug` (one plugin) and `DELETE /api/account/full-account`
    (every plugin + ServiceCredits reclaim). Both are self-service (caller's own rows only) and
    same-origin CSRF-guarded (`x-ctf-csrf: 1`).
- Data model: `account_deletion_events` (id, user_id, scope, service_name, requested_at,
  completed_at, status, summary). The `GET /api/account/services` projection adds no tables — it
  reads only the in-code registry.
- The user-facing Account & Data surface is now built (PR `feat/account-data-privacy-deletion-ui`):
  - Web: `ctf/packages/web/app/account/data/page.tsx` (auth-gated, same posture as
    `requireAccountAccess`) renders `ctf/packages/web/components/account-data/account-data-shell.tsx`.
    One responsive component set switches desktop/mobile on `useIsMobile()` (768px), with loading,
    empty, populated, and confirm-delete states matching the survivor-hub mockups. Per-service delete
    uses a two-step confirm; full-account delete requires typing the exact phrase `delete my account`.
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
