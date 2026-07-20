# WhatWorks Plugin Feature Inventory

## 1. Scope and Boundary

- Plugin slug: `what-works`
- WhatWorks owns one shared, community-wide, survivor-verified list of tools organized by problem.
- Surfaces it owns:
  - Authenticated app shell at `/apps/what-works`.
  - Permanently-public preview at `/plugin/what-works`.
  - Admin moderation/curation at `/admin/what-works`.
  - All `/api/what-works/*` routes and the `what_works_*` tables.
  - Android/Expo feature at `packages/mobile/src/features/what-works`.
- Explicitly does **not** own:
  - The external "Look Ma" explainer at `https://www.chargingthefuture.com/look-ma` (a marketing
    landing page; WhatWorks only links out to it from the right-rail footnote).
  - Any per-survivor/published personal lists (single shared list only, by design — "for now").
  - Cross-plugin reads. WhatWorks curates its own problems; it does not read another plugin's data.

## 2. Intent and Outcome

WhatWorks answers one question for a survivor in crisis: *what actually helped someone like me?* A
member picks a problem they're facing (noise harassment, sleep disruption, vehicle tampering, …) and
sees a short list of specific products another survivor bought, used, and verified helped — each with
a direct purchase link, no ads, no affiliates, and no identity attached to the suggestion. Anyone can
read a teaser; signed-in survivors can suggest tools and mark items "this helped me"; admins curate
the problem categories and review every suggestion before it joins the shared list.

## 3. User Features

- Browse the shared list: active problems, each with its approved tools (emoji, name, type, a short
  "why it works" note, a verified count, and a direct purchase link).
- Mark a tool **Helpful** ("this helped me") — a one-per-survivor endorsement whose tally renders as
  "N survivors verified"; toggle off to withdraw it.
- Suggest a tool: choose an existing problem, add a product name, a direct purchase link, and an
  optional note. Suggestions are reviewed before they appear (anonymous to other members).
- Client-side search across tools and problems.
- Jump-nav sidebar that scrolls to a chosen problem.
- Public (signed-out) preview: a readable teaser slice plus a sign-in/sign-up gate to see the full
  list and to suggest.
- Web and Android parity.

## 4. Admin Features

- Review queue: approve or reject (with an admin-only reason) each suggested tool; delete tools.
- Edit a tool's own details (emoji, name, type, note, purchase link) at any status — including after
  it is approved — to fix a typo or a broken link without unpublishing it. Status, verified count,
  and submitter identity are left untouched.
- Status filter across pending / approved / rejected / all.
- Curate problems: create, rename, re-emoji, reorder, deactivate/reactivate, and delete (cascading
  to that problem's tools and endorsements).
- Submitter identity is never surfaced to admins — moderation is of content, not of people.
- Admin surface at `/admin/what-works`, reachable from an in-app "Admin" entry when the viewer is an
  admin.

## 5. API Surface and Route Map

- `GET /api/what-works` — Authenticated read of the shared list (problems + approved tools + per-viewer endorsement state + stats + `viewer.isAdmin`).
- `GET /api/what-works/public` — Public, identity-free teaser slice of the list + stats. The returned stats describe only the teaser slice (not the full list), so the public payload never advertises counts a signed-out visitor cannot see.
- `GET /api/what-works/problems` — Active problems for the suggest form (authenticated).
- `POST /api/what-works/products` — Suggest a tool (lands `pending`; suggester auto-recorded as first verifier).
- `POST /api/what-works/products/[id]/endorse` — Mark an approved tool helpful.
- `DELETE /api/what-works/products/[id]/endorse` — Withdraw the viewer's endorsement.
- `GET /api/what-works/admin/problems` — Admin: list problems with product counts.
- `POST /api/what-works/admin/problems` — Admin: create a problem.
- `PATCH /api/what-works/admin/problems/[id]` — Admin: edit/reorder/deactivate a problem.
- `DELETE /api/what-works/admin/problems/[id]` — Admin: delete a problem (cascade).
- `GET /api/what-works/admin/products` — Admin: moderation queue (optional `?status=`).
- `PATCH /api/what-works/admin/products/[id]` — Admin: with `action` (`approve`/`reject`), moderate the tool; without `action`, correct its own details (name, purchase link, note, emoji, type). The edit path never changes status, endorsements, or the identity columns.
- `DELETE /api/what-works/admin/products/[id]` — Admin: delete a tool (cascade).

All mutating routes require the `x-ctf-csrf: 1` confirmation header (same-origin enforced).

## 6. Data Model and Storage Contracts

- Table: `what_works_problems` — admin-curated categories.
  - `id UUID PRIMARY KEY`
  - `slug TEXT NOT NULL` (unique index `idx_what_works_problems_slug`)
  - `emoji TEXT NOT NULL DEFAULT ''`
  - `title TEXT NOT NULL`
  - `context TEXT NOT NULL DEFAULT ''`
  - `sort_order INTEGER NOT NULL DEFAULT 0`
  - `is_active BOOLEAN NOT NULL DEFAULT TRUE`
  - `created_by TEXT` (admin user id, nullable/anonymizable)
  - `created_at`, `updated_at TIMESTAMPTZ`
  - Index: `idx_what_works_problems_active_sort (is_active, sort_order)`
- Table: `what_works_products` — survivor-suggested tools.
  - `id UUID PRIMARY KEY`
  - `problem_id UUID NOT NULL REFERENCES what_works_problems(id) ON DELETE CASCADE`
  - `emoji TEXT NOT NULL DEFAULT ''`, `name TEXT NOT NULL`, `kind TEXT NOT NULL DEFAULT ''`,
    `note TEXT NOT NULL DEFAULT ''`, `purchase_url TEXT NOT NULL`
  - `status TEXT NOT NULL DEFAULT 'pending'` CHECK in (`pending`,`approved`,`rejected`)
  - `suggested_by TEXT` (never displayed), `reviewed_by TEXT`, `reviewed_at TIMESTAMPTZ`,
    `rejection_reason TEXT`
  - `created_at`, `updated_at TIMESTAMPTZ`
  - Indexes: `idx_what_works_products_problem (problem_id)`, `idx_what_works_products_status (status)`
- Table: `what_works_endorsements` — "this helped me" signal.
  - `id UUID PRIMARY KEY`
  - `product_id UUID NOT NULL REFERENCES what_works_products(id) ON DELETE CASCADE`
  - `user_id TEXT NOT NULL`
  - `created_at TIMESTAMPTZ`
  - Unique index `idx_what_works_endorsements_unique (product_id, user_id)`; index on `product_id`.

Derived metrics (no stored counters): a tool's verified count is `COUNT(*)` of its endorsements;
"Survivors helped" is the sum of verified counts across approved tools.

## 7. Security, Privacy, and Compliance Controls

- Reading the full list requires authentication (`evaluatePluginAccess`); the public teaser is the
  only unauthenticated surface and is identity-free.
- Suggesting and endorsing require an authenticated survivor; curating problems and moderating
  suggestions require an admin (`isAdmin`). Admin page redirects non-admins to `/apps/what-works`.
- CSRF: all mutations require `x-ctf-csrf: 1` and same-origin (`ensureMutationCsrf`).
- Anonymity: `suggested_by` is stored for moderation/abuse control only and is excluded from every
  reader and admin projection. No survivor identity is rendered anywhere in the plugin. The
  `getProductById` lookup selects an explicit column list that omits `suggested_by`/`reviewed_by`, so
  those identity fields are never present on the returned object (defence in depth).
- Audit: every command emits one structured audit line via `logWhatWorksAudit`
  (`lib/what-works/audit.ts`) on its success path — reads (`what-works.list.read`,
  `what-works.public.read`, `what-works.problems.list`, the two admin list reads), mutations
  (suggest/endorse/unendorse), and all admin curation/moderation commands — including
  `what-works.admin.product.update` (an admin editing a tool's details) — matching every event
  declared in the audit contract. The public read records `anonymous` as the actor.
- Input validation: lengths and `http(s)`-only purchase URLs are enforced server-side.
- Contracts: see
  [WHAT_WORKS_PLUGIN_COMMAND_CONTRACTS.yaml](../../contracts/WHAT_WORKS_PLUGIN_COMMAND_CONTRACTS.yaml),
  [WHAT_WORKS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/WHAT_WORKS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml),
  [WHAT_WORKS_PLUGIN_AUDIT_CONTRACTS.yaml](../../contracts/WHAT_WORKS_PLUGIN_AUDIT_CONTRACTS.yaml),
  [WHAT_WORKS_PROFILE_AND_DELETION_CONTRACT.md](../../contracts/WHAT_WORKS_PROFILE_AND_DELETION_CONTRACT.md).

## 8. Web and Android Delivery Status

- Web: complete. Pixel pass against design `12c6293` —
  `design/.../survivor-hub/WhatWorks.tsx` (populated), `WhatWorksPublic.tsx` (public),
  `WhatWorksEmpty.tsx` (suggest/empty), `WhatWorksLoading.tsx` (loading). Decomposed into modular
  sub-components under `packages/web/components/what-works/` within the rule-116 limits. All data is
  real (`/api/what-works*`); no stub arrays in the production shells.
- Android: **surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served
  by the installable web app (PWA). Historical detail: an Expo feature previously lived at
  `packages/mobile/src/features/what-works/` (list + Helpful toggle + suggest, against the
  `MobileWhatWorks*` references).
- Parity contract: [plugin-parity-contracts.json](../../../config/plugin-parity-contracts.json).

## 9. Seed Coverage Status

- Seed: [scripts/seedWhatWorks.mjs](../../../scripts/seedWhatWorks.mjs) (`pnpm --filter ... seed:what-works`).
- Deterministic, idempotent. Seeds the design's exact sample: 3 problems, 7 approved tools, and 27
  endorsements (so a fresh DB renders the mockup's headline numbers — 3 problems, 7 tools, 27
  survivors helped). Demo-schema coverage is added via `seedDemo.mjs`.

## 10. Gaps and Known Technical Debt

- The reviewed-suggestion flow means the design's "First tool added 🎉" / "Add to the list" copy is
  rendered as the review-honest "Suggestion submitted" / "Submit for review" instead. Flagged back to
  the design agent to fold into the mockup (see session continuity notes); not a code gap.
- The admin moderation surface has no Replit mockup; it is built to the established functional
  `/admin/{plugin}` convention (owner-approved approach, this task).
- Endorsement abuse control beyond one-per-user dedupe (e.g., rate limiting) relies on shared
  platform defaults.
- The profile-deletion scopes are specified in the deletion contract; wiring them into the central
  deletion orchestrator is a platform-level task tracked outside this plugin.

## Change Log

- 2026-07-17: **History-aware back + admin↔member navigation (app-wide sweep).** The member
  shell's hand-rolled back chevron was replaced by the shared `BackChevronButton` — it returns to
  the previous in-app page and falls back to All Apps when there is no in-app history. The admin
  surface header gained the shared "Member view" pill (`PluginUserShellButton`) linking to
  `/apps/what-works`. The member shell swapped its bespoke admin link for the shared Admin
  shortcut (`PluginAdminButton`, admins only). UI-only; no schema, route, or contract change.
- 2026-07-14: Added refresh controls (app-wide refresh rollout). Web: the shared `RefreshButton` now
  sits in the member shell's desktop header (after the search box) and the mobile-responsive header
  (before the shared top actions), wired to a `refreshAll` that re-runs `loadList()` and
  `loadProblemOptions()` without the full-screen loading state. Android: native pull-to-refresh via
  `RefreshControl` on the `WhatWorksList` `ScrollView`, wired to the existing `load()` (which only
  toggles the loading state on the initial mount). UI-only; no schema, route, or contract change.
- 2026-07-01: Admins can now edit a suggested tool's own details after the fact. Added a
  `what-works.admin.product.update` command (command/access/audit contracts), a repository
  `updateProduct` (COALESCE update of emoji/name/kind/note/purchase_url; status, endorsements, and
  identity columns untouched), and a field-edit branch on `PATCH /api/what-works/admin/products/[id]`
  taken when the body carries no `action` (same server-side length + `http(s)`-link validation as the
  suggest form). The admin moderation UI (`ww-admin-products`) gains an inline Edit form per tool,
  wired through `ww-admin-shell`. Closes the gap where an approved entry with a typo or broken link
  could only be deleted and re-created. Web-only admin surface (no Android admin for this plugin);
  the shell is mobile-responsive.
- 2026-06-27: Code-review batch (issues #1127–#1136). (1) `listAdminProblems` now selects an explicit
  column list instead of `SELECT pr.*`, so a future identity column added to `what_works_problems` is
  never auto-included in the admin response; output is unchanged (#1127). (2) The endorse/un-endorse
  route (`/api/what-works/products/[id]/endorse`) wraps its DB writes and endorsement-state read in a
  try/catch, reports the error, and returns a structured 500 instead of an unhandled rejection (#1132).
  (3) Admin moderation UI: the rejection reason is now an inline, themable textarea with a length
  hint (replacing the blocking `window.prompt`), and both product and problem deletes use an inline
  two-step confirm (replacing `window.confirm`) — same data and endpoints, no contract change (#1131,
  #1135). (4) Documentation-only clarifications: a teaser-scope note on the mobile `fetchPublicList`
  stats (#1134), a note that the mobile suggest form intentionally omits `kind`/`emoji` (server stores
  empty strings; admin can fill in during review) (#1133), and a scale/pagination note on
  `getReaderList` (#1136). Reviewed and not changed: #1129 — `updateProblem`'s `COALESCE` lets an
  explicit empty `context` clear that optional field while the required `title` cannot be blanked
  (uses `readTrimmedString`); this is the intended, consistent behavior for the always-send admin edit
  form, and an explicit null sentinel would be an unneeded API contract change.
- 2026-06-26: Hyphenation/cleanup rename (hard cutover, no back-compat alias). The plugin slug,
  folder names, every route, and the command/audit namespace moved from `whatworks` to the
  kebab-case `what-works` (so `/api/whatworks/*` no longer exists — `/api/what-works/*` is the only
  surface; web components and the mobile API client were all repointed). The database tables and
  indexes were renamed in the same pass to the matching snake_case prefix: `whatworks_problems` →
  `what_works_problems`, `whatworks_products` → `what_works_products`, `whatworks_endorsements` →
  `what_works_endorsements` (plus their `idx_whatworks_*` → `idx_what_works_*` indexes). `schema.sql`
  and `schema.demo.sql` run `ALTER TABLE/INDEX IF EXISTS ... RENAME TO ...` before the
  `CREATE ... IF NOT EXISTS` blocks, so an existing database keeps its rows and a fresh database
  builds the new names directly. Cross-plugin references were updated too: the Trust endorsement
  count query and signal type, the theme accent keys (web + mobile), the plugin registry, the
  concierge intent slug, the parity contract, and the four contract files
  (`WHATWORKS_*` → `WHAT_WORKS_*`). The slug and the table prefix now match (`what-works` ↔
  `what_works_`), so there is no irregular slug↔prefix mapping. PascalCase identifiers
  (`WhatWorksShell`, `WhatWorksProductStatus`, the `whatWorksError` helper, etc.) read as the proper
  noun "What Works" and were left unchanged.

- 2026-06-26: Code-review batch (issues #931–#938). (1) Audit: added `lib/what-works/audit.ts` and
  emit one structured audit line per command on its success path across all `/api/what-works/*` route
  handlers, closing the gap where no command was logged against the audit contract (#931). (2) Public
  read now scopes its returned `stats` to the teaser slice instead of the full list, so the signed-out
  payload no longer advertises hidden counts (#934). (3) Mobile gains a `WhatWorksPublic` signed-out
  teaser (fetched from `/api/what-works/public`) so a signed-out visitor sees the public preview rather
  than a 401, matching web (#935). (4) `getProductById` selects an explicit column list that omits the
  `suggested_by`/`reviewed_by` identity fields (#936). (5) `ensureUniqueSlug` is now bounded (max 100
  attempts, throws a clear error) instead of an unbounded `while (true)` (#937). Reviewed and not
  changed: #932 (partial-update already preserves an omitted `context`/`emoji` via the
  `undefined → null → COALESCE` path; sending an explicit empty string to clear is intended), #933
  (every reader projection and the stats query already filter to `status = 'approved'`, so a
  suggester's auto-endorsement on a later-rejected product is never counted), #938 (mobile already
  leaves product state untouched on a failed toggle, so it stays consistent).
- 2026-06-17: Restyled the `/admin/what-works` surface (`ww-admin-shell`, `ww-admin-products`, `ww-admin-problems`) to the shared dark admin design system (icon header with `ADMIN` badge, dark panel/surface tokens, status pills, tinted action buttons) per rule 131. Visual only — no change to data, endpoints, or moderation actions. The mockup's invented submitter handles, upvote counts, and per-entry flag have no backing fields, so they were not added; the real four-value status filter and verified counts are kept. Web typecheck + eslint clean.
- 2026-06-12: The Android What Works API client (`packages/mobile/src/features/what-works/api.ts`) now uses the shared authenticated fetch helper — every call carries the signed-in member's Clerk bearer token and the server address comes from runtime config (APP_URL) — replacing plain dev-only fetch against a hardcoded development URL with an empty token.
- 2026-05-31: Initial implementation. Schema (`what_works_problems`, `what_works_products`,
  `what_works_endorsements`), repository/policy/types, full `/api/what-works/*` surface (public + user +
  admin), pixel pass of the four designed web states, functional admin curation/moderation, Android
  Expo feature, registry + parity entries, contracts, and a deterministic seed matching the design
  sample. Design pinned at `12c6293`.

## Build Checklist

1. [x] Pin the design submodule at the WhatWorks commit (`12c6293`).
2. [x] Schema: `what_works_problems`, `what_works_products`, `what_works_endorsements` (+ indexes, ALTER guards).
3. [x] Plugin registry entries (schema seed + `repository.ts` fallback) and parity-contracts entry.
4. [x] Library: `types.ts`, `constants.ts`, `policy.ts`, `repository.ts`.
5. [x] API: public reader, authed reader, problems list, suggest, endorse/un-endorse.
6. [x] API: admin problems CRUD and product moderation.
7. [x] Contracts: command, access policy, audit, profile-and-deletion.
8. [x] Web UI: loading, public, suggest/empty, populated list — pixel pass + modular decomposition.
9. [x] Web route registration (`/apps/what-works`, `/plugin/what-works`, `/admin/what-works`).
10. [x] Android Expo feature (list, Helpful, suggest) + parity entry.
11. [x] Deterministic seed matching the design sample.
12. [x] Inventory (this document).
