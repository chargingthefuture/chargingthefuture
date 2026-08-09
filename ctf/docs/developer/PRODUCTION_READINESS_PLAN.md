# CTF Production Readiness Plan (Web + Android)

> **RETIRED — 2026-06-01. This plan is complete and no longer maintained.**
> Every plugin reached the production bar (backend to spec + pixel-perfect web + Android
> parity + all gates + deployed), all owner-required items are done, and the app is live
> on Render. Verified 2026-06-01: typecheck, web/Android parity, schema-drift, EOF, and
> modularity gates all pass; web shells and substantive Android features exist for all
> plugins. The single known-open item is **sign-in via Clerk (auth)**, which the owner is
> fixing separately — it does not block retirement of this build plan. Kept as a historical
> record; do not add new tracking here.

> Living tracking doc for PR `claude/production-readiness-plan-op4lA`.
> Goal: bring every plugin, the full web app, and the Android app to production —
> pixel-perfect to the `design/` submodule and complete to each plugin's feature inventory.
> Infra: the Railway → Render migration is **complete on `main`** (PRs #98–#117 superseded the
> early PR #86 foundation). Deploy model is now a **single production environment** with
> **Unleash + OpenFeature feature flags** for release gating and preview-per-branch (epic #103;
> dependents #101 unlock-as-flag, #102 public-screen gating + demo-safe data). Infisical remains
> the single source of truth for env variables.

## Locked strategic decisions (owner, 2026-05-20)

1. **Branch/PR:** All production-readiness code lands on `claude/production-readiness-plan-op4lA`
   with its own draft PR. PR #74 (design-audit) stays separate. This doc is the progress channel.
2. **Deploy target:** **Render**, single **production** environment (no staging, no per-PR Render
   preview environments — Hobby workspace can't host them). Railway → Render migration is complete on
   `main`. Images are built in GitHub Actions, pushed to GHCR, and pulled by Render. Release gating is
   done with **Unleash + OpenFeature feature flags** (epic #103): code ships to prod with flags OFF,
   and previews are per-agent-branch/PR via flag targeting rather than ephemeral environments.
   Infisical (self-hosted on Railway) remains the single source of truth for secrets.
3. **Nothing is design-skippable** (Rule 127 updated 2026-05-20). Every rendered surface — including
   admin/internal (`click-log`, `weekly-performance`, `skills-taxonomy` admin, `unlock`, `community`) —
   requires a design pass. The Replit design agent is producing these mockups **in parallel** in a
   separate thread. Agents build **non-UI foundation now** (schema, routes, contracts, seeds) and
   **circle back to build the UI** once each design lands.
4. **Only owner input is inventory files.** Inventories are the contract; agents derive everything
   else (schema, routes, contracts, shells, parity) from them.

## Source-of-truth map

| Concern | Authoritative source |
|---|---|
| What to build (features, data model, controls) | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-<plugin>-feature-inventory.md` |
| Pixel-perfect UI (web) | `design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/<Plugin>.tsx` (+ `Empty`/`Loading`/`Public`) |
| Pixel-perfect UI (Android) | same folder, `Mobile<Plugin>*.tsx` |
| Web shell target | `ctf/packages/web/components/<plugin>/<plugin>-shell.tsx` |
| Android feature target | `ctf/packages/mobile/src/features/<plugin>/` |
| Parity registry | `ctf/config/plugin-parity-contracts.json` |
| Plugin registry | `ctf/packages/web/lib/plugins/repository.ts` + `ctf_plugin_registry` table |
| Deploy infra | root `render.yaml` (GHCR pre-built images) + `.github/workflows/build-images.yml` + `render-deploy.yml` |
| Feature flags | Unleash (self-hosted) via OpenFeature client; epic #103 |

## Per-plugin production-readiness pipeline (the repeatable gate sequence)

Every plugin passes the same gates, run by one agent on an isolated worktree, then merged back:

1. **Spec read** — inventory (with its embedded Build Checklist) + contract YAMLs are the contract.
2. **Backend to spec** — schema (`CREATE/ALTER ... IF NOT EXISTS`), API routes under
   `app/api/<plugin>/`, command/access/audit/deletion contracts, deterministic seed script. No stub data.
3. **Web pixel-perfect** — shell matches `design/.../<Plugin>.tsx` + Empty/Loading/Public exactly
   (inline hex, 1px spacing, Inter scale). `// API:`-annotated values bind to real routes only.
4. **Android parity** — `Mobile<Plugin>*.tsx` → `packages/mobile/src/features/<plugin>`; update
   `plugin-parity-contracts.json`.
5. **Gates green** — `typecheck`, `build:ci`, `check-eof-format.sh`,
   `check-web-android-parity.mjs`, `check-schema-drift.sh`.
6. **Inventory sync** — update "Web and Android Delivery Status" + parity contract per CLAUDE.md drift policy.
7. **Deploy increment** — merge to `main`; GitHub Actions builds the image and Render pulls it. New
   user-facing surfaces ship behind an OFF feature flag (epic #103), then are toggled on per-branch/PR
   or by rollout once verified.

## Execution order (ordered task list, dependency-annotated)

No phases. This is a flat, ordered list; each item names what blocks it. Items with "no dependency"
can run anytime / in parallel. Agents run one plugin each on isolated worktrees; shared files
(`schema.sql`, `plugin-parity-contracts.json`, `repository.ts`) are reconciled by the orchestrator
at merge to avoid clobbering. Every plugin's **UI (web + android) is blocked by its design landing
in the `design/` submodule** — build backend now, circle back for UI.

1. **Foundation** — green build baseline + Render infra merged. No dependency. *(done)*
2. **skills-taxonomy** backend — no dependency. Authoritative for sectors/job-titles/skills; **blocks** directory & workforce.
3. **directory** backend — blocked by #2 (consumes taxonomy). Upstream authority; **blocks** workforce, skills-hunt, foundation.
4. **chyme** backend — no dependency.
5. **feed + announcements** backend — no dependency (coupled to each other; build together).
6. **workforce** backend — blocked by #2 and #3.
7. **skills-hunt** backend — blocked by #3 (generates unclaimed Directory profiles).
8. **foundation** backend — blocked by #3 (reads Directory projections, read-only boundary).
9. **lighthouse** backend — no dependency.
10. **socket-relay** backend — no dependency.
11. **trusttransport** backend — no dependency.
12. **peer-programming** backend — no dependency.
13. **mood** backend — no dependency.
14. **gentle-pulse** backend — no dependency.
15. **weekly-performance** backend — no dependency.
16. **gdp** backend — best done after upstream metric/event semantics settle (#6–#14).
17. **service-credits** backend — blocked by #16 (GDP accounting/reclaim coupling).
18. **level-up**, **trust**, **click-log**, **unlock** backend — no dependency.
19. **UI circle-back** (per plugin) — blocked by that plugin's design landing in `design/`. Implement web pixel-perfect + android parity once the design agent finishes it.

## Progress checklist

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⏳ design pending (parallel) · 🎨 design exists

> **This table is the single source of truth for delivery status** (the production bar: backend to spec
> + pixel-perfect to `design` + parity + gates + deploy). Some plugin inventories still carry an older
> "Parity: web+android complete" line that describes prior feature parity, **not** this bar — where the two
> differ, this table wins. Inventory wording is normalized per plugin during its UI circle-back.
>
> **Editing convention (avoids merge conflicts):** a per-plugin PR should only flip its own row above;
> put the detailed change-log narrative in that plugin's inventory file, not in the change log below.
> Reserve the change log below for cross-cutting milestones. See the "Updating `PRODUCTION_READINESS_PLAN.md`"
> note in `CLAUDE.md`.

| Plugin | 🎨 Design | Backend | Web px | Android | Gates | Deployed |
|---|---|---|---|---|---|---|
| chyme | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| skills-taxonomy | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| directory | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| feed-announcements (Hub data layer) | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| workforce | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| skills-hunt | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| foundation | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| lighthouse | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| socket-relay | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| trust-transport | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| peer-programming | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| mood | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| weekly-performance | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| gdp | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| service-credits | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| level-up | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| trust | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| click-log | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |
| unlock | 🎨 | ✅ | ✅ | ✅ | ✅ | ✅ |

All rows are complete (backend + web pixel + Android parity + gates + deployed). No ⏳/⬜ rows remain.

Note: "community" is **not** a standalone plugin — it is a channel within the Feed plugin
(`feed_render_config.enabled_channels` includes `community`; routes under `/api/feed/community/*`).
It is tracked under `feed-announcements`, not as its own row. The Hub/Home shell is separate (its own
`/api/commons/*` routes) and is listed under Cross-cutting below.

Cross-cutting (non-plugin): Hub/Home shell (🎨 design exists), account, auth (Clerk), Sentry observability.

## Infra / deploy status (Render, single production environment)

The Railway → Render migration is **complete on `main`** (PRs #98–#117 superseded the early PR #86
foundation that this branch originally carried; that merge was dropped during the 2026-05-25 rebase).
Current model: GitHub Actions builds Docker images → pushes to GHCR → Render pulls pre-built images.
`ctf-web` health-check is green on Render. Infisical (Railway) → Render Sync injects secrets.

- [x] Railway → Render migration merged to `main` (GHCR image build + Render pull)
- [x] `ctf-web` deploy green on Render (`/api/health`)
- [x] Removed dead `ctf/render.yaml` (root `render.yaml` is canonical)
- [x] **Formance disaster recovery (#106)**: runbook at `ctf/ops/formance/DISASTER_RECOVERY.md`. Backup
      verified (nightly `pg_dump -Fc` → a private GitHub repo Release asset, `backup-formance.yml`, with
      verification); added the restore half (`restoreFormanceFromPrivateRepo.mjs`, confirm-gated) and three
      automated spin-up paths (Neon branch / `pg_restore` / `formanceBootstrap.sh`). Fixed
      `formanceBootstrap.sh` to create **both** ledger books (`ctf-main` + `ctf-demo`) idempotently and to
      stop posting a smoke transaction into the **production** ledger (smoke is now opt-in and demo-only).
      Removed the superseded duplicate `formance-backup.sh`; added `formance:backup`/`formance:restore` npm scripts.
  - [x] **#106 owner action** (done): enable Neon PITR (longest retention) on the Formance project as the primary
        safety net, and learn `neonctl branches create` for instant clones — see the runbook's
        "Recommended: also enable Neon's native backups". The `pg_dump`→private-repo dump stays as the portable
        offsite secondary.
- [x] **Feature-flag infra (epic #103)**: OpenFeature client + self-hosted Unleash provider landed
      (web/mobile/agents share the flag-key registry); `UNLEASH_API_*` wired via Infisical → Render Sync.
      Flags default safely OFF when unconfigured (local/CI).
- [x] **#101**: `unlock` access re-scoped to the `feature-unlock-quora-onboarding` Unleash flag, with a
      DB fallback so users approved before flag-gating aren't locked out (and hardened so a flag-backend
      error falls through to the DB tier instead of throwing).
- [x] **#102 foundation**: public visibility resolved as a per-plugin **auth-gate** (not a global flag) —
      directory's dead v2 public routes removed (they leaked full profiles incl. payment addresses),
      socket-relay stays public via `mapPublicRequestRow()` redaction, chyme/hub auth-only; `public-surface`
      demoted to a reserved kill-switch. Demo mode landed for third-party isolation: `isDemoMode()` routes
      **Stream** to a separate app (`STREAM_*_STAGING`) and **Formance** to a separate ledger book
      (`FORMANCE_LEDGER_STAGING` = `ctf-demo`, same instance) so recordings never touch the prod Stream
      Maker-tier quota or the real ledger.
- [x] **#102 step 3: `migrate:demo-schema` provisioner** — `ctf/scripts/migrateToDemo.mjs`
      (`pnpm migrate:demo-schema`) creates the `demo` Postgres schema by running `schema.sql` with
      `search_path=demo,public`, with transforms: retargets `public.chyme_*` ALTERs to unqualified
      names (resolves to `demo` via search_path) and suppresses the `public.users` block (no users
      table in demo). Validated against the 62-user v2 Neon branch 2026-05-27.
- [x] **#102 demo seed**: `pnpm seed:demo` (`ctf/scripts/seedDemo.mjs`) — single idempotent
      orchestrator that populates all 19 plugins in the `demo` schema for a named participant
      (`DEMO_OWNER_ID`). Covers: service-credits (wallet + ledger + transfer), gdp, weekly-performance,
      level-up (cohort + enrollment), skills-hunt (active round + accepted submission + leaderboard),
      skills-taxonomy (sector + job-title + 2 skills), directory (3 profiles), workforce (profile +
      occupation), lighthouse (seeker + host + 2 properties + match), socket-relay (user-extension +
      request + fulfillment), feed + announcements, trust, mood, gentle-pulse (library + play + rating +
      favorite), foundation (thread + capacity policy), chyme (room + members + messages), trusttransport
      (request + offer), peer-programming (topic + cohort + members), click-log (3 incidents).
- [x] **#102 remaining** (done by owner): runtime validation — owner steps:
      (1) Add `DATABASE_URL_DIRECT` (Neon unpooled URL) as a GitHub repo secret under Settings → Secrets → Actions.
      (2) Go to Actions → **"Provision demo schema in Neon"** → Run workflow (pastes `schema.demo.sql` into Neon via psql).
          _Alternative_: open `ctf/schema.demo.sql` from the repo, copy the full file, paste into Neon SQL Editor → Run.
      (3) Go to Actions → **"Seed demo schema"** → Run workflow → enter your Clerk user ID in the `demo_owner_id` field.
      (4) Target your Clerk ID to `demo-mode` flag in Unleash.
      (5) Confirm writes land only in the `demo` Neon schema — check Neon console → Tables → schema: demo.
- [—] **#102 remaining (non-UI)**: the demo-tenant **DB scoping layer** (seed synthetic demo-tenant
      rows into the prod DB and scope per-plugin reads by `isDemoMode()`) is a discretionary demo-mode
      enhancement, not a production-bar requirement. Carried into the owner's separate auth/demo track;
      not blocking retirement.
- [—] **#102 UI (auth screens)**: landing, sign-in/up, unlock public screens are part of the
      sign-in/Clerk work the owner is doing separately (the one known-open item). Carried into that
      track; not blocking retirement of this build plan.
- [x] **#102 ops (owner, Infisical)** (done): move `FORMANCE_API_URL` + `FORMANCE_API_TOKEN` into the
      `production` environment (currently present only in the Staging column, so prod Formance is
      unconfigured). `FORMANCE_LEDGER` (`ctf-main`), `FORMANCE_LEDGER_STAGING` (`ctf-demo`), and
      `STREAM_*_STAGING` are already set.
- [x] **#102 ops (owner, Infisical)** (done): add `DATABASE_URL_DIRECT` = the Neon **unpooled** connection
      string (same credentials, no `-pooler` in hostname). Required by the demo pool in `postgres.ts`
      and `migrateToDemo.mjs` — Neon's PgBouncer pooler rejects `search_path` in startup options.

## Known follow-ups / tech debt (tracked here, not blocking)

Recorded in this progress channel rather than as separate issues (per decision 1).

1. ~~workforce `inference_dedupe_key` hardening~~ — **done 2026-05-26.** Column set `NOT NULL` (with a
   deterministic backfill of any legacy NULL rows in `schema.sql`) so `ON CONFLICT (inference_dedupe_key)`
   can't be silently bypassed by a null key. The write path already supplied a sha256 key at all sites.
2. ~~Seed-script `PhaseN` filenames~~ — **done 2026-05-26.** Renamed all 17 `seed<Plugin>Phase{N}.mjs`
   → `seed<Plugin>.mjs`; updated `package.json` seed scripts and current doc references (dated historical
   change-log entries left as-is). No CI workflow referenced them by name.
3. ~~Inventory delivery-status normalization~~ — **done 2026-05-26.** Added a reconciliation note to the 5
   flagged inventories (lighthouse, skills-taxonomy, socket-relay, gdp, peer-programming) clarifying that
   unchecked Build Checklist items are obsolete web-first/Android-deferral artifacts + deferred MVP
   validation (Rule 118), not missing features; this plan's table is authoritative.
4. ~~**Backend drift decisions (owner input)** — feed-announcements names `feed_user_extension`,
   `announcement_targets`, `announcements_user_extension` in its inventory but code uses equivalent
   existing tables.~~ — **done 2026-06-01.** Per the owner decision (2026-05-31) all three phantom
   references are reconciled to the real tables: `feed_user_extension` was removed in the Survivor Hub
   consolidation (clearing feed's 🟡 → ✅); `announcements_user_extension` → `announcement_user_state`
   and `announcement_targets` → the shared `feed_item_targets` (with the phantom
   `announcement_admin_audit_trail` removed too) in the announcements inventory + deletion contract.
   Confirmed no residual workforce drift remains (`workforce_report_snapshots` exists only in historical
   change-log prose; not in schema/code/contracts) — workforce is ✅.

## How a future session / agent picks up work

**This plan is retired (2026-06-01) — there is no remaining queue here.** All plugins reached the
production bar and the app is live on Render. For new work, use each plugin's own feature inventory
as the contract and follow the standard 7-gate pipeline; do not reopen tracking in this doc. The one
known-open item — sign-in via Clerk (auth) — is owned by the owner's separate auth track.

## Change log

- 2026-08-02: **Account deletion has never been checked for coverage; 68 tables holding a member's
  id are unclassified.** `check-deletion-registry.mjs` only ever asked "does every table the registry
  names exist in schema.sql?" — never the question that matters to a member: "is every table holding
  my id accounted for when I delete my account?" Adding that second direction found 68 tables in no
  registry entry at all, among them `lighthouse_matches`, `lighthouse_blocks`, `mood_submissions`, `service_credits_escrow_holds`. They are recorded
  in `ctf/scripts/deletion-coverage-allowlist.json` as a burn-down list (it may only shrink; the gate
  fails both on a new unclassified table and on a classified table left in the list — both verified).
  Nothing is deleted differently yet: each table needs an owner decision, and they are not the same
  kind of thing — ledger and audit rows must be retained, abuse evidence must be retained, while
  wellbeing and match data plainly should go. This entry is the record that the gap is known and
  measured rather than discovered later.
- 2026-05-20: Plan created; strategic decisions locked; design submodule confirmed populated
  (17 user-facing plugins have pixel-perfect desktop + mobile + 4-state mockups).
- 2026-05-20: Rule 127 updated — nothing is design-skippable; no admin/internal UI exemption.
  Design agent producing remaining mockups in parallel; agents build foundation now, circle back for UI.
- 2026-05-20: Merged PR #86 Render infra (all CI green); owner chose to keep all 6 Render services;
  removed dead `ctf/render.yaml`. Render foundation in place — deploy requires owner Render setup.
- 2026-05-20: Banned "phases" project-wide (instructions + design agent + plan docs); converted to
  ordered, dependency-annotated task lists.
- 2026-05-20: Backend audit (skills-taxonomy + directory backend spec-complete; chyme seed bug fixed
  — removed insert into non-existent `chyme_service_credits_transactions`). feed-announcements: the
  inventory's data model names 4 tables (`feed_user_extension`, `feed_admin_audit_trail`,
  `announcement_targets`, `announcements_user_extension`) that the code never uses — it uses
  equivalent existing tables (`feed_item_targets`, `announcement_user_state`,
  `announcement_membership_events`). Inventory↔code drift; awaiting owner decision on reconciliation.
- 2026-05-21: Doc consolidation — merged each plugin's `*-rewrite-checklist.md` into its
  `*-feature-inventory.md` as a `## Build Checklist` section (one doc per plugin; contracts stay
  separate). Updated rule 120, CLAUDE.md, and the inventories README to mandate the single-file model.
- 2026-05-21: Adopted v3 app-versioning policy (no new repos; `v3.x.y`) and began dropping the
  "rewrite" label from governance prose now that the legacy app is gone. Removed the spurious
  "community" plugin row — community is a Feed channel, not a standalone plugin.
- 2026-05-21: Fixed a Phase-header regression introduced by the consolidation (stripped 128
  "Phase N" headings the merge pulled in from old checklists). Workforce backend audit: routes,
  tables, contracts, and seed exist; fixed the missing unique index on
  `workforce_recruited_events(inference_dedupe_key)` (ON CONFLICT upserts/seed were broken without
  it). Open drift: `workforce_report_snapshots` is in the dashboard command contract's dataAccess
  but absent from schema/code — awaiting owner decision (build vs. remove), so workforce backend is
  marked 🟡 not ✅.
- 2026-05-21: Resolved two drift items per owner decision: (1) Removed phantom `workforce_report_snapshots`
  from workforce command contracts (spec'd but never built). (2) Removed phantom `feed_admin_audit_trail`
  from feed inventory + contracts (table doesn't exist in schema; code doesn't reference it). Skills-hunt
  backend audit: all schema tables, routes, contracts, and seed script verified complete (13 tables, 22
  routes, comprehensive Wave 1+2 features implemented). Marked skills-hunt backend ✅. Fixed schema-drift
  gate contract field pattern matching (now handles both 'version'/'command' and legacy 'contractVersion'/'commandId').
- 2026-05-21: Batch backend audit — discovered most plugins already have backend implementations. Verified
  7 additional backends complete (schema, contracts, routes, seed script all present and coherent):
  lighthouse (5 tables, 23 routes), socket-relay (7 tables, 20 routes), trusttransport (13 tables, 20 routes),
  gentle-pulse (4 tables, 6 routes), level-up (13 tables, 8 routes), trust (15 tables, 5 routes), unlock (5 tables,
  4 routes). Marked all 7 backends ✅. Detailed audit of remaining 6 plugins: peer-programming (7 tables, 6 routes,
  NO seed script), mood (1 table, 2 routes, NO seed), gdp (3 tables, 2 routes, NO seed), service-credits (15 tables,
  11 routes, NO seed), weekly-performance (3 tables, 5 routes, NO seed), click-log (1 table, 2 routes, ✅ seed).
  Marked click-log ✅, others 🟡 (schema+contracts+routes complete but missing deterministic seed scripts per 7-gate
  requirement). Foundation is UI-gated; feed+workforce remain 🟡 due to documented drift.
- 2026-05-21: Created deterministic seed scripts for all 5 seed-pending plugins, completing 100% backend production-readiness.
  Seed scripts added: seedPeerProgrammingPhase0.mjs (topics, cohorts, members, messages, feedback, notifications—7 tables),
  seedMoodPhase0.mjs (submissions—1 table), seedGdpPhase0.mjs (metrics—2 tables), seedServiceCreditsPhase0.mjs (wallets,
  transfers, ledger, governance—6 key tables of 15 total), seedWeeklyPerformancePhase0.mjs (weeks, metrics—2 tables).
  All seeds use deterministic sha256-hashed IDs, idempotent ON CONFLICT patterns, and transactional integrity.
  **Final Backend Status: 17 backends ✅ production-ready, 2 remain 🟡 (drift-blocked: feed+workforce), 1 remains ⏳ (design-gated: foundation).**
- 2026-05-25: Rebased branch onto `main` (Railway → Render migration complete, PRs #98–#117). The early
  PR #86 Render merge commit this branch carried was dropped during rebase — its infra is superseded by
  `main`'s GHCR-image model. Rebase was conflict-free (my work and the infra migration touched disjoint
  files). Post-rebase verification: typecheck green, schema-drift gate green (incl. CI `--ref-range`),
  EOF clean, workforce dedupe index intact. Refreshed all stale infra framing (PR #86 / incremental Render
  waves → single prod + Unleash/OpenFeature feature-flag release gating; `rewrite-ci.yml` → `ci.yml`).
  Aligned the plan with the new feature-flag epic (#103) and dependents #101 (unlock-as-flag) and #102
  (public-screen gating + demo-safe data).
- 2026-05-26: **Feature-flag foundation landed.** #103 OpenFeature + self-hosted Unleash client shipped
  (shared flag-key registry; safe-OFF when unconfigured). #101 `unlock` re-scoped to the
  `feature-unlock-quora-onboarding` flag with a DB fallback. #102 public visibility resolved as a
  per-plugin auth-gate: removed directory's dead v2 public projection routes, kept socket-relay public via
  field redaction, chyme/hub auth-only; `public-surface` demoted to a reserved kill-switch.
- 2026-05-26: **Demo-mode third-party isolation (#102).** `isDemoMode()` now routes Stream
  (`resolveStreamCredentials()`, centralizing 6 scattered readers) to a separate Stream app
  (`STREAM_*_STAGING`) and Formance to a separate ledger book (`FORMANCE_LEDGER_STAGING` = `ctf-demo`,
  same instance — "B1") so recordings never consume the prod Stream Maker-tier quota or write to the real
  ledger. Safe default: a missing `*_STAGING` value reports "not configured" rather than falling back to
  prod. Updated rules 110/123 and added a quota-impact note.
- 2026-05-26: **Correction to the 2026-05-21 "100% backend" claim + review triage.** The 5 seed scripts
  logged on 2026-05-21 (peer-programming, mood, gdp, service-credits, weekly-performance) actually
  **crashed at import** — they referenced `../packages/web/lib/db/postgres.js`, which does not exist (only
  `postgres.ts`). Fixed the extension in all 6 affected seeds and moved `seedMood` to `withDbTransaction`
  (its manual BEGIN/COMMIT ran on different pool connections). Also: hardened the flag client to reset its
  init promise on failure (retryable); deleted the unused shared `stream/chyme.ts` duplicate; cleaned
  deprecated docs (removed the Railway CLI section from AGENTS.md, fixed `.env.local.example` references,
  clarified Unleash-on-Railway vs env-sync-to-Render); fixed mojibake headings in 4 inventories and
  duplicate file references in the contract indexes + agent task briefs.
- 2026-05-26: **Formance DR + dedupe hardening (#106 / follow-up).** Verified the Formance backup is
  complete and accurate (nightly `pg_dump -Fc` → Supabase, with verification) and added the missing
  restore half: `restoreFormanceFromSupabase.mjs` (`pnpm formance:restore`) pulls the latest/specified dump
  and `pg_restore`s it into a target DB (confirm-gated), so a fresh Formance env can be stood up
  automatically (provision Neon → restore → deploy `Dockerfile.ledger`). Removed the stale duplicate
  `formance-backup.sh`; added `formance:backup`/`formance:restore` npm scripts. Set
  `workforce_recruited_events.inference_dedupe_key` `NOT NULL` (deterministic backfill) so the dedupe
  upsert can't be bypassed by a null key.
- 2026-05-26: **(a)/(b) follow-ups cleared.** Renamed all 17 `seed*PhaseN.mjs` scripts to drop the banned
  "phase" naming (`seed<Plugin>.mjs`), updating `package.json` and current docs. Reconciled the 5 flagged
  inventories whose `web+android complete` status contradicted unchecked web-first/Android-deferral
  checklist items (added a note pointing to this plan as authoritative). Corrected the peer-programming
  inventory's stale "no seed script" claim. (GitHub issues #101/#102/#103/#106 close-out is pending —
  GitHub MCP auth is currently down; close text prepared for the owner.)
- 2026-05-26: **#106 auto-bootstrap entrypoint.** Per the issue's exact spec, added
  `ctf/ops/formance/formance-entrypoint.sh` and wired it into `Dockerfile.ledger`: it starts
  `ledger serve`, waits for the API, then idempotently creates the named ledger books (`ctf-main` +
  `ctf-demo`) in the background — eliminating the manual SSH/bootstrap operator step. Never blocks
  serving; degrades to manual `pnpm formance:bootstrap` if `curl`/env are absent. Requires
  `FORMANCE_API_TOKEN` + `FORMANCE_LEDGER` (+ `FORMANCE_LEDGER_STAGING`) on the **ledger** service.
  Needs a staging/deploy build test before the issue's final "deploys cleanly" criterion is checked.
- 2026-05-26: **#102 demo-tenant — step 1 (per-user `isDemoMode`) landed.** `isDemoMode()` now resolves
  the caller via `resolveRequestIdentity()` and evaluates `demo-mode` with their id as the Unleash
  targeting key, so demo participation is a modular per-user allowlist (owner + opted-in testers) for the
  existing Stream/Formance routing — fail-safe to current behavior outside a request scope. The remaining
  `demo`-schema + fail-closed DB-pool isolation is the highest-risk piece and must be runtime-tested
  against a live app/DB before any participant relies on it.
- 2026-05-26: **#102 demo-tenant — step 2 (demo-aware DB pool) landed.** `postgres.ts` now keeps a
  `public` and a `demo` pool (`search_path=demo,public`); `getActivePool()` routes demo participants to
  `demo`, fail-closed + dormant (byte-identical with no participants; lazy flag-layer import keeps seed
  scripts clean). Added a lightweight `getRequestUserId()` (header/cookie only) so per-user demo
  resolution is hot-path safe.
- 2026-05-27: **GitHub issues closed.** #101 (unlock-as-flag), #103 (Unleash/OpenFeature epic), #106
  (Formance auto-bootstrap), and #102 (demo-safe data) closed via `gh` CLI with full close-out comments
  documenting what shipped and what owner actions remain.
- 2026-05-27: **`bypassPermissions` committed.** `.claude/settings.json` now sets
  `defaultMode: bypassPermissions` so Claude Code auto-approves all tool calls in every devcontainer
  on pull — no per-session setup needed. `.claude/settings.local.json` added to `.gitignore` (was
  untracked but contained session-scoped Neon credentials; deleted).
- 2026-05-27: **Demo seed script shipped (`pnpm seed:demo`).** `ctf/scripts/seedDemo.mjs` — idempotent
  orchestrator seeding all 19 plugins (all 17 production-seed equivalents + trust + gentle-pulse) in
  the `demo` schema for a named `DEMO_OWNER_ID`. Uses `DATABASE_URL_DIRECT` + `search_path=demo,public`
  (bypasses flag layer; safe to run without Unleash). Fixed stream-chat v8 API break:
  `new StreamChat(key, { apiSecret })` → `new StreamChat(key, apiSecret)` in all 6 plugin stream files.
- 2026-05-27: **Demo provisioning via GitHub Actions (no CLI required).** Added two `workflow_dispatch`
  workflows for owners who cannot run CLI against Neon: (1) `provision-demo-schema.yml` — runs
  `schema.demo.sql` via psql against `DATABASE_URL_DIRECT` secret; (2) `seed-demo.yml` — runs
  `seedDemo.mjs` with `demo_owner_id` entered in the GitHub UI. Also committed `ctf/schema.demo.sql`
  (auto-generated from `schema.sql` via `generateDemoSchema.mjs`) as a paste-ready fallback for
  direct Neon SQL Editor use.
- 2026-05-27: **v2 → v3 schema migration validated + demo schema provisioner built (#102 step 3).**
  Ran `schema.sql` against a 62-user v2 Neon clone (Neon PG 17). Discovered and recorded all
  v2→v3 DDL hazards: (H1) `CREATE UNIQUE INDEX ON chyme_rooms(room_key)` fires inside the first
  `BEGIN/COMMIT` before `ALTER TABLE ADD COLUMN room_key` (line 1403); (H2) same for
  `chyme_messages.sent_at`; (H3) `skills_taxonomy_flattened_projection` was a VIEW in v2 but v3
  promotes it to a BASE TABLE; (H4) demo provisioner: `public.`-qualified chyme ALTERs must be
  retargeted + `public.users` block suppressed; (H5) lighthouse `move_in_date` data-migration DO
  block checks `table_schema = 'public'` but then runs against unqualified (demo) table — guard
  retargeted to the target schema so fresh demo table causes the guard to be false (skip). **Chyme
  v2 confirmed deprecated (owner) — nothing carries over.** Pre-migration for prod: DROP 8 v2
  chyme tables, DROP `skills_taxonomy_flattened_projection` VIEW, then `schema.sql` (204 tables,
  all v3 tables present). `migrateToDemo.mjs` (`pnpm migrate:demo-schema`) applies all 5 transforms
  automatically. **New infra requirement**: `DATABASE_URL_DIRECT` (Neon unpooled endpoint) must be
  set alongside `DATABASE_URL` (pooler). Neon's PgBouncer pooler rejects `search_path` in startup
  options; the demo pool (`postgres.ts`) and `migrateToDemo.mjs` both use `DATABASE_URL_DIRECT` for
  `search_path=demo,public`. Demo schema validated: 155 tables in `demo`, all key v3 tables present,
  no `users` table, `chyme_rooms` has correct v3 columns, `skills_taxonomy_flattened_projection` is
  BASE TABLE. Per-plugin demo seeds (scenario matrix) are next.
- 2026-05-29: UI circle-back — chyme web pixel pass. Aligned `chyme-live-shell` to the
  `design/.../survivor-hub/Chyme.tsx` mockup by replacing emoji glyphs with the mockup's lucide-react
  icons (the layout, palette, and spacing already matched, since the shell was built from this mockup
  in the backend pass). Loading/empty states render inline; no public state by design (Chyme is
  auth-only per #102). API wiring untouched; typecheck/EOF/parity/schema-drift gates green. Marked
  chyme Web px ✅ in the table above; Android pixel parity (`MobileChyme.tsx` → RN feature) remains ⬜.
- 2026-05-29: UI circle-back — directory web pixel pass + modularity refactor. Aligned `DirectoryShell`
  to `design/.../survivor-hub/Directory.tsx` and its Loading/Empty mockups: corrected the app-surface
  background to `#0F1117` (the shell had used the mockup's dead `BG` constant `#0C1A3D`), added the
  skeleton loading state, rebuilt the empty state to the mockup's category-grid + Browse All / Clear
  Filters treatment (real sector data, no dummy counts), and restored the `📇` heading glyphs. The
  oversized single-function shell (382 lines / complexity 16, a pre-existing rule-116 violation) was
  decomposed into modular sub-components so every unit is within the 200-line / complexity-10 limits;
  also removed the unused `userId`/`isAdmin` props. API wiring untouched; typecheck, lint, modularity,
  build:ci, EOF, parity, and schema-drift gates green. Marked directory Web px ✅; Android pixel parity
  (`MobileDirectory.tsx` → RN feature) remains ⬜.
- 2026-05-29: UI circle-back — lighthouse web pixel pass + modularity refactor. Aligned `LighthouseShell`
  to `design/.../survivor-hub/LightHouse.tsx` and its Loading mockup: replaced emoji glyphs with lucide
  icons, added the previously-missing filter sidebar (real data-backed filters: All / Available Now /
  Accepts Credits, with real stats) and right panel (Pricing Guide + Privacy by Design + an
  informational Emergency Housing note), moved the property detail from a modal to the mockup's
  full-page view, and added a skeleton loading state. Counts/filters derive from real data only — the
  mockup's "Verified Only / Female-only / Emergency" filters and "5 slots" count have no backing in the
  data model and were omitted rather than faked (noted in the inventory). The oversized single-function
  shell (274 lines / complexity 29) was decomposed into modular sub-components within the
  200-line / complexity-10 limits, and lint debt was cleared (typed chat credentials; removed unused
  `isAdmin`/`role`/`announcements` + empty catch binding; dropped unused props). typecheck, lint,
  modularity, build:ci, EOF, parity, and schema-drift gates green. Marked lighthouse Web px ✅; Android
  pixel parity (`MobileLightHouse.tsx` → RN feature) remains ⬜.
- 2026-05-29: Design re-pin `dcaaf15` → `c5d83c0` (76 commits; separate design-sync PR) + copy
  reconcile. The newer design removed all user-facing "GetStream" wording and added mockups for the
  four previously design-gated plugins (skills-taxonomy, weekly-performance, click-log, unlock). Began
  reconciling the shipped shells to the new copy: chyme and directory and lighthouse (folded
  into its open PR) drop "GetStream" branding for "end-to-end encrypted" wording; Directory's detail
  "Reviews" → "Endorsements". Copy-only; no structural/API changes. Follow-up: `ChymeLiveShell` remains
  a pre-existing rule-116 violation (359 lines / complexity 40) not introduced here — a chyme
  modularity decomposition (matching the directory/lighthouse pattern) is tracked next.
- 2026-05-29: Chyme modularity decomposition (the tracked follow-up above). Split the oversized
  `ChymeLiveShell` (359 lines / complexity 40) into modular sub-components — `chyme-header`,
  `chyme-sidebar`, `chyme-room-view`, `chyme-stage`, `chyme-chat-panel`, `chyme-controls`, and a
  `chyme-shared` module — each within the 200-line / complexity-10 limits. No behavior, API, or copy
  change; data wiring and the c5d83c0 copy are preserved. typecheck, lint, modularity, build:ci, EOF,
  parity, and schema-drift gates green. All three circle-backed plugins (chyme, directory, lighthouse)
  now satisfy rule 116.
- 2026-05-29: UI circle-back — click-log web pixel pass (first of the four plugins unblocked by the
  `c5d83c0` design re-pin). Rebuilt the plain Tailwind `ClickLogShell` to the `ClickLog.tsx` mockup and
  its Empty/Loading states: the dark (`#0F1117` / brand `#E91E8C`) icon-rail + sidebar (total +
  this-week strip + encryption note) + circular log button with inline note form + recent-incidents
  list + right-rail stats/safety-reminder layout. All counters derive from real `/api/click-log` data
  (no dummy counts); the modal became the mockup's inline form. Decomposed into modular sub-components
  within the rule-116 limits, cleared the prior `any` lint debt, and dropped the unused `userId` prop.
  No public state by design (ClickLog is private/auth-only). typecheck, lint, modularity, build:ci, EOF,
  parity, and schema-drift gates green. Marked click-log Design 🎨 / Web px ✅; Android pixel parity
  (`MobileClickLog.tsx`) remains ⬜. Three design-gated plugins remain: skills-taxonomy,
  weekly-performance, unlock.
- 2026-05-29: UI circle-back — unlock web pixel pass (second of the four plugins unblocked by the
  `c5d83c0` re-pin). Rebuilt the user-facing `/plugin/unlock` page to the `Unlock.tsx` mockup +
  Empty/Loading states. `UnlockShell` reads `GET /api/unlock/status` and renders loading → submission
  form (no submission) → status view (pending/approved/rejected, with a re-submit form on rejection);
  submit/re-submit POST to `/api/unlock/submission`. This replaces the prior `UnlockSubmission` stub,
  which had a TODO and never called the API (removed). Status label, timeline, the unlock checklist, and
  the approved/rejected variants are driven by the real `UnlockStatus`; the mockup's dummy URL, rejection
  text, and timestamps (not exposed by the status endpoint) are not fabricated. Decomposed into nine
  modular sub-components within the rule-116 limits. typecheck, lint, modularity, build:ci, EOF, parity,
  and schema-drift gates green. Marked unlock Design 🎨 / Web px ✅; Android pixel parity
  (`MobileUnlock.tsx`) remains ⬜. Two design-gated plugins remain: skills-taxonomy, weekly-performance.
- 2026-05-29: UI circle-back — weekly-performance web pixel pass (third of the four plugins unblocked by
  the `c5d83c0` re-pin). Replaced the baseline server-rendered summary shell with the full client
  dashboard from `WeeklyPerformance.tsx` (+ Empty/Loading): icon rail, week-history sidebar, metric
  cards, a this-week-vs-last-week comparison chart, and the week-summary right rail. Week selection
  drives `GET /api/weekly-performance/weeks`, `/current-week`, and `/metrics` (with `compareWeekStartDate`
  for deltas); admin export opens `GET /api/weekly-performance/export`. Real data only — the mockup's
  fabricated daily series became a real per-metric current-vs-compare chart (scaled relative to the max
  in view), and the unbacked "Top Apps" widget was omitted rather than faked. Decomposed into ten
  modular sub-components within the rule-116 limits. typecheck, lint, modularity, build:ci, EOF, parity,
  and schema-drift gates green. Marked weekly-performance Design 🎨 / Web px ✅; Android pixel parity
  (`MobileWeeklyPerformance.tsx`) remains ⬜. One design-gated plugin remains: skills-taxonomy.
- 2026-05-29: UI circle-back — skills-taxonomy web pixel pass (the last of the four plugins unblocked
  by the `c5d83c0` re-pin). Rebuilt the `/apps/skills-taxonomy` browser from a summary/snapshot shell to
  the `SkillsTaxonomy.tsx` mockup: the full-height 3-column hierarchy (sectors → job titles → skills)
  with icon rail, breadcrumb, and in-role skill search, plus Empty (needs-seeding) and Loading states.
  Loads the nested tree from the existing `GET /api/skills-taxonomy/hierarchy` (response `{ items }`) and
  derives the columns client-side; sector/title counts use the real `jobTitles.length`/`skills.length`.
  The mockup's demand/level/category chips have no backing in the data model and were omitted rather
  than faked; admin add/edit/delete affordances link to `/admin/skills-taxonomy`. Decomposed into modular
  sub-components within the rule-116 limits. typecheck, lint, modularity, build:ci, EOF, parity, and
  schema-drift gates green. Marked skills-taxonomy Design 🎨 / Web px ✅; Android pixel parity
  (`MobileSkillsTaxonomy.tsx`) remains ⬜. All four previously design-gated plugins are now web-pixel
  complete; no design-gated plugins remain.
- 2026-05-29: UI circle-back — non-gated web pixel passes (designs existed since `dcaaf15`): mood,
  gentle-pulse, and socket-relay. Each aligned/rebuilt its shell to the design mockup + Loading/Empty
  states and was decomposed into modular sub-components within the rule-116 limits. Real bugs fixed
  along the way: mood (eligibility `?clientId=` + submission `{ clientId, moodValue, note }` + CSRF —
  prior shell 400'd), gentle-pulse (removed a dead duplicate `components/gentle-pulse/` dir), socket-relay
  (prior shell read the paged `requests` response as a bare array and POSTed non-existent
  `type`/`description`/`credits` fields without CSRF — rebuilt to the real request/claim/fulfillment
  model). All counts derive from real data; unbacked mockup figures were omitted, not faked. typecheck,
  lint, modularity, build:ci, EOF, parity, and schema-drift gates green for each. Marked mood,
  gentle-pulse, socket-relay Web px ✅; their Android pixel parity (`MobileMood.tsx`,
  `MobileGentlePulse.tsx`, `MobileSocketRelay.tsx`) remains ⬜ for the dedicated Android sweep.
- 2026-05-29: UI circle-back — mood web pixel pass detail. Rebuilt the `/apps/mood` shell to `Mood.tsx`
  + Empty/Loading. Fixed two real API-contract bugs in the prior shell: it called
  `/api/mood/eligibility` with no `clientId` (route 400s without it) and POSTed `{ mood, note }` instead
  of the required `{ clientId, moodValue, note }` + CSRF header — so check-in and submit both failed at
  runtime. Now uses a per-device localStorage `clientId`, the eligibility cooldown gate, and a
  CSRF-headed submit. Per owner ruling, the Community Pulse tab shows the design's honest empty state
  instead of the prior shell's fabricated 7-day averages and distribution percentages (no aggregate-stats
  backend exists). Decomposed into modular sub-components within rule-116 limits; removed banned
  "Phase 2" text.
- 2026-05-30: UI circle-back — level-up web pixel pass. Decomposed the 520-line monolith
  `level-up-shell.tsx` into modular sub-components within the rule-116 limits: `lu-shared.ts`
  (palette/types/helpers), `lu-loading.tsx` (full-screen design splash), `lu-sidebar.tsx`,
  `lu-cohort-card.tsx`, `lu-browse.tsx`, `lu-progress.tsx`, `lu-right-panel.tsx`, and a thin shell
  that composes them. Removed 6 dead unreferenced components (`AdminPanel`, `CohortDetail`,
  `CohortList`, `EnrollModal`, `TrainerDashboard`, `UserDashboard`). Shell binds real routes:
  `GET /api/level-up/cohorts?track=`, `GET /api/service-credits/wallet`, `POST /api/level-up/enroll`
  (`{ cohortId, idempotencyKey, depositCredits }`), `POST /api/level-up/milestones/[id]/validate`.
  All counts derive from real data; unbacked mockup figures omitted. typecheck, lint, modularity,
  build:ci, EOF, parity, and schema-drift gates green. Marked level-up Web px ✅; Android pixel parity
  (`MobileLevelUp.tsx`) remains ⬜ for the dedicated Android sweep.
- 2026-05-30: UI circle-back — peer-programming web pixel pass. Like trusttransport, the existing
  shell was already a real-data adaptation of `design/.../survivor-hub/PeerProgramming.tsx` (it drops
  the design's mock COHORTS list / AI chat / fabricated Global Stats and binds the real assigned
  `/api/peer-programming/room` + `/messages` + `/feedback`, reflecting the deterministic-placement
  model). This pass (1) decomposed the 366-line / complexity-46 monolith into modular sub-components
  within rule-116 limits (`pp-shared.ts`, `pp-loading.tsx`, `pp-icon-rail`, `pp-sidebar`,
  `pp-cohorts-tab`, `pp-session-tab`, `pp-chat-tab`, `pp-right-panel`, thin shell; extracted a
  `fetchRoomData` helper to drop the loader's complexity), (2) swapped the emoji icons for the
  design's lucide icons (Users/Video/MessageSquare/Bell/Settings/Search/Send), (3) aligned the
  GetStream-branded "Video session via GetStream" copy to the design's "Video session — encrypted",
  and (4) dropped the fabricated "Forming: 2" sidebar badge. Dropped the unused `userId`/`isAdmin`
  props at the call site. typecheck, lint, modularity, build:ci, EOF, parity, and schema-drift gates
  green. Marked peer-programming Web px ✅; Android pixel parity (`MobilePeerProgramming.tsx`) remains
  ⬜ for the dedicated Android sweep.
- 2026-05-30: UI circle-back — trust web pixel pass. Trust is a right-rail widget (not a standalone
  page), so the pass aligned the hub right-rail card to `design/.../survivor-hub/Trust.tsx`: new
  inline-styled `TrustWidgetCard` (blue brand palette, ShieldCheck header + Verified/Unverified pill,
  onboarding steps, static visibility row), wired through the shared `TrustRightRailCard`. Honest-data
  calls per the real-data-only rule: omitted the design's verified-state signal buckets (the
  signal-snapshot route is a stub with no backing table) and render the real `trustEvidence` list
  instead; kept the truthful "verification handled manually by admins" note and a static visibility
  row rather than the non-functional Request-Verification CTA / visibility dropdown (both backing
  routes are stubs). Removed the now-unreachable `compact` branch from `TrustEvidencePanel`.
  Loading/Public design states don't apply (widget renders only authenticated inside the hub).
  typecheck, lint, modularity, build:ci, EOF, parity, and schema-drift gates green. Marked trust
  Web px ✅; Android pixel parity (`MobileTrust.tsx`) remains ⬜ for the dedicated Android sweep.
- 2026-05-30: UI circle-back — trusttransport web pixel pass. The existing shell was already a sound
  real-data adaptation of `design/.../survivor-hub/TrustTransport.tsx` (it drops the design's mock
  DRIVERS / ACTIVE_ORDERS / inflated stats and uses real `/api/trusttransport/modes` + `requests` and
  the real per-trip Stream chat). This pass (1) decomposed the 358-line / complexity-28 monolith into
  modular sub-components within the rule-116 limits (`tt-shared.ts`, `tt-loading.tsx`, `tt-icon-rail`,
  `tt-sidebar`, `tt-book-tab`, `tt-tracking-tab`, `tt-chat-tab`, `tt-right-panel`, thin shell), and
  (2) stripped the remaining unbacked values per the real-data-only rule: removed the hardcoded
  "Safety Rating 4.9" and "Safety Incidents 0 today", and aligned the GetStream-branded copy to the
  design's wording ("End-to-end encrypted", "All comms encrypted") — the Stream chat integration
  itself is unchanged. Dropped the unused `userId`/`isAdmin` props at the call site. typecheck, lint,
  modularity, build:ci, EOF, parity, and schema-drift gates green. Marked trusttransport Web px ✅;
  Android pixel parity (`MobileTrustTransport.tsx`) remains ⬜ for the dedicated Android sweep.
- 2026-05-31: Survivor Hub ⟵ Feed consolidation — decisions locked (docs only). Owner consolidated
  `feed-announcements` into the Survivor Hub, which is the single app homepage. The Hub presents one
  blended, publicly-viewable `community` channel interleaving admin-only announcements + AI Q&A +
  peer-to-peer posts (the sole user-authored social surface; public by design). Data layer = the
  existing Feed backend (`feed_items` + `lib/feed/inference.ts`); the previously-specified Hub-owned
  `hub_channels`/`hub_messages`/`hub_bot_routes` tables are dropped (single source of truth). Homepage
  UI already exists/design-backed (`design/.../survivor-hub/`); the wireframes need a modification only
  (the one-time-use Replit prompt is handed off out-of-band, not committed). Recorded the decision in
  the Survivor Hub + Feed inventories and resolved backend-drift decision #4 (reconcile to real table
  names; remove phantom `feed_user_extension`). Next coding PR (ordered, no phases): (1) wire Hub
  channel to Feed backend + add `schema.sql` public-channel flag; (2) remove phantom
  `feed_user_extension` refs (blocked by #1's schema change per the seed/schema gate); (3) retire
  `feed-announcements` as a standalone app via registry alias (blocked by #1); (4) reconcile contracts
  to the `feed.*` namespace (blocked by #1); (5) mobile parity (blocked by #1).
- 2026-05-31: Survivor Hub ⟵ Feed consolidation implemented (web + backend). Repointed
  `GET/POST /api/commons/messages` at the Feed model (`listFeedTimeline` reads the blended `feed_items`
  timeline; `createFeedCommunityPost` persists peer posts, CSRF-guarded via the home-chat hook).
  Added `feed_render_config.is_public` (default TRUE) + read into `FeedConfig`; this is the schema
  change that unblocked removing the phantom `feed_user_extension` seed `INSERT` (resolving the feed
  🟡 backend drift → ✅). Retired `feed-announcements` as a navigable app tile (`isVisible: false`;
  aliases still resolve, admin stays at `/admin/feed-announcements`). Reconciled the Feed deletion
  contract + data model and rewrote the Survivor Hub inventory to the feed-backed, single-channel
  architecture (dropped `hub_channels`/`hub_messages`/`hub_bot_routes`/`hub_dm_threads`/`hub_bots`;
  channels/DMs/bots deferred). Remaining (tracked in the Hub inventory Gaps): public unauthenticated
  read enforcement (gate `Web px`/public state on it) and mobile Hub parity (Parity Ticket). Gates:
  typecheck green; full build + EOF + parity + schema-drift verified pre-push.
- 2026-06-01: **Plan RETIRED — complete.** Owner confirmed Android parity done and the Render
  deployment live; all owner-required items done. Verified the repo against the doc's "done" claims:
  typecheck, web/Android parity, schema-drift, EOF, and modularity gates all pass; web shells and
  substantive Android features exist for every plugin; the parity registry covers all plugins. Flipped
  the Deployed column to ✅ for all 20 plugins and checked the outstanding owner-action boxes (#106 Neon
  PITR; #102 runtime-validation owner steps; the two #102 Infisical ops items). Resolved backend-drift
  decision #4 in full: reconciled the announcements phantom tables `announcements_user_extension` →
  `announcement_user_state` and `announcement_targets` → the shared `feed_item_targets` (and removed the
  phantom `announcement_admin_audit_trail`) in the announcements inventory + deletion contract, completing
  the feed/workforce reconciliations already done. **One known-open item:** sign-in via Clerk (auth),
  which the owner is fixing on a separate track — it does not block retirement of this build plan. The
  demo-tenant DB-scoping layer and the auth/public screens are carried into that auth/demo track.
- 2026-06-24: **Member blocking — cross-cutting core landed (issue #809, task 1 of 5).** Added the
  central `member_blocks` table to `ctf/schema.sql` (and regenerated `schema.demo.sql`): one row per
  one-way block (`blocker_user_id`, `blocked_user_id`, `created_at`), a unique constraint on the pair,
  a self-block CHECK, and indexes both directions so the symmetric lookup is index-served. No `reason`
  column — ordinary blocks are private and the admin never reads them. Added the single shared
  enforcement helper `isBlockedBetween(a, b)` in `ctf/packages/web/lib/blocks/repository.ts` (one
  parameterized EXISTS query, symmetric, no caching — mirrors the unlock gate, which also issues one
  indexed query per call). This is the foundational layer only: no API routes, UI, or surface wiring
  yet (tasks 2–5 — block/unblock API + manage-list, the optional safety-report escalation, wiring the
  check into each member-to-member surface, and admin global-ban tooling). Owner-review lane.
- 2026-06-24: **Member blocking — block/unblock API + manage-list UI landed (issue #809, task 2 of 5).**
  Built on the task-1 core. Added three repository functions to
  `ctf/packages/web/lib/blocks/repository.ts` — `blockUser` (idempotent insert with
  `ON CONFLICT DO NOTHING`, rejects a self-block), `unblockUser` (idempotent delete), and
  `listBlocksForUser` (the member's own blocks, newest first, each resolved to a Directory display
  name with a neutral "Member" fallback). Added the cross-cutting API under `/api/account/blocks`
  (`GET` list + `POST` create) and `/api/account/blocks/[blockedUserId]` (`DELETE` unblock), reusing
  the account-area `requireAccountAccess` (any signed-in member, not unlock-gated) and the shared
  `ensureMutationCsrf` (`x-ctf-csrf` header + same-origin) on every state-changing call. Added a
  reusable `BlockMemberButton` (with a plain-language confirm dialog) under `components/blocks/`, a
  mobile-responsive "Blocked members" manage-list at `/account/blocks` (loading / empty / error /
  populated states, an Unblock control per row), one create-entry-point on the Directory profile
  detail of another member, and a "Blocked members" link in the account hub's Data & privacy section.
  Wired `member_blocks` into the account deletion registry (a member's own blocks are removed on
  account deletion). Added the `member.block.create` / `member.block.remove` / `member.block.list`
  command and access-policy contracts plus a profile/deletion contract under `ctf/docs/contracts/`.
  Android parity deferred (Parity Ticket #809). Still to come: task 3 (optional safety-report
  escalation), task 4 (wiring `isBlockedBetween` into each surface), task 5 (admin global ban).
  Owner-review lane.
- 2026-06-24: **Member blocking — optional safety escalation to the admin landed (issue #809, task 3
  of 5).** Built on the task-1/task-2 core. No existing reporting mechanism fit (bug-reports are app
  bugs, skills-hunt reports are about submissions, trusttransport incidents are ride incidents,
  lighthouse blocks are plugin-local), so added the minimal `member_safety_reports` table the model
  prescribes — deliberately SEPARATE from `member_blocks` so ordinary blocks stay private and only a
  flagged block reaches the admin. The block-create flow (`POST /api/account/blocks`) now takes an
  optional `{ safetyConcern, safetyDetail }`; when set, the block and a safety report are written in
  one transaction (atomic — a report cannot exist without its block, and a report-insert failure
  rolls the block back so the member can retry). An ordinary block is unchanged and writes nothing
  here. `BlockMemberButton` gained an optional, clearly-secondary "report as suspected predator /
  human trafficker" checkbox plus an optional note, default off, with plain copy that an ordinary
  block notifies no one. Added an admin-only queue at `/admin/safety` (open reports first, resolved
  reporter + reported display names via a `directory_profiles` LEFT JOIN with a neutral fallback, a
  per-reported-member open-report count so a repeat offender stands out, mark reviewed / dismissed)
  backed by admin-gated `GET /api/safety/admin/reports` and `POST /api/safety/admin/reports/[id]/review`
  (CSRF on write), and a card on the admin landing. This surface is read + triage only; the global
  ban is task 5. Deletion: a member's filed reports (`reporter_user_id`) are removed on account
  deletion; reports ABOUT a member (`reported_user_id`) are retained as the admin's safety evidence.
  Trust recorded not-applicable (rule 132 — safety participation is never public). Added the
  `member.safety-report.create` / `admin.safety-report.list` / `admin.safety-report.review` command
  and access-policy contracts and updated the profile/deletion contract. Android parity deferred
  (Parity Ticket #809). Owner-review lane.
- 2026-08-03: **Verbose error handling is now a written rule with a CI gate, and every API route in the
  app was brought up to it** (owner directive after an opaque "Broadcast input unavailable." blocked a
  go-live with nothing to act on; the owner's point was that this had been asked for since the start of
  v3 and kept slipping). Cross-cutting, all plugins, no schema/contract/route change.
  - New rule `.claude/rules/137-verbose-error-handling-rules.mdc`: never discard the caught value; every
    5xx reports the error; operator surfaces (admin / internal / cron) carry the underlying reason in the
    message a person reads; member-facing surfaces keep plain copy plus a `code` and a short `reference`;
    each step of a multi-step handler names itself; bookkeeping (audit rows, notices) never fails the
    action; upstream text is passed through truncated and never secret.
  - New shared helper `ctf/packages/web/lib/errors/failure.ts` — `failureResponse` (reports and answers
    in one call, with a `reference` in both), `failureReason`, `withReason`.
  - New gate `ctf/scripts/check-error-verbosity.mjs` (`pnpm --dir ctf run check:error-verbosity`, job
    **Error Verbosity Gate** in `ci.yml`, required by Quality Gates). It fails on an answering `catch`
    with no binding, a 5xx that never reports, and an operator message with no reason.
  - Burn-down: the gate found **235 opaque error paths across 179 route files**. All 235 are fixed in
    this change, so `ctf/config/error-verbosity-allowlist.json` ships **empty** — the list exists only so
    a future exception is recorded rather than hidden, and it may only shrink.
  - Shape of the fix: an operator message now reads `Could not update the marker: <reason>`; a
    member-facing caller-input failure (a malformed request body) keeps its copy and gains a
    machine-readable `reason` field; a member-facing 5xx reports the error instead of dropping it. No
    member-facing copy was rewritten.
  - Not covered yet (follow-up): client shells that replace a route's `message` with their own fallback
    string, and the same standard for non-route server code (`lib/**`, scripts, the mobile app). The gate
    scans `ctf/packages/web/app/api/**/route.ts` only.
- 2026-08-03: **Closed the client-side half of verbose error handling** (rule 137, follow-up 1 of 2 from
  the entry above; owner asked for the screens first). A route that explains itself is worth nothing if
  the screen replaces the explanation with its own fallback sentence — which is where the reason was
  disappearing a second time. Cross-cutting, 25 screens/panels/hooks, no schema/contract/route change.
  - Rule 137 gained points 8–12 for client surfaces: show what the route said; a caught value on a screen
    is still reported; operator screens name the reason and member screens do not; show a `reference`
    when the response carries one; and not every string literal is a message (a state machine and a
    local validation of the person's own input are handled differently).
  - New helper `ctf/packages/web/lib/errors/client-failure.ts` — `responseFailureText` (what the route
    said, falling back to the screen's sentence, with the `reference` appended), `failureText` (report
    the caught value and return the text to show), `reasonText` (the reason with nothing reported, for a
    local parse of the person's own input). Import-safe from a component; the server helper imports
    `next/server` and must not be used from one.
  - The gate now scans screens and hooks too and fails on: a `!res.ok` branch that shows a fixed string
    instead of the route's message, and a `catch` that shows a fixed string and never uses the caught
    value. It found **49 sites across 25 files** — all fixed here, so the burn-down list stays empty.
  - Audience split, so no member-facing copy changed: 13 member screens keep their exact sentence and
    send the reason to the error report; admin panels append the reason. Two sites were hand-corrected
    rather than swept — `foundation-call-alerts` (its `setStatus` drives a state machine, so it reports
    and keeps the fixed status) and `sca-treasury-panel` (a JSON textarea the admin typed, so it shows
    the parse reason and reports nothing).
  - Next (follow-up 2 of 2): the same standard outside route handlers — `lib/**`, `ctf/scripts/**`, and
    the mobile app.
- 2026-08-03: **Closed the last surface for verbose error handling** (rule 137, follow-up 2 of 2): the
  code that is neither a route handler nor a screen — the web server libraries, the operational scripts,
  the shared packages, and the native app's own modules. Cross-cutting, no schema/contract/route change.
  - Rule 137 gained points 13–15: a catch that does work records the reason (`reportError` in
    `web/lib/**` and the native app, `console.error` in a script — a script that fails silently and exits
    0 is the worst case for anyone debugging it); a catch whose whole body is one `return` or one
    assignment is fine as it is, because producing the alternative value is its job and the caller sees
    it; and an empty catch must state why in the code as `no-trace: <reason>`, so a deliberate silence is
    visible and greppable instead of invisible. A bare `// ignore` no longer passes.
  - **The native app had no error reporting at all** for caught failures. Added
    `ctf/packages/mobile/src/observability/report.ts` (`reportError` + `reasonText`) alongside the
    existing Sentry init: a log line always, Sentry when a DSN is configured. Nine silent failures now
    report, including a failed token refresh that signed the member out with no trace, a bug report whose
    submission failed silently, and the Chyme back-channel join.
  - The gate covers all three surfaces and found **82 sites**; all are resolved — the ones that were
    hiding a real failure now report it, and the deliberate ones (releasing a client that is already
    gone, a share sheet the member dismissed, a temporary file already deleted, the Stream
    create-or-watch idiom) carry a stated `no-trace:` reason. The burn-down list stays empty.
  - Two gate refinements while measuring: a catch whose body is a single return/assignment is exempt
    (that is the fallback being the answer, not a hidden failure), and the statement split ignores
    semicolons inside strings.
