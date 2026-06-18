# Directory Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target: `ctf/`
- Plugin slug: `directory`
- Directory is a deterministic profile-and-discovery plugin with unified user/admin UI surface and role-gated server controls.
- Legacy `platform/` is reference-only; not modified.

## Intent and Outcome

Directory in CTF provides authenticated users with a deterministic profile-and-discovery experience, unified admin workflows on the same UI surface, server-enforced policy controls (claimed/unclaimed guardrails, privacy filters, anti-scraping), and parity-safe delivery across web and Android.

**Scope boundary — Directory lists, it does not transact.** Directory exists only to list members and the skills they hold (drawn from the shared skills taxonomy) and to let people read a member's profile. Directory does **not** include messaging/chat or session booking. Those belong to the **Foundation** plugin. Any "Direct Chat", "Message", "Book Session", or appointment-availability affordance that appeared on the Directory surface came from the retired Replit design mockups, not from this spec, and has been removed (see Change Log, 2026-06-16). When a member wants to reach a provider or book time, that flow lives in Foundation.

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

### Skills backfill from the legacy array (one-shot, idempotent)

Per-profile skills are stored in the normalized `directory_profile_skills` junction (`profile_id` → `skill_id` → `skills_taxonomy_skills`); the profile view reads skills only from that join. The original platform instead stored skills as a free-text array column on the profile itself (`directory_profiles.skills TEXT[]`, up to three names). The v2→v3 clone carried the profile rows and that legacy array column forward, but nothing populated the junction, so every cloned profile showed zero skills. `post/0005_directory_backfill_skills_from_legacy_array.sql` copies each legacy skill name into the junction by matching it case-insensitively against `skills_taxonomy_skills`. It is guarded (no-ops on a fresh DB with no legacy `skills` column), idempotent (`ON CONFLICT (profile_id, skill_id) DO NOTHING`), and deterministic (`DISTINCT ON` picks one taxonomy skill per name when a name is ambiguous). Names with no taxonomy match are skipped.

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

Web pixel pass: the `DirectoryShell` is aligned to `design/.../survivor-hub/Directory.tsx` and its Loading/Empty states (`DirectoryLoading.tsx`, `DirectoryEmpty.tsx`). The app surface background was corrected to `#0F1117` (the mockup's rendered surface), the loading state now renders the skeleton layout, and the empty state matches the mockup's category-grid + "Browse All / Clear Filters" treatment (driven by real sector data). The shell was decomposed into modular sub-components (`directory-profile-detail`, `directory-browse`, `directory-right-panel`, `directory-loading-skeleton`, `directory-empty-state`, `shared`) so each unit stays within the rule-116 complexity/length limits. API wiring is unchanged.

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

- 2026-06-18: Backfilled per-profile skills that did not carry over from the legacy directory. Cloned profiles (e.g. "Jennifer") showed no skills because the original platform stored skills as a free-text array column (`directory_profiles.skills TEXT[]`) while v3 reads from the normalized `directory_profile_skills` junction, and no migration ever copied the array across (the junction was empty in production for every profile). Added `post/0005_directory_backfill_skills_from_legacy_array.sql`: a guarded, idempotent, deterministic migration that maps each legacy skill name to a `skills_taxonomy_skills` row (case-insensitive) and inserts the junction rows. Of the 132 legacy skill entries, 126 (~95%) matched the taxonomy; 6 free-text names had no match and are skipped (a name-mapping can be added later if wanted). No schema or route change — the legacy `skills` array column is left in place as the source of truth for re-runs and future clones.
- 2026-06-16: Removed the chat and session-booking affordances from the Directory surface — they are Foundation's job, not Directory's. Directory is only for listing members and the skills they hold (from the shared skills taxonomy) plus reading a profile. Web changes: dropped the "Message" icon button on each browse card (`directory-browse.tsx`, so each card now shows a single full-width "View Profile" action); dropped the "Book Session" and "Message" buttons, the "Availability"/by-appointment card, and the "Direct Chat" card from the profile detail (`directory-profile-detail.tsx`, which is now a single-column, phone-friendly layout — the admin-only "Attach to account" control is unchanged); dropped the "Direct chat" pill from the signed-out hero (`directory-public-shell.tsx`). No schema, route, or contract change — these were presentation-only elements with no backing API (the booking/messaging CTAs were already omitted on Android, per the 2026-05-31 entry). Context: the Replit design bot that produced the source mockups has been retired; its mockups had introduced chat/booking that were never in the v2 Directory spec, so the v3 surface is being brought back to a cleaner version of v2 (list skills + profiles only). Also removed the stale `directory-chat-tab` sub-component reference from the Web Delivery Status note (no such file exists). Also removed the static "Endorsements" card from the profile detail (`directory-profile-detail.tsx`) — it was the renamed "Reviews" mockup placeholder (see 2026-05-29 entry) with no backing API, the same class of mockup-introduced element as the chat/booking affordances above; Directory now shows only real, backed data (name, job title, sector, specializations/skills, bio, and the admin-only attach control).
- 2026-06-12: The Android Directory API client (`packages/mobile/src/features/directory/api.ts`) now uses the shared authenticated fetch helper — every call carries the signed-in member's Clerk bearer token and the server address comes from runtime config (APP_URL) — replacing plain dev-only fetch against hardcoded development URLs; the hand-passed token parameter was removed from all client functions and call sites. The mobile announcements screen (`AnnouncementList.tsx`) now reads real data from `GET /api/directory/announcements` (with loading, error, and empty states) instead of rendering hardcoded mock rows.
- 2026-06-12: Aligned the Android `DirectoryProfile` card to the real server shape. It previously typed its prop as a hand-written `Profile` (`{ id, name, title, description }`) and defaulted to a hard-coded "Alice" mock — a shape that matched no directory route, in violation of the real-data-only rule. It now takes the canonical `DirectoryListItem` (the `GET /api/directory/list` item shape) and renders the member's `firstName`/`lastName`, `headline` (falling back to `jobTitleName`), and `bio`, with the mock removed. `features/directory/types.ts` now re-exports `DirectoryListItem` instead of declaring a drift-prone duplicate. The caller passes an already-loaded list item (there is no fetch-one-by-id route on the server, by design). No schema, route, or web change.
- 2026-06-10: Brought the standalone Directory seed script back in line with the current `directory_profiles` shape. `seedDirectory.mjs` had kept writing the retired `display_name` column (renamed to `first_name`/`last_name` on 2026-06-02 by `post/0001`), so a fresh seed against the migrated schema would fail with `column "display_name" does not exist`. The two sample users now carry `firstName`/`lastName` ('Amina'/'Johnson', 'Luis'/'Rivera'), and both the UPDATE and INSERT write `first_name`/`last_name` (parameters renumbered). No schema or behaviour change — seed data only.
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
