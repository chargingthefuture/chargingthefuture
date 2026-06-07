# Directory Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target: `ctf/`
- Plugin slug: `directory`
- Directory is a deterministic profile-and-discovery plugin with unified user/admin UI surface and role-gated server controls.
- Legacy `platform/` is reference-only; not modified.

## Intent and Outcome

Directory in CTF provides authenticated users with a deterministic profile-and-discovery experience, unified admin workflows on the same UI surface, server-enforced policy controls (claimed/unclaimed guardrails, privacy filters, anti-scraping), and parity-safe delivery across web and Android.

## Target User Features

1. Authenticated dashboard/profile experience for create, update, and delete profile operations.
2. Directory list and profile discovery experience for authenticated users.
3. **Directory is no longer public-facing** (2026-05-18). The `isPublic` toggle was removed; every authenticated member sees every active, non-deleted profile. There is no anonymous projection route. Legacy public URLs are not redirected — backwards compatibility is intentionally not preserved.
5. Announcement consumption in user-visible contexts.
6. Deterministic validation limits for description, selectors, and URL fields.

## Target Admin Features

1. Admin controls exist in **two** coexisting places (owner decision, 2026-06-06): (a) the **inline, admin-only "Attach to account" control** on the Directory profile detail, and (b) a **dedicated Directory admin page** at `/admin/directory` (web) and a Directory Admin screen on Android. Both attach an unclaimed profile to a user account (assign); the dedicated page additionally lists every profile and supports edit and unclaimed-only delete.
2. Admin profile list, create, update, assign, and unclaimed-only delete flows.
3. Admin announcement list/create/update/deactivate flows.
4. Admin skills compatibility and selector governance operations.
5. Claimed/unclaimed guardrails enforced as hard server-side policy constraints.

> Design note (owner decision, 2026-06-06): Directory now has BOTH the inline admin control AND a dedicated admin page; they coexist. This reverses the earlier 2026-06-03 "inline-only, deliberately no standalone admin page" rule. The dedicated admin page lives at `/admin/directory` (web, gated by the same `evaluatePluginAccess` + `isAdmin` check the directory admin API uses) and as the "Directory Admin" screen in the Android app. The inline "Attach to account" control on the profile detail is unchanged.

## API Surface and Route Map

Implemented routes:

- User/authenticated:
  - `GET /api/directory/profile`
  - `POST /api/directory/profile`
  - `PUT /api/directory/profile`
  - `DELETE /api/directory/profile`
  - `GET /api/directory/list`
  - `GET /api/directory/skills`
  - `GET /api/directory/sectors`
  - `GET /api/directory/job-titles`
  - `GET /api/directory/announcements`
- Public: none. The `GET /api/directory/public` and `GET /api/directory/public/:id` routes
  (v2 anonymous projection) were removed 2026-05-25 — they leaked full profile data
  (including payment addresses) to unauthenticated callers, contradicting the
  no-public-facing decision above. `/apps/directory/[handle]` now redirects to the
  authenticated Directory shell.
- Admin:
  - `GET /api/directory/admin/profiles`
  - `POST /api/directory/admin/profiles`
  - `PUT /api/directory/admin/profiles/:id`
  - `PUT /api/directory/admin/profiles/:id/assign`
  - `DELETE /api/directory/admin/profiles/:id`
  - `GET /api/directory/admin/announcements`
  - `POST /api/directory/admin/announcements`
  - `PUT /api/directory/admin/announcements/:id`
  - `DELETE /api/directory/admin/announcements/:id`

Admin surfaces (rendered pages, not API routes):

- Web: `/admin/directory` (`app/admin/directory/page.tsx` → `DirectoryAdminShell`). Server-gated with `evaluatePluginAccess({ requireUsername: false })`; non-admins are redirected to `/apps/directory`. The shell binds to the admin profile routes above: `GET /api/directory/admin/profiles` (list), `PUT /api/directory/admin/profiles/:id` (edit), `PUT /api/directory/admin/profiles/:id/assign` (attach), `DELETE /api/directory/admin/profiles/:id` (unclaimed-only delete).
- Android: "Directory Admin" screen (`packages/mobile/src/features/directory/AdminDirectory.tsx`) binding to the same admin profile routes via `packages/mobile/src/features/directory/api.ts`.

## Data Model and Storage Contracts

1. `directory_profiles` — Directory profile records with claimed/unclaimed state.
2. `directory_announcements` — Directory announcements with activation/deactivation state.
3. Skills hierarchy (shared taxonomy) — Selector-backed taxonomy data.
4. Profile policy contracts — Claimed/unclaimed state and assignment constraints.
5. Public projection contracts — Privacy-filtered output shape for unauthenticated callers.

### Name fields on `directory_profiles`

A directory profile stores the person's name in two columns, `first_name TEXT` and `last_name TEXT`
(both nullable), and renders them as "First Last". `first_name` is required on input;
`last_name` is optional. This applies to both claimed and unclaimed profiles. There is no
`display_name` column on `directory_profiles` — it was removed in the v3 cleanup (see the Change Log
entry dated 2026-06-02 and the `post/0001_directory_display_name_to_first_last.sql` migration).

### New columns on `directory_profiles` (Skills Hunt + Clerk username co-change, 2026-05-11)

1. `source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'self', 'community-generated'))` — drives the "Community generated profile" badge in the UI.
2. `invited_by_username TEXT NULL` — denormalized from `skills_hunt_directory_profiles.invited_by_username` so the (auth-gated) profile page renders attribution without a join.
3. `unclaimed_handle TEXT NULL` — auto-generated vanity handle for unclaimed profiles. Format: `community-<6char-hex>` (no leading `@` in storage; `@` is presentation only). Cleared/ignored once `claimed_by_user_id` is set. Uniqueness is enforced by a case-insensitive partial unique index (`directory_profiles_unclaimed_handle_key` on `lower(unclaimed_handle)` WHERE `unclaimed_handle IS NOT NULL`), not an inline column constraint — so `Community-7F3A2B` and `community-7f3a2b` cannot coexist, and the migration block can drop/recreate the index without tripping over a constraint-backed index on the fresh-schema path.
4. `deleted_at TIMESTAMPTZ NULL` — soft-delete for GDPR and moderation removals; `is_active` remains in place but `deleted_at` takes precedence for visibility filters.

### Backfill (one-shot, idempotent)

For every `directory_profiles` row where `claimed_by_user_id IS NULL AND unclaimed_handle IS NULL`, assign `unclaimed_handle = 'community-' || encode(gen_random_bytes(3), 'hex')`. Retry on case-insensitive unique-index collision. Establishes consistent `@handle` URLs on day one.

## Security, Privacy, and Compliance Controls

1. Server-side authorization is enforced on every admin endpoint.
2. Admin controls are hidden in the frontend but authorization is always server-enforced (presentation-only hiding is not authorization).
3. Claimed/unclaimed mutation guardrails are enforced server-side.
4. Public projection returns privacy-minimized fields only.
5. Public endpoints enforce anti-scraping controls and rate-limited access.
6. CSRF protection is required on every write endpoint.
7. Audit logging is required for admin mutations (allow and deny outcomes).

## Web and Android Delivery Status

Parity status: **web+android complete**.

Web and Android implementations:
- User authentication and profile management flows reach parity.
- Admin role-gated controls reach parity (same policy outcomes and deny taxonomy across platforms).
- Unified UI contract governs both clients, with platform-specific presentation only.

Web pixel pass: the `DirectoryShell` is aligned to `design/.../survivor-hub/Directory.tsx` and its Loading/Empty states (`DirectoryLoading.tsx`, `DirectoryEmpty.tsx`). The app surface background was corrected to `#0F1117` (the mockup's rendered surface), the loading state now renders the skeleton layout, and the empty state matches the mockup's category-grid + "Browse All / Clear Filters" treatment (driven by real sector data). The shell was decomposed into modular sub-components (`directory-profile-detail`, `directory-browse`, `directory-chat-tab`, `directory-right-panel`, `directory-loading-skeleton`, `directory-empty-state`, `shared`) so each unit stays within the rule-116 complexity/length limits. API wiring is unchanged.

Admin page (2026-06-06): the dedicated Directory admin surface reaches web+android parity. Web `components/directory/directory-admin-shell.tsx` (desktop + mobile-responsive via `useIsMobile()`) at `/admin/directory`, and the Android "Directory Admin" screen `packages/mobile/src/features/directory/AdminDirectory.tsx`, both bind to the same admin profile routes (list/edit/assign/delete) and follow `DirectoryAdmin.tsx` / `MobileDirectoryAdmin.tsx`. Verify toggle and handle-assignment input are omitted on both platforms (no backing field/contract). The inline "Attach to account" control on the profile detail coexists unchanged.

Android pixel pass (2026-05-31): `DirectoryList.tsx` rebuilt from scratch to match `MobileDirectory.tsx` mockup — dark theme (`#0F1117`/`#090B0F`), `#3B82F6` accent, real sector filter chips (from `GET /api/directory/sectors`), profile browse list bound to `GET /api/directory/list`, and drill-down profile detail. `api.ts` created as the real backend client (`fetchDirectoryList`, `fetchDirectorySectors`). Fields with no backend counterpart are omitted with code comments (online status, verified checkmark, location, "Book Session"/"Message" CTAs, endorsements). Loading state renders the "EXIT THEIR ECONOMY / EXIT THE PSYOP" taglines per `MobileDirectoryLoading.tsx`. Empty state matches `MobileDirectoryEmpty.tsx`. Community-generated badge, unclaimed `@handle`, and Credits ✓ badge are driven by real API fields (`source`, `unclaimedHandle`, `serviceCreditsAddress`/payment fields). The `DirectoryList` export kept stable for `App.tsx`.

## Seed Coverage Status

Deterministic Directory seed script exists: `ctf/scripts/seedDirectory.mjs`.

Seeded content:
- Sample authenticated user profiles with claimed/unclaimed states.
- Sample admin profiles (unclaimed).
- Sample announcements.

## Gaps and Known Technical Debt

1. Admin skills compatibility strategy when shared skill deletions affect historical profile data is informally decided; consider explicit codification if additional plugin migrations depend on this constraint.
2. Route ownership policy for announcement APIs (explicit boundary enforcement) is implemented via plugin policy gate, not yet formalized in separate module documentation.

## Change Log

- 2026-06-06: Owner reversed the 2026-06-03 inline-only rule — Directory now has BOTH the inline "Attach to account" control AND a dedicated admin page; they coexist. Built the dedicated Directory admin surface. Web: new `app/admin/directory/page.tsx` (server-gated by `evaluatePluginAccess({ requireUsername: false })` + `access.isAdmin`; non-admins redirect to `/apps/directory`) rendering a new `components/directory/directory-admin-shell.tsx`. The shell lists every profile (`GET /api/directory/admin/profiles?pageSize=100&includeInactive=true`), filters by All/Claimed/Unclaimed, and supports edit (`PUT /api/directory/admin/profiles/:id`), attach an unclaimed profile to a Clerk user ID (`PUT /api/directory/admin/profiles/:id/assign`), and delete an unclaimed profile (`DELETE /api/directory/admin/profiles/:id`) — all mutations send `x-ctf-csrf: "1"`. Desktop (icon rail + sidebar + table + right-hand edit drawer) and mobile (`useIsMobile()`: card list + tabbed Unclaimed/All + full-screen edit) layouts follow `DirectoryAdmin.tsx` / `MobileDirectoryAdmin.tsx`. Per rule 126, the mockup "Mark as verified" toggle and "Assign Handle" input are omitted: `directory_profiles` has no `verified` column, and `unclaimed_handle` is system-assigned and not part of the `DirectoryProfileInput` admin-update contract (shown read-only). Android: replaced the placeholder mock `packages/mobile/src/features/directory/AdminDirectory.tsx` with a real screen bound to the same admin routes via new admin client functions in `api.ts` (`fetchAdminDirectoryProfiles`, `updateAdminDirectoryProfile`, `assignAdminDirectoryProfile`, `deleteAdminDirectoryProfile`); registered as the "Directory Admin" feature in `App.tsx`. The inline "Attach to account" control on the profile detail is unchanged.
- 2026-06-03: Added the inline, admin-only "Attach to account" control on the Directory profile detail. When the viewer is an admin and the open profile is unclaimed (`claimedByUserId == null`), the detail panel now shows an inline section with a Clerk-user-ID input, a "Use my account" shortcut that fills in the admin's own ID, and an "Attach" button wired to `PUT /api/directory/admin/profiles/:id/assign` (`assignAdminProfile`), sending the `x-ctf-csrf: "1"` header and `{ userId }` body. On success the member's `claimedByUserId` is updated in shell state and the section stops rendering; failures surface an inline error. `DirectoryShell` now receives `userId` and `isAdmin` from the plugin page, carries each profile's `id` and `claimedByUserId` in the `Member` view-model, and threads `isAdmin`/`currentUserId`/`onAttach` down to the detail. This closes the prior "no admin UI" gap deliberately as an inline, role-gated control on the Directory surface — not a standalone admin page (see the design note under Target Admin Features).
- 2026-06-03: Removed the "you must have your own profile to browse" gate from the member directory list (`listDirectoryForMember` no longer throws `directory_own_profile_required`), so every authenticated member sees every active profile — including the carried-over unclaimed profiles — without first creating their own. This aligns the code with the long-stated intent ("every authenticated member sees every active profile"); previously the list returned 404 for any viewer without a claimed profile, which surfaced as an empty "No providers found" page. Also fixed the directory empty state to only show the "Browse All Providers" / clear-filter action when a filter or search is actually active; a genuinely empty directory shows no button. (At the time, there was no admin UI to attach an unclaimed profile to a user account, although the backend existed (`PUT /api/directory/admin/profiles/:id/assign` → `assignAdminProfile`). That inline admin "attach to account" control was added the same day — see the separate 2026-06-03 entry above.)
- 2026-06-02: Replaced the single `display_name` name field with honest `first_name` + `last_name` columns across the Directory plugin (rendered as "First Last"). `first_name` is required, `last_name` is optional; both claimed and unclaimed profiles store their own name. Updated the schema, repository reads/writes and search filter, the profile API routes, the web shell view-model, and the mobile list. Added `post/0001_directory_display_name_to_first_last.sql`, a guarded, re-runnable migration that, on a v2 clone, carries any name that lived only in `display_name` into `first_name` and then drops the `display_name` column; on a fresh v3 database it is a no-op. The Skills Hunt profile-generation insert now writes the submitter's name into `first_name` (last name left unset). The Foundation provider search and connection lookup read `directory_profiles` directly; their queries now compose the provider's name as `first_name || ' ' || last_name` (aliased back to `display_name` internally) so Foundation keeps working after the column drop. Other plugins' own `display_name` fields are untouched.
- 2026-05-29: Design-sync reconcile to `c5d83c0`. Removed user-facing "GetStream" wording from the profile detail (dropped the badge; "GetStream Chat" → "Encrypted Chat") and right panel ("All interactions are end-to-end encrypted"); renamed the detail "Reviews" section to "Endorsements" per the revised mockup. Copy-only.
- 2026-05-29: Web UI circle-back. Aligned `DirectoryShell` to the `Directory.tsx` mockup and its Loading/Empty states; corrected the app surface background to `#0F1117`, added the skeleton loading state and the mockup's empty-state category grid (real sector data), and restored the `📇` heading glyphs. Decomposed the previously oversized shell into modular sub-components to satisfy rule-116 limits and removed the unused `userId`/`isAdmin` props (cleared a lint error). API wiring unchanged.
- 2026-05-31: Android pixel pass. Rebuilt `DirectoryList.tsx` to match `MobileDirectory.tsx` mockup; created `api.ts` bound to real web routes (`/api/directory/list`, `/api/directory/sectors`). Omitted fields: online status, verified checkmark, location, booking/messaging CTAs, endorsements (no backing API). Community badge, `@handle`, and Credits ✓ driven by real `source`/`unclaimedHandle`/payment fields. TSC clean, EOF clean, parity check passes.
- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language, Planned section headers, and planning-phase ambiguities list. Confirmed web+android complete delivery status. Clarified technical debt (skills compatibility, route ownership codification) as known limitations, not unimplemented features.
- 2026-03-02: Implemented backend and unified web surface (user/admin role-gated sections) with resolved list/pagination/claimed-delete decisions.
- 2026-02-25: Created initial unified Directory CTF rewrite inventory merging user and admin flows into one planned UI surface.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm legacy references remain intact.
  - Acceptance criteria:
    - `ctf/docs/developer/directory-feature-inventory.md` is unchanged.
    - `ctf/docs/developer/directory-admin-feature-inventory.md` is unchanged.
- [ ] Confirm unified rewrite surface decision is locked.
  - Acceptance criteria:
    - Directory rewrite uses one combined user/admin UI page/surface.
    - Admin controls are role-gated on that same surface.
- [ ] Confirm v1 parity decisions are locked.
  - Acceptance criteria:
    - Android admin parity is required in v1.
    - Post-create public URL behavior remains display-only parity for v1.

### Decision Lock and Ambiguity Resolution

- [x] Resolve all user-facing open decisions from inventory section A.
  - Acceptance criteria:
    - Each A-item in `ctf-directory-feature-inventory.md` has an explicit decision, owner, and date.
- [x] Resolve all admin open decisions from inventory section B.
  - Acceptance criteria:
    - Each B-item in `ctf-directory-feature-inventory.md` has an explicit decision, owner, and date.
- [ ] Resolve migration-risk handling plan from inventory section C.
  - Acceptance criteria:
    - Each C-item has a mitigation strategy and verification gate.
- [x] Lock route ownership for announcements and admin APIs.
  - Acceptance criteria:
    - Directory announcement and admin routes have explicit module ownership.
    - No unresolved route ownership ambiguity remains.

### Unified UI and Policy Boundary

- [x] Implement one unified Directory UI surface for user + admin workflows.
  - Acceptance criteria:
    - Shared page/surface supports user flows and role-gated admin controls.
- [x] Ensure frontend admin hiding is UX-only.
  - Acceptance criteria:
    - Security posture does not rely on client visibility checks.
    - Server policy checks remain authoritative.
- [ ] Preserve post-create public URL display-only behavior.
  - Acceptance criteria:
    - No mandatory copy/open action control is introduced in v1 parity scope.

### API and Backend Policy Gates

- [x] Enforce server-side authz on every admin endpoint.
  - Acceptance criteria:
    - Unauthorized admin API attempts return deny outcomes.
    - Deny outcomes are covered by manual validation walkthroughs.
- [x] Enforce CSRF protection on every admin write endpoint.
  - Acceptance criteria:
    - Missing/invalid CSRF tokens are rejected for admin writes.
    - CSRF failure paths are covered by manual validation walkthroughs.
- [x] Enforce claimed/unclaimed guardrails.
  - Acceptance criteria:
    - Unclaimed-only delete behavior is preserved.
    - Assignment transition constraints are validated server-side.
    - Guardrail violation paths are covered by manual validation walkthroughs.
- [ ] Enforce route ownership constraints.
  - Acceptance criteria:
    - Route-to-module ownership map is documented and validated in validation/lint gates.

### Privacy and Anti-Scraping Controls

- [x] Validate public projection privacy contract.
  - Acceptance criteria:
    - Public list/detail responses expose only approved privacy-minimized fields.
    - Non-public profiles remain inaccessible via public detail routes.
- [ ] Anti-scraping controls design. [TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Rate limit thresholds are documented.
    - Public ordering/privacy controls remain deterministic and policy-compliant.

### Data, Schema, and Seed Consistency

- [ ] Confirm schema consistency for profile, announcement, and audit contracts.
  - Acceptance criteria:
    - Schema and migration artifacts are consistent with planned contracts.
- [ ] Confirm deterministic seed consistency.
  - Acceptance criteria:
    - Claimed/unclaimed, announcement, and skills fixtures are deterministic.
    - Seed outputs are stable across CI and local runs.
- [ ] Validate schema/seed compatibility gates.
  - Acceptance criteria:
    - Automated checks fail on schema drift or incompatible seed assumptions.

### Web and Android Delivery Parity (Required)

- [ ] Ship web user + admin parity for in-scope Directory flows.
  - Acceptance criteria:
    - Unified UI behavior and policy outcomes match inventory requirements.
- [ ] Ship Android user + admin parity for in-scope Directory flows.
  - Acceptance criteria:
    - Android admin parity is complete in v1 and not deferred.
    - Android and web share equivalent server deny/allow outcomes.
- [ ] Parity coverage tracking. [AUTOMATED PARITY COVERAGE TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Cross-client parity validation scope is documented for post-MVP testing.

### Release Gates and Lifecycle Maintenance [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Admin API authz design alignment.
  - Acceptance criteria:
    - All admin endpoints document expected authz constraints.
- [ ] CSRF protection documentation.
  - Acceptance criteria:
    - Each admin write route documents CSRF token handling.
- [ ] Guardrail and constraint documentation.
  - Acceptance criteria:
    - Assignment and unclaimed-delete constraints are documented.
- [ ] Public projection privacy and anti-scraping documentation.
  - Acceptance criteria:
    - Public response field exposure and anti-scraping constraints are documented.
- [ ] Schema and seed consistency gates.
  - Acceptance criteria:
    - CI gates fail when schema/seed or route ownership contracts drift.

### Docs Lifecycle

- [ ] Keep inventory/checklist lifecycle synchronized with implementation changes.
  - Acceptance criteria:
    - `ctf-directory-feature-inventory.md` and this checklist are updated in the same PR as behavior or contract changes.
- [ ] Implementation evidence tracking. [EVIDENCE CAPTURE DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked in docs; evidence collection deferred to post-MVP.

### Change Log

- 2026-02-25: Created initial Directory rewrite checklist with unified UI scope, backend policy gates, open-decision resolution requirements, security/privacy validation gates, schema/seed consistency checks, and required Android admin parity in v1.
- 2026-03-02: Prompt 02 phase-0 backend/UI implementation completed for key decision-lock and API/policy checklist items (remaining parity/release gates tracked separately).
