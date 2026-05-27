# Public Surface + Demo Mode: Session Continuity
**Session ID:** claude/production-readiness-plan-op4lA  
**Issue:** #102 — Gate non-authenticated / public screens behind flags + demo-safe data  
**Date:** 2026-05-25  

## Summary
Issue #102 raises two concerns. The owner clarified (2026-05-25) how each is handled:

1. **Visibility gating is an AUTH-GATE concern, not a feature flag.** Which content shows to
   unauthenticated users is decided per-plugin in the auth layer, not by a global toggle:
   - **Directory** — no public view in v3 (the v2 public projection routes were dead code that
     leaked full profile data incl. payment addresses; removed). Auth required.
   - **SocketRelay** — legitimately public *with field redaction*: `mapPublicRequestRow()`
     exposes only title/category/city/status; owner id, details, contact are redacted. This IS
     the auth-gate pattern; no flag.
   - **Chyme, Hub** — fully authenticated; no public routes at all.
   - **Landing `/`, `/sign-in`, `/sign-up`, `/plugin/unlock`** — permanently public by design;
     the sign-in CTA already lives on these pages (per the v3 design).
   The `public-surface` flag is therefore demoted to a *reserved* global kill-switch (incident /
   pre-launch lockdown), not the mechanism for per-plugin visibility. Not currently wired.
2. **Demo-safe data mode** — when `demo-mode` is ON, data surfaces render only synthetic
   demo-tenant data, never real production data. This is the live deliverable for #102.

## Owner-Locked Decisions (2026-05-25)

**Decision 1: Demo-mode data strategy → SYNTHETIC DATA via seed scripts + demo-tenant pattern.**
- Chosen over a Neon branch to avoid a separate staging *deployment*. The app DB is shared: a set of
  seeded records with known/deterministic IDs (a "demo tenant") live in the production DB, and when
  `isDemoMode()` is ON, reads are scoped to the demo tenant. No extra DB compute; seed scripts already
  exist per plugin and are maintained against schema migrations.
- There is one production deployment (Render) and one production Clerk instance (Clerk is
  domain-bound, so a single domain ⇒ a single instance).
- **Impact:** A demo-tenant scoping layer in the data/identity path; per-plugin reads honor it.

**Decision 1b: Demo-mode routes Stream + Formance to non-production instances (2026-05-26).**
- The shared app DB is fine for demo, but two third-party integrations must NOT use their production
  resources during a recording session:
  - **GetStream** — Maker-tier quota is a hard ceiling (rule 110). Demo uses a separate Stream app via
    `STREAM_API_KEY_STAGING` / `STREAM_API_SECRET_STAGING` (per-app quota).
  - **Formance** — real financial data. Demo writes to a separate ledger book
    (`FORMANCE_LEDGER_STAGING` = `ctf-demo`) on the same Formance instance, isolated from the
    production ledger (`FORMANCE_LEDGER` = `ctf-main`). This lets demos exercise *real* credit-exchange
    transactions without touching production balances ("B1": one instance, two ledger books; API URL,
    token, and asset shared).
- Mechanism: `resolveStreamCredentials()` and the Formance config reader honor `isDemoMode()`. If a
  `*_STAGING` value is missing they report "not configured" rather than falling back to production, so
  a demo can never touch the production quota or the real ledger.
- Both credential sets live in the single Infisical `production` environment (one source of truth).

**Decision 2: Public visibility → auth-gate, per-plugin (RESOLVED, see Summary).**
- No `public-surface` flag gating of individual routes. Directory public routes removed;
  socketrelay keeps redaction-based public access; chyme/hub stay authenticated.
- `/apps/directory/[handle]` (and legacy directory deep-links) **redirect to `/apps/directory`**
  (sign-in CTA is on the shell). Pure redirect; no design pass needed.

**Decision 3: Parity scope** — ❓ still open: does demo mode extend to mobile (Expo), or web-only?
  Mobile is normally authenticated; confirm whether a recording session ever uses the mobile app.

## Audit Findings (2026-05-25, verified)

- Feature-flag infrastructure (#103) implemented and committed: OpenFeature + Unleash provider,
  shared flag-key registry, server flag client.
- Auth enforcement is **per-route** via `evaluatePluginAccess()` (not in middleware).
- **Directory public routes were dead v2 code** — no v3 caller; the `[handle]` page had zero
  incoming links and rendered full profiles (incl. Venmo/Bitcoin/Monero/Service-Credit addresses)
  to anyone. Removed: `/api/directory/public`, `/api/directory/public/[id]`,
  `listPublicDirectory`, `getPublicDirectoryById`, `getPublicDirectoryByHandle`,
  `resolveClaimedUsernameForProfile`; `[handle]` page replaced with a redirect.
- **SocketRelay public** (`/api/socketrelay/public`, `/api/socketrelay/public/[id]`) is a real
  feature using `mapPublicRequestRow()` redaction. Left public; no flag.
- **Chyme / Hub** — fully authenticated, no public surface.
- Demo-mode now routes **Stream** (`resolveStreamCredentials()`) and **Formance** (ledger-book
  switch to `FORMANCE_LEDGER_STAGING`) to non-prod instances (landed 2026-05-26). The demo-tenant
  **DB** scoping layer remains the next build step.

## Roadmap: Foundation Now, UI After Design

### Foundation (Landed 2026-05-25)
- [x] **Server flag helpers** — `ctf/packages/web/lib/feature-flags/system.ts`:
  - `isPublicSurfaceEnabled()` — evaluates `SYSTEM_FLAGS.PUBLIC_SURFACE`, default `true` (preserves current prod behavior + local/CI when Unleash unconfigured).
  - `isDemoMode()` — evaluates `SYSTEM_FLAGS.DEMO_MODE`, default `false` (real data unless an operator explicitly enables demo mode).
  - `publicSurfaceGate()` — returns a 403 `NextResponse` when the flag is OFF, else null. Server-only; no rendered surface, so not design-pass gated.
- [x] **Gated public API routes** behind `publicSurfaceGate()` (server-only, no rendered surface):
  - `GET /api/directory/public`
  - `GET /api/directory/public/[id]`
  - `GET /api/socketrelay/public`
  - `GET /api/socketrelay/public/[id]`
- [x] **Flag keys confirmed** in `ctf/packages/shared/src/feature-flags/keys.ts`: `SYSTEM_FLAGS.PUBLIC_SURFACE`, `SYSTEM_FLAGS.DEMO_MODE`.

### Foundation (Remaining — Blocked on Owner Decisions)
- [ ] **Lock owner decisions** (Decision 1, 2, 3 above).
- [ ] **Decide on per-route flags** if Decision 2 chooses per-route gating (currently a single binary `public-surface` flag gates all public APIs).
- [ ] **Plan database/data routing**: If Neon branch chosen (Decision 1), document:
  - Neon project ID, branch-creation script, demo-data seed steps.
  - How `DEMO_MODE` flag triggers branch-switch in server initialization.
  - Cost modeling: will demo branch be persistent or ephemeral?
- [ ] **Plan middleware changes**: If Decision 2 chooses middleware-wide gating, design:
  - Where to add flag check in `ctf/packages/web/middleware.ts`.
  - Fallback behavior when flag is OFF (403 vs redirect to `/sign-in`).
- [ ] **API contracts**: Create or update `ctf/docs/contracts/PUBLIC_SURFACE_API_CONTRACTS.yaml` with:
  - Public API routes (directory, unlock endpoints).
  - Which routes are gated by `public-surface` flag.
  - Expected behavior when flag is OFF.
- [ ] **Inventory file**: Create `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-public-surface-feature-inventory.md` or update existing plugin inventories to reflect flag-gating.

### UI Implementation (Blocked Until Design Pass)
- [ ] **Design pass** for public screens: `/`, `/sign-in`, `/sign-up`, `/plugin/unlock`, `/apps/directory/[handle]`.
  - Must cover all four states (Unauthenticated, Auth+Loading, Auth+Empty, Auth+Populated) per rule 126.
  - Design should show how demo mode changes data presentation (e.g., synthetic profile names instead of real names).
- [ ] **Middleware flag check** (if not done in foundation).
- [ ] **Public screen re-renders** to show demo data when flag is ON.
- [ ] **Neon branch setup** (if chosen) — infrastructure work, may be separate from code PR.
- [ ] **Mobile parity** (if Decision 3 includes mobile): Expo feature + flag checks.

## Demo-Tenant DB Scoping Layer — Design (2026-05-26)

The next non-UI build item for #102. Owner requirements (2026-05-26):
- Demo data lives in the **production DB** but must be **isolated** ("demo tables in the prod db, not
  mixed with prod"), seeded by per-plugin scripts like the existing seeds — including the demo Formance
  ledger (`ctf-demo`).
- Demo must show **real interactions**, so seeded **user accounts** must exist and own realistic data.
- **Every scenario per plugin** across all 17 (→18) apps — e.g. TrustTransport must seed ride + food +
  package deliveries covering all payment methods. This replaces the manual multi-account testing the
  owner did in v2 staging.
- Roles are only **admin** and **user**.
- During recordings the owner must **log in (real Clerk identity) and interact as a user**, not just
  admin, without polluting prod. (v2 used two Clerk environments + multiple personal emails; the seed
  scripts remove that manual work, but login-as-demo-user must still work.)

### Recommended architecture: a separate `demo` Postgres schema (selected by `isDemoMode()`)

The prod Neon DB gets a second schema `demo` with the **same table DDL** as `public` — the cleanest
realization of "demo tables in the prod db, not mixed":

- **Isolation by schema, not per-row filtering.** No `WHERE is_demo` to forget (a forgotten filter would
  leak real PII/financial data into a demo, or vice versa). Demo writes can never touch prod rows.
- **Repositories unchanged.** They use unqualified table names; the connection `search_path` resolves to
  `demo` or `public`. The only code change is the DB layer.
- **`postgres.ts` becomes demo-aware**: two pools (each pinned via the `-c search_path=` connection
  option), selected by `isDemoMode()` per request (async/cached — evaluate once per request).
- **Migrations** apply to both schemas: `CREATE SCHEMA IF NOT EXISTS demo;` then run `schema.sql` with
  `search_path=demo` as well as `public`. The migration runner gains a "both schemas" mode; the schema-
  drift gate covers `demo`.
- **Seeds** run against `demo`; the existing per-plugin seed scripts are the basis, expanded to the full
  **scenario matrix** (every flow/role/payment-method per plugin).
- **Formance**: demo seeds post realistic transactions to the `ctf-demo` ledger so the credit economy
  looks real in demos.
- **Identity / login-as-demo-user (MODULAR)**: demo participation is an **owner-curated allowlist of
  real Clerk user IDs**, not a single hardcoded owner. Mechanism reuses the existing flag infra (#103):
  `demo-mode` is evaluated **per-user** via Unleash user-id targeting (`evaluateBooleanFlag` already
  accepts `{ targetingKey }`). A user is a "demo participant" iff `demo-mode` is targeted ON for their
  Clerk id. Adding/removing a tester = a flag-targeting change in Unleash — no deploy, no schema edit.
  Because demo-vs-prod resolves **per request by the requesting user**, multiple participants can be in
  demo mode simultaneously while real production users are unaffected — this is what enables a live
  two-sided demo (owner as TrustTransport driver in one window; an opted-in tester as the requester in
  an incognito window, in real time).

### Modular demo participants — how the per-request routing works
- **[Landed 2026-05-26]** `isDemoMode()` resolves the caller's id via `resolveRequestIdentity()` — the
  per-request identity choke point already used by `evaluatePluginAccess()` — and evaluates `demo-mode`
  with that id as the Unleash targeting key. Existing callers (`stream-credentials.ts`,
  `formance-ledger.ts`) keep calling `isDemoMode()` with no args and are now per-user. Outside a request
  scope (seed scripts, migrations, startup) `resolveRequestIdentity()` throws on `headers()`/`cookies()`;
  it's caught and the flag falls back to its global default (OFF) — fail-safe to today's behavior.
- **[Next — must be runtime-tested before any participant relies on it]** the demo-aware DB pool in
  `postgres.ts` will call `isDemoMode()` to pick the `demo` vs `public` pool. **Fail-closed**: if demo is
  active but the `demo` schema/pool isn't available, the query errors rather than silently hitting
  `public` — demo can never leak into prod, and vice versa. This is the highest-risk isolation code, so it
  must be validated against a running app + DB (the owner becomes a demo participant and confirms writes
  land only in `demo`/`ctf-demo`) before enabling additional participants.
- **Demo participant profiles**: the demo seed creates accounts for the configured participant Clerk
  IDs (owner + opted-in testers) so they can act immediately; the app also auto-provisions a demo
  profile on a participant's first demo login, so newly-added testers "just work" without a reseed.

### Locked decisions (2026-05-26, owner)
1. **`demo` Postgres schema** approach — confirmed (over the riskier per-row `is_demo` filter).
2. **Identity** — seed the owner's real Clerk id into `demo`, and make participation a **modular
   allowlist** of real Clerk ids via per-user `demo-mode` targeting (see above), for live multi-user demos.
3. **Mobile parity** — ❓ still open: web-only first, or include the Expo app? (Recommend web-first; add
   mobile once the web layer is proven.)
4. **Scenario-matrix ownership** — proposal stands: a per-plugin `demo-scenarios` checklist in each
   inventory, owner-curated, that the seed implements (e.g. TrustTransport ride/food/package × payment
   methods).

### Implementation order

1. ~~Per-user `isDemoMode()`~~ — **landed 2026-05-26.** `isDemoMode()` resolves the caller via a new
   lightweight `getRequestUserId()` (headers/cookies only — no token verify, no DB, hot-path safe) and
   evaluates `demo-mode` with that id as the Unleash targeting key. The modular participant allowlist for
   the existing Stream/Formance routing; fail-safe to current behavior outside a request scope.
2. ~~Demo-aware, fail-closed DB pool~~ — **landed 2026-05-26.** `postgres.ts` now keeps two pools:
   `public` (default, unchanged) and `demo` (`options: '-c search_path=demo,public'`). `getActivePool()`
   picks the demo pool only when `isDemoMode()` is true for the request's user; the flag layer is imported
   **lazily** so seed scripts/migrations don't pull Next-only deps. Fail-closed + dormant: with no
   participants it is byte-identical to before; a demo request with no `demo` schema errors rather than
   leaking. **Not yet runtime-tested** (no DB/app in the agent env) — validate on the Render deploy.
3. ~~**Demo schema provisioning**~~ — **landed 2026-05-27.** `ctf/scripts/migrateToDemo.mjs`
   (`pnpm migrate:demo-schema`) validated against the 62-user v2 Neon branch. All schema.sql hazards
   handled by transforms in the script:
   - **`public.users` block suppressed** — lines 145-147 (ALTER TABLE public.users) + DO block for
     the unique index (lines 155-172) are no-ops for demo; `users` is Clerk-managed, demo schema has
     no `users` table (identity is header/cookie-based).
   - **`public.chyme_*` ALTERs retargeted** — lines 148-149 (`ALTER TABLE IF EXISTS public.chyme_room_members`
     / `public.chyme_messages`) replaced with unqualified names; search_path routes them to `demo.*`.
   - **`table_schema = 'public'` guards retargeted** — the lighthouse `move_in_date` DO block
     (lines 1238-1254) guards with `WHERE table_schema = 'public'`; retargeted to `'demo'` so the guard
     is false for a fresh demo table (column never existed there → UPDATE is skipped).
   - **Extensions** — idempotent, schema-agnostic; left as-is.
   - **View ordering** — already fixed: `skills_taxonomy_dependency_graph` moved to end of schema.sql.
   - **Neon pooler restriction** — `search_path` in pg startup options is rejected by Neon's PgBouncer
     pooler. `migrateToDemo.mjs` and `postgres.ts` use `DATABASE_URL_DIRECT` (unpooled endpoint). Owner
     must add this to Infisical `production`.
   - **v2→v3 pre-migration** also documented: chyme v2 tables must be DROPped (confirmed deprecated by
     owner) and `skills_taxonomy_flattened_projection` VIEW must be DROPped (promoted to BASE TABLE in v3)
     before running `schema.sql` on the real prod DB clone.
   Validation: `demo` schema has 155 tables (all v3 tables; `public` has 204 including 49 v2-only
   legacy tables). All key tables present, no `users` table, `chyme_rooms` has correct v3 columns.
   **Owner action**: add `DATABASE_URL_DIRECT` (Neon unpooled endpoint) to Infisical `production`.
   Then run `pnpm migrate:demo-schema` on Render (or via a one-off migration job) to provision the
   `demo` schema on the production Neon DB.
4. **Identity**: configure the `demo-mode` participant allowlist (Unleash per-user targeting); seed
   participant accounts (owner + testers) and auto-provision a demo profile on first demo login.
5. **Per-plugin demo seeds (scenario matrix)** — run against the `demo` schema (seed runner sets
   `search_path=demo`), starting with credit-bearing plugins (service-credits, trusttransport, lighthouse,
   socketrelay, foundation) so the `ctf-demo` Formance ledger is exercised E2E.
6. **Verify on Render**: target `demo-mode` to your own Clerk id, confirm your interactions read/write only
   `demo` + `ctf-demo`; `demo-mode` OFF → prod untouched. Then add testers.

## Open Questions

1. **Demo-mode data strategy:** Synthetic data flag, Neon branch, or demo tenant? (blocks server.ts routing)
2. **Public route enumeration & gating:** Binary flag, per-route flags, or middleware-wide? (blocks Clerk middleware design)
3. **Parity scope:** Is this web-only, or does mobile need public screens + demo mode?
4. **Demo data persistence:** If Neon branch, should demo branch be persistent (seeded once) or reset on each session?
5. **Admin access:** Should admins/operators be able to toggle `public-surface` and `demo-mode` flags, or are these system-level only?

## How A Future Session Should Start

1. **Owner provides locked decisions** for Open Questions 1–5 (verbatim updates to this doc).
2. **Check design submodule** for public-surface designs: `git -C design fetch && find design/public-surface/ -type f`.
   - Should cover: landing page, sign-in/sign-up, directory public profile, unlock form, demo-mode styling/labeling.
3. **Verify design covers required states** per rule 126 for each public route.
4. **Reconcile design against locked decisions:**
   - Does demo-mode design match data strategy choice? (synthetic labels, realistic data, etc.)
   - Do public screens match gating strategy? (show errors if flag OFF, etc.)
5. **Implement foundation** (if not done): database routing, middleware, flag keys, contracts, inventory.
6. **Implement UI** per rule 126: public screens, demo-mode styling, mobile feature (if applicable).

## Build Checklist

- [ ] **Foundation Phase**
  - [ ] Owner locks Decisions 1, 2, 3, and Open Questions 4–5
  - [ ] Confirm `SYSTEM_FLAGS.PUBLIC_SURFACE` and `SYSTEM_FLAGS.DEMO_MODE` exist in keys.ts (already done in #103)
  - [ ] Plan database routing: Neon branch script, environment setup, or demo-tenant creation
  - [ ] Plan middleware changes: where to add flag check, fallback behavior
  - [ ] Enumerate all public routes in `ctf/packages/web/middleware.ts`
  - [ ] Create `ctf/docs/contracts/PUBLIC_SURFACE_API_CONTRACTS.yaml`
  - [ ] Create/update public-surface inventory file

- [ ] **UI Implementation Phase** (gated on design pass)
  - [ ] Design: `design/public-surface/` submodule (landing, auth flows, directory profile, unlock form)
  - [ ] Public **page** gating (vs API gating, which is done): when `public-surface` is OFF, decide whether `/`, `/apps/directory/[handle]`, `/plugin/unlock` redirect to sign-in or render a "currently unavailable" surface. The "unavailable" surface is a rendered UI → needs design. Redirect-only behavior could ship as foundation if the owner prefers.
  - [ ] Landing page: responsive, demo-mode styling
  - [ ] Sign-in/sign-up flows: flag-gated, demo-mode labels
  - [ ] Directory public profile: flag-gated, demo-safe data
  - [ ] Unlock form: flag-gated, demo-safe data
  - [ ] Demo-mode visual indicator (badge, banner) on all screens when flag ON
  - [ ] Mobile feature (if applicable): public screens + demo mode in Expo
  - [ ] Tests: flag ON/OFF → screens visible/gated; demo ON/OFF → real/synthetic data
