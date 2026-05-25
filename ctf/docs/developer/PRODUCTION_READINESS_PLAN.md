# CTF Production Readiness Plan (Web + Android)

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
   admin/internal (`clicklog`, `weekly-performance`, `skills-taxonomy` admin, `unlock`, `community`) —
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
10. **socketrelay** backend — no dependency.
11. **trusttransport** backend — no dependency.
12. **peer-programming** backend — no dependency.
13. **mood** backend — no dependency.
14. **gentlepulse** backend — no dependency.
15. **weekly-performance** backend — no dependency.
16. **gdp** backend — best done after upstream metric/event semantics settle (#6–#14).
17. **service-credits** backend — blocked by #16 (GDP accounting/reclaim coupling).
18. **levelup**, **trust**, **clicklog**, **unlock** backend — no dependency.
19. **UI circle-back** (per plugin) — blocked by that plugin's design landing in `design/`. Implement web pixel-perfect + android parity once the design agent finishes it.

## Progress checklist

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⏳ design pending (parallel) · 🎨 design exists

| Plugin | 🎨 Design | Backend | Web px | Android | Gates | Deployed |
|---|---|---|---|---|---|---|
| chyme | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| skills-taxonomy | ⏳ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| directory | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| feed-announcements | 🎨 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ |
| workforce | 🎨 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ |
| skills-hunt | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| foundation | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| lighthouse | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| socketrelay | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| trusttransport | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| peer-programming | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| mood | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| gentlepulse | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| weekly-performance | ⏳ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| gdp | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| service-credits | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| levelup | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| trust | 🎨 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| clicklog | ⏳ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| unlock | ⏳ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |

For ⏳ rows: build backend now; UI (web + android) is gated on the parallel design pass — circle back when it lands.

Note: "community" is **not** a standalone plugin — it is a channel within the Feed plugin
(`feed_render_config.enabled_channels` includes `community`; routes under `/api/feed/community/*`).
It is tracked under `feed-announcements`, not as its own row. The Hub/Home shell is separate (its own
`/api/hub/*` routes) and is listed under Cross-cutting below.

Cross-cutting (non-plugin): Hub/Home shell (🎨 design exists), account, auth (Clerk), Sentry observability.

## Infra / deploy status (Render, single production environment)

The Railway → Render migration is **complete on `main`** (PRs #98–#117 superseded the early PR #86
foundation that this branch originally carried; that merge was dropped during the 2026-05-25 rebase).
Current model: GitHub Actions builds Docker images → pushes to GHCR → Render pulls pre-built images.
`ctf-web` health-check is green on Render. Infisical (Railway) → Render Sync injects secrets.

- [x] Railway → Render migration merged to `main` (GHCR image build + Render pull)
- [x] `ctf-web` deploy green on Render (`/api/health`)
- [x] Removed dead `ctf/render.yaml` (root `render.yaml` is canonical)
- [ ] **Feature-flag infra (epic #103)**: stand up Unleash + OpenFeature client (web, mobile, agents);
      wire `UNLEASH_API_*` via Infisical → Render Sync
- [ ] **#102**: gate public/non-auth screens behind flags + demo-safe data (Neon branch / synthetic)
- [ ] **#101**: re-scope `unlock` as a user-facing Unleash flag (retire bespoke verification queue or
      keep it as the grant mechanism — owner to confirm)

## How a future session / agent picks up work

1. `git -C design fetch && git submodule update --init design` (designs are the only UI source of truth).
2. Pick the next ⬜ plugin in the ordered list above whose dependencies are met.
3. Run the 7-gate pipeline above on an isolated worktree.
4. Update this checklist + the plugin inventory's Delivery Status in the same commit.
5. Merge to `main`; GitHub Actions builds + Render pulls the image. Ship new user-facing surfaces
   behind an OFF feature flag (epic #103) and toggle per-branch/PR or by rollout once verified.

## Change log

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
  lighthouse (5 tables, 23 routes), socketrelay (7 tables, 20 routes), trusttransport (13 tables, 20 routes),
  gentlepulse (4 tables, 6 routes), levelup (13 tables, 8 routes), trust (15 tables, 5 routes), unlock (5 tables,
  4 routes). Marked all 7 backends ✅. Detailed audit of remaining 6 plugins: peer-programming (7 tables, 6 routes,
  NO seed script), mood (1 table, 2 routes, NO seed), gdp (3 tables, 2 routes, NO seed), service-credits (15 tables,
  11 routes, NO seed), weekly-performance (3 tables, 5 routes, NO seed), clicklog (1 table, 2 routes, ✅ seed).
  Marked clicklog ✅, others 🟡 (schema+contracts+routes complete but missing deterministic seed scripts per 7-gate
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
