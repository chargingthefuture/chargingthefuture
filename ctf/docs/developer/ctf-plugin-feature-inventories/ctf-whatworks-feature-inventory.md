# WhatWorks Plugin Feature Inventory

## 1. Scope and Boundary

- Plugin slug: `whatworks`
- WhatWorks owns one shared, community-wide, survivor-verified list of tools organized by problem.
- Surfaces it owns:
  - Authenticated app shell at `/apps/whatworks`.
  - Permanently-public preview at `/plugin/whatworks`.
  - Admin moderation/curation at `/admin/whatworks`.
  - All `/api/whatworks/*` routes and the `whatworks_*` tables.
  - Android/Expo feature at `packages/mobile/src/features/whatworks`.
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

## 3. Target User Features

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

## 4. Target Admin Features

- Review queue: approve or reject (with an admin-only reason) each suggested tool; delete tools.
- Status filter across pending / approved / rejected / all.
- Curate problems: create, rename, re-emoji, reorder, deactivate/reactivate, and delete (cascading
  to that problem's tools and endorsements).
- Submitter identity is never surfaced to admins — moderation is of content, not of people.
- Admin surface at `/admin/whatworks`, reachable from an in-app "Admin" entry when the viewer is an
  admin.

## 5. API Surface and Route Map

- `GET /api/whatworks` — Authenticated read of the shared list (problems + approved tools + per-viewer endorsement state + stats + `viewer.isAdmin`).
- `GET /api/whatworks/public` — Public, identity-free teaser slice of the list + stats.
- `GET /api/whatworks/problems` — Active problems for the suggest form (authenticated).
- `POST /api/whatworks/products` — Suggest a tool (lands `pending`; suggester auto-recorded as first verifier).
- `POST /api/whatworks/products/[id]/endorse` — Mark an approved tool helpful.
- `DELETE /api/whatworks/products/[id]/endorse` — Withdraw the viewer's endorsement.
- `GET /api/whatworks/admin/problems` — Admin: list problems with product counts.
- `POST /api/whatworks/admin/problems` — Admin: create a problem.
- `PATCH /api/whatworks/admin/problems/[id]` — Admin: edit/reorder/deactivate a problem.
- `DELETE /api/whatworks/admin/problems/[id]` — Admin: delete a problem (cascade).
- `GET /api/whatworks/admin/products` — Admin: moderation queue (optional `?status=`).
- `PATCH /api/whatworks/admin/products/[id]` — Admin: approve/reject a tool.
- `DELETE /api/whatworks/admin/products/[id]` — Admin: delete a tool (cascade).

All mutating routes require the `x-ctf-csrf: 1` confirmation header (same-origin enforced).

## 6. Data Model and Storage Contracts

- Table: `whatworks_problems` — admin-curated categories.
  - `id UUID PRIMARY KEY`
  - `slug TEXT NOT NULL` (unique index `idx_whatworks_problems_slug`)
  - `emoji TEXT NOT NULL DEFAULT ''`
  - `title TEXT NOT NULL`
  - `context TEXT NOT NULL DEFAULT ''`
  - `sort_order INTEGER NOT NULL DEFAULT 0`
  - `is_active BOOLEAN NOT NULL DEFAULT TRUE`
  - `created_by TEXT` (admin user id, nullable/anonymizable)
  - `created_at`, `updated_at TIMESTAMPTZ`
  - Index: `idx_whatworks_problems_active_sort (is_active, sort_order)`
- Table: `whatworks_products` — survivor-suggested tools.
  - `id UUID PRIMARY KEY`
  - `problem_id UUID NOT NULL REFERENCES whatworks_problems(id) ON DELETE CASCADE`
  - `emoji TEXT NOT NULL DEFAULT ''`, `name TEXT NOT NULL`, `kind TEXT NOT NULL DEFAULT ''`,
    `note TEXT NOT NULL DEFAULT ''`, `purchase_url TEXT NOT NULL`
  - `status TEXT NOT NULL DEFAULT 'pending'` CHECK in (`pending`,`approved`,`rejected`)
  - `suggested_by TEXT` (never displayed), `reviewed_by TEXT`, `reviewed_at TIMESTAMPTZ`,
    `rejection_reason TEXT`
  - `created_at`, `updated_at TIMESTAMPTZ`
  - Indexes: `idx_whatworks_products_problem (problem_id)`, `idx_whatworks_products_status (status)`
- Table: `whatworks_endorsements` — "this helped me" signal.
  - `id UUID PRIMARY KEY`
  - `product_id UUID NOT NULL REFERENCES whatworks_products(id) ON DELETE CASCADE`
  - `user_id TEXT NOT NULL`
  - `created_at TIMESTAMPTZ`
  - Unique index `idx_whatworks_endorsements_unique (product_id, user_id)`; index on `product_id`.

Derived metrics (no stored counters): a tool's verified count is `COUNT(*)` of its endorsements;
"Survivors helped" is the sum of verified counts across approved tools.

## 7. Security, Privacy, and Compliance Controls

- Reading the full list requires authentication (`evaluatePluginAccess`); the public teaser is the
  only unauthenticated surface and is identity-free.
- Suggesting and endorsing require an authenticated survivor; curating problems and moderating
  suggestions require an admin (`isAdmin`). Admin page redirects non-admins to `/apps/whatworks`.
- CSRF: all mutations require `x-ctf-csrf: 1` and same-origin (`ensureMutationCsrf`).
- Anonymity: `suggested_by` is stored for moderation/abuse control only and is excluded from every
  reader and admin projection. No survivor identity is rendered anywhere in the plugin.
- Input validation: lengths and `http(s)`-only purchase URLs are enforced server-side.
- Contracts: see
  [WHATWORKS_PLUGIN_COMMAND_CONTRACTS.yaml](../../contracts/WHATWORKS_PLUGIN_COMMAND_CONTRACTS.yaml),
  [WHATWORKS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/WHATWORKS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml),
  [WHATWORKS_PLUGIN_AUDIT_CONTRACTS.yaml](../../contracts/WHATWORKS_PLUGIN_AUDIT_CONTRACTS.yaml),
  [WHATWORKS_PROFILE_AND_DELETION_CONTRACT.md](../../contracts/WHATWORKS_PROFILE_AND_DELETION_CONTRACT.md).

## 8. Web and Android Delivery Status

- Web: complete. Pixel pass against design `12c6293` —
  `design/.../survivor-hub/WhatWorks.tsx` (populated), `WhatWorksPublic.tsx` (public),
  `WhatWorksEmpty.tsx` (suggest/empty), `WhatWorksLoading.tsx` (loading). Decomposed into modular
  sub-components under `packages/web/components/whatworks/` within the rule-116 limits. All data is
  real (`/api/whatworks*`); no stub arrays in the production shells.
- Android: complete. Expo feature at `packages/mobile/src/features/whatworks/` (list + Helpful
  toggle + suggest, against the `MobileWhatWorks*` references), registered in
  `config/plugin-parity-contracts.json`. Pending on-device QA (no device runtime in the build env).
- Parity contract: [plugin-parity-contracts.json](../../../config/plugin-parity-contracts.json).

## 9. Seed Coverage Status

- Seed: [scripts/seedWhatworks.mjs](../../../scripts/seedWhatworks.mjs) (`pnpm --filter ... seed:whatworks`).
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

- 2026-06-17: Restyled the `/admin/whatworks` surface (`ww-admin-shell`, `ww-admin-products`, `ww-admin-problems`) to the shared dark admin design system (icon header with `ADMIN` badge, dark panel/surface tokens, status pills, tinted action buttons) per rule 131. Visual only — no change to data, endpoints, or moderation actions. The mockup's invented submitter handles, upvote counts, and per-entry flag have no backing fields, so they were not added; the real four-value status filter and verified counts are kept. Web typecheck + eslint clean.
- 2026-06-12: The Android What Works API client (`packages/mobile/src/features/whatworks/api.ts`) now uses the shared authenticated fetch helper — every call carries the signed-in member's Clerk bearer token and the server address comes from runtime config (APP_URL) — replacing plain dev-only fetch against a hardcoded development URL with an empty token.
- 2026-05-31: Initial implementation. Schema (`whatworks_problems`, `whatworks_products`,
  `whatworks_endorsements`), repository/policy/types, full `/api/whatworks/*` surface (public + user +
  admin), pixel pass of the four designed web states, functional admin curation/moderation, Android
  Expo feature, registry + parity entries, contracts, and a deterministic seed matching the design
  sample. Design pinned at `12c6293`.

## Build Checklist

1. [x] Pin the design submodule at the WhatWorks commit (`12c6293`).
2. [x] Schema: `whatworks_problems`, `whatworks_products`, `whatworks_endorsements` (+ indexes, ALTER guards).
3. [x] Plugin registry entries (schema seed + `repository.ts` fallback) and parity-contracts entry.
4. [x] Library: `types.ts`, `constants.ts`, `policy.ts`, `repository.ts`.
5. [x] API: public reader, authed reader, problems list, suggest, endorse/un-endorse.
6. [x] API: admin problems CRUD and product moderation.
7. [x] Contracts: command, access policy, audit, profile-and-deletion.
8. [x] Web UI: loading, public, suggest/empty, populated list — pixel pass + modular decomposition.
9. [x] Web route registration (`/apps/whatworks`, `/plugin/whatworks`, `/admin/whatworks`).
10. [x] Android Expo feature (list, Helpful, suggest) + parity entry.
11. [x] Deterministic seed matching the design sample.
12. [x] Inventory (this document).
