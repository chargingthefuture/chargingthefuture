# CTF Production Readiness Plan (Web + Android)

> Living tracking doc for PR `claude/production-readiness-plan-op4lA`.
> Goal: bring every plugin, the full web app, and the Android app to production —
> pixel-perfect to the `design/` submodule and complete to each plugin's feature inventory.
> Companion infra work: PR #86 (Railway → Render migration).

## Locked strategic decisions (owner, 2026-05-20)

1. **Branch/PR:** All production-readiness code lands on `claude/production-readiness-plan-op4lA`
   with its own draft PR. PR #74 (design-audit) stays separate. This doc is the progress channel.
2. **Deploy target:** **Render**, deployed **incrementally**. PR #86's Render infra (Blueprint +
   per-service Dockerfiles) is merged into this branch as the foundation, then each plugin wave
   deploys to Render. No new Railway work; Railway is being retired (Formance + Ollama already
   removed by owner — web app was never wired to them).
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
| Deploy infra | `ctf/render.yaml` + per-service Dockerfiles (from PR #86) |

## Per-plugin production-readiness pipeline (the repeatable gate sequence)

Every plugin passes the same gates, run by one agent on an isolated worktree, then merged back:

1. **Spec read** — inventory + rewrite-checklist + contract YAMLs are the contract.
2. **Backend to spec** — schema (`CREATE/ALTER ... IF NOT EXISTS`), API routes under
   `app/api/<plugin>/`, command/access/audit/deletion contracts, deterministic seed script. No stub data.
3. **Web pixel-perfect** — shell matches `design/.../<Plugin>.tsx` + Empty/Loading/Public exactly
   (inline hex, 1px spacing, Inter scale). `// API:`-annotated values bind to real routes only.
4. **Android parity** — `Mobile<Plugin>*.tsx` → `packages/mobile/src/features/<plugin>`; update
   `plugin-parity-contracts.json`.
5. **Gates green** — `typecheck`, `build:ci`, `check-eof-format.sh`,
   `check-web-android-parity.mjs`, `check-schema-drift.sh`.
6. **Inventory sync** — update "Web and Android Delivery Status" + parity contract per CLAUDE.md drift policy.
7. **Deploy increment** — merge to branch; Render auto-deploys the wave.

## Execution waves (dependency order)

Per `ctf-plugin-implementation-order.md`. Agents run one plugin each on isolated worktrees;
shared files (`schema.sql`, `plugin-parity-contracts.json`, `repository.ts`) are reconciled by the
orchestrator at merge to avoid clobbering.

- **Phase F — Foundation (this session):** green build baseline + Render infra merged + reference plugin.
- **Phase 0 — Core primitives:** chyme, skills-taxonomy, directory, feed+announcements.
- **Phase 1 — Direct dependents:** workforce, skills-hunt, foundation.
- **Phase 2 — Independent surfaces:** lighthouse, socketrelay, trusttransport, peer-programming, mood, gentlepulse, weekly-performance.
- **Phase 3 — Finance/reporting:** gdp, service-credits.
- **Phase 4 — remaining + design-pending:** levelup, trust, then backend-now/UI-later for
  clicklog, unlock, community, skills-taxonomy, weekly-performance (UI circles back per design pass).

## Progress checklist

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⏳ design pending (parallel) · 🎨 design exists

| Plugin | 🎨 Design | Backend | Web px | Android | Gates | Deployed |
|---|---|---|---|---|---|---|
| chyme | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| skills-taxonomy | ⏳ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| directory | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| feed-announcements | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| workforce | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| skills-hunt | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| foundation | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| lighthouse | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| socketrelay | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| trusttransport | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| peer-programming | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| mood | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| gentlepulse | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| weekly-performance | ⏳ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| gdp | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| service-credits | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| levelup | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| trust | 🎨 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| clicklog | ⏳ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| unlock | ⏳ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| community | ⏳ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

For ⏳ rows: build backend now; UI (web + android) is gated on the parallel design pass — circle back when it lands.

Cross-cutting (non-plugin): Hub/Home shell (🎨 design exists), account, auth (Clerk), Sentry observability.

## Infra / deploy status (Render, via PR #86)

- [ ] Merge PR #86 Render Blueprint + Dockerfiles into this branch
- [ ] `render.yaml` validated (web, agent-mcp, pm-mcp, infisical services)
- [ ] Infisical → Render secret sync verified
- [ ] First successful Render deploy of `ctf-web`
- [ ] Sentry cron monitor (`workforce-incremental-sync`) green on Render

## How a future session / agent picks up work

1. `git -C design fetch && git submodule update --init design` (designs are the only UI source of truth).
2. Pick the next ⬜ plugin in the lowest open phase.
3. Run the 7-gate pipeline above on an isolated worktree.
4. Update this checklist + the plugin inventory's Delivery Status in the same commit.
5. Merge to `claude/production-readiness-plan-op4lA`; let Render deploy the increment.

## Change log

- 2026-05-20: Plan created; strategic decisions locked; design submodule confirmed populated
  (17 user-facing plugins have pixel-perfect desktop + mobile + 4-state mockups).
- 2026-05-20: Rule 127 updated — nothing is design-skippable; no admin/internal UI exemption.
  Design agent producing remaining mockups in parallel; agents build foundation now, circle back for UI.
