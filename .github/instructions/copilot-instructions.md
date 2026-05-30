# Codespaces Environment Notice

- The primary development environment is GitHub Codespaces.
- All environment-type updates, additions, and tooling changes must be reflected in the devcontainer setup (e.g., .devcontainer/setup.sh, devcontainer.json) to ensure reproducibility and zero manual steps on container start.

## Search Tooling Policy

- Prefer `rg`/ripgrep for recursive text and file discovery.
- Keep grep fallback logic in scripts and prompts where search commands are demonstrated.
- Use this portable shell pattern when needed:
  - `if command -v rg >/dev/null 2>&1; then rg -n "pattern" path; else grep -RIn "pattern" path; fi`

## Task Planning — No Phases (Critical)

Do **not** organize work into "phases." No "Phase 0 / Phase 1 / Phase 2", no "Phase F", no
phased-rollout buckets — anywhere: plans, inventories, checklists, design artifacts, mockups, code
comments, PR descriptions, or commit messages. Phases confuse humans and agents and have been
hard-coded into design mockups by mistake.

Instead, when given an objective, break it into discrete tasks and **list them one after another in
the order they must happen**. Where order matters, state it as an explicit blocking dependency, not a
phase:

- ✅ "Task B is blocked by Task A — do A first."
- ✅ A flat, ordered, numbered task list (1, 2, 3 …) where each item may name what it depends on.
- ❌ "Phase 1: …", "Phase 2: …", "do this in a later phase."

A task with no dependency can be done at any time or in parallel; say so plainly ("no dependencies;
can run anytime"). Reserve the word "phase" only for fixed product-maturity terms already in the
rules (e.g. "MVP", "post-MVP hardening") — never as a unit of work breakdown.

# Product Rules Index

## Scope

- Applies to the v3 web/Android product under `ctf/`.
- The `/platform` folder is strictly for reference-only during migration and must never be referenced, deployed, or used for routing or domain configuration unless explicitly requested.
- Governs architecture, coding standards, delivery quality, and compliance.

## App Versioning and Repository Policy

- This is **v3** of the app. The legacy app has been removed; the codebase under `ctf/` is the
  single, mature product. Do not describe it as "the rewrite" — that label has lost its meaning now
  that there is only one app. Prefer "the v3 app" or just "the app".
- **No new repositories.** Going forward, ship changes as app versions only — `v3.0.1`, `v3.1.0`,
  `v3.1.1`, etc. (semver under the `v3` major). Do not propose or create a new repo for a "v4" or a
  fresh rewrite; increment the version instead.
- Note: the CI workflow was renamed `rewrite-ci.yml` → `ci.yml` during the Render migration (PRs
  #98–#117 on `main`); its jobs (`pr-parity-status`, `formatting-eof`, `schema-drift-gate`, etc.) are
  unchanged. The package name still retains the historical name for stability; do not rename it without
  an explicit instruction.


## Product Rule Modules

- [099-agent-scope-guardrails.mdc](099-agent-scope-guardrails.mdc)
- [100-product-context-and-experience-rules.mdc](100-product-context-and-experience-rules.mdc)
- [101-monorepo-layout-rules.mdc](101-monorepo-layout-rules.mdc)
- [102-shared-boundary-rules.mdc](102-shared-boundary-rules.mdc)
- [103-web-nextjs-structure-rules.mdc](103-web-nextjs-structure-rules.mdc)
- [104-mobile-react-native-android-rules.mdc](104-mobile-react-native-android-rules.mdc)
- [105-web-android-feature-parity-rules.mdc](105-web-android-feature-parity-rules.mdc)
- [106-expo-eas-mobile-workflow-rules.mdc](106-expo-eas-mobile-workflow-rules.mdc)
- [107-integration-stack-rules.mdc](107-integration-stack-rules.mdc)
- [108-observability-provider-abstraction-rules.mdc](108-observability-provider-abstraction-rules.mdc)
- [109-sentry-implementation-rules.mdc](109-sentry-implementation-rules.mdc)
- [110-stream-maker-tier-rules.mdc](110-stream-maker-tier-rules.mdc)
- [112-platform-architecture-rules.mdc](112-platform-architecture-rules.mdc)
- [113-platform-coding-rules.mdc](113-platform-coding-rules.mdc)
- [114-single-profile-and-plugin-extension-rules.mdc](114-single-profile-and-plugin-extension-rules.mdc)
- [115-neon-migration-delivery-rules.mdc](115-neon-migration-delivery-rules.mdc)
- [116-file-size-and-modularity-rules.mdc](116-file-size-and-modularity-rules.mdc)
- [117-agent-readability-and-cost-rules.mdc](117-agent-readability-and-cost-rules.mdc)
- [118-platform-testing-and-release-rules.mdc](118-platform-testing-and-release-rules.mdc)
- [119-github-actions-ci-rules.mdc](119-github-actions-ci-rules.mdc)
- [120-plugin-feature-inventory-lifecycle-rules.mdc](120-plugin-feature-inventory-lifecycle-rules.mdc)
- [121-canonical-metric-registry-rules.mdc](121-canonical-metric-registry-rules.mdc)
- [122-schema-drift-predeployment-rules.mdc](122-schema-drift-predeployment-rules.mdc)
- [123-environment-configuration-rules.mdc](123-environment-configuration-rules.mdc)
- [124-brand-voice-and-language-rules.mdc](124-brand-voice-and-language-rules.mdc)
- [125-railway-mcp-debugging-rules.mdc](125-railway-mcp-debugging-rules.mdc)
- [126-design-mockup-implementation-rules.mdc](126-design-mockup-implementation-rules.mdc)
- [127-design-pass-gating-rules.mdc](127-design-pass-gating-rules.mdc)
- [128-design-sync-workflow-rules.mdc](128-design-sync-workflow-rules.mdc)
- [200-plugin-command-contract-templates.mdc](200-plugin-command-contract-templates.mdc)
- [201-plugin-command-schema-template.mdc](201-plugin-command-schema-template.mdc)
- [202-plugin-access-policy-schema-template.mdc](202-plugin-access-policy-schema-template.mdc)
- [203-plugin-audit-schema-template.mdc](203-plugin-audit-schema-template.mdc)
- [014-compliance-rules-index.mdc](014-compliance-rules-index.mdc)

# Supabase Instructions

- For any Supabase-related development, always consult the `/github/instructions/supabase/` folder for the latest rules and best practices.
- Supabase is ONLY to be used for document storage at this time. Do not use Supabase for authentication, user profiles, or any other features unless explicitly authorized in future instructions.

## Precedence

1. Product safety/compliance constraints
2. Environment configuration rules (integral to Clerk auth functioning)
3. Monorepo and boundary rules
4. Platform architecture rules
5. Platform coding rules
6. Testing and release rules
7. GitHub Actions CI rules
8. Plugin feature rules

If two rules conflict, choose the stricter rule and document the decision.

## Pull Request Conventions (enforced by CI — applies to all agents)

### PR Title — Conventional Commits (`pr-title-semantic.yml`)

Every PR title must start with one of these prefixes:

| Prefix | Use for |
|---|---|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `refactor:` | Code restructure, no behaviour change |
| `chore:` | Tooling, config, deps, devcontainer |
| `ci:` | GitHub Actions / CI workflow changes |
| `docs:` | Documentation only |
| `perf:` | Performance improvement |
| `test:` | Tests only |
| `build:` | Build system changes |
| `style:` | Formatting only |
| `revert:` | Revert a previous commit |

Example: `feat: add Ollama chatbot integration to feed question answers`

### PR Description — Parity Status (`pr-parity-status` in `ci.yml`)

Every PR description must include one of:

```
Parity Status: web+android complete
```
Use when the change is backend-only, infrastructure, or both web and Android are implemented in this PR.

```
Parity Ticket: <GitHub issue URL or #issue-number>
```
Use when Android parity is deferred; link to the tracking issue.

### EOF Formatting (`formatting-eof` in `ci.yml`)

All `.ts`, `.tsx`, `.js`, `.json`, `.yml`, `.yaml`, `.css` files must end with exactly one newline and no trailing blank lines. Validated by `ctf/scripts/check-eof-format.sh` on every PR.

### CodeRabbit Review Labeling (self-triage)

CodeRabbit auto-review is gated on the `coderabbit` label (see `.coderabbit.yaml`), and the
account is on the **free tier**, so reviews are a scarce resource. Agents self-triage and apply the
label **only when the change is genuinely complex/risky**, and **no more than once per hour**.

- **Label `coderabbit`** when the PR touches any of: money / ServiceCredits ledger, auth/authz, CSRF,
  data deletion, schema / migrations, new or changed API contracts, or brand-new stateful logic / a
  whole new plugin.
- **Do NOT label** pure restyles, rule-116 decompositions, icon swaps, or doc-sync PRs with **no
  behavior change** — these are low-risk and waste the quota.
- **Rate cap:** at most **one labeled PR per hour**. If several qualify in the same hour, label only
  the riskiest and defer the rest to the next hour.
- Apply the label via the GitHub MCP (`issue_write`) right after opening the PR. To force a one-off
  review on an unlabeled PR, comment `@coderabbitai review` instead of labeling.

### Updating `PRODUCTION_READINESS_PLAN.md` (avoid change-log merge conflicts)

When several plugin PRs are open at once, all appending narrative to the **same** change-log section
of `ctf/docs/developer/PRODUCTION_READINESS_PLAN.md` produces a merge conflict every time a sibling
merges first. To avoid this:

- In `PRODUCTION_READINESS_PLAN.md`, a per-plugin PR should **only flip that plugin's row** in the
  progress table (the row is the single source of truth for delivery status). Do **not** append a
  per-PR change-log entry there.
- Put the detailed change-log narrative in that plugin's **own inventory file**
  (`ctf/docs/developer/ctf-plugin-feature-inventories/ctf-<plugin>-feature-inventory.md`), which is
  one file per plugin and therefore never collides with sibling PRs.
- Reserve the plan's change-log section for cross-cutting milestones (infra, policy, multi-plugin
  reconciliations), not routine per-plugin passes.

## Agent Startup Read Order

- On each new task, read this `index.mdc` first.
- Then read directly relevant modules before editing code (architecture, coding, testing/release, and domain-specific rules).
- For user-facing copy changes, read `124-brand-voice-and-language-rules.mdc` and `ctf/docs/BRAND_VOICE_LEXICON.md` before editing content.
- For modularity governance checks, consult `116-file-size-and-modularity-rules.mdc`, including responsibility boundaries and complexity indicators.
- When unclear, prefer broader safety/compliance and boundary rules over feature-level rules.

## CTF Contract

## Security and Secrets Policy (Critical)

**This is an open source repository.** Everything committed to this codebase is publicly visible. Never expose secrets, credentials, API keys, encryption keys, tokens, or any sensitive information through:

- **Code commits** — no secrets hardcoded or in examples
- **GitHub Actions logs/stdout** — no auto-generated secrets printed to console
- **Job summaries or outputs** — no sensitive values in workflow summaries
- **Documentation or comments** — no example credentials or keys
- **Error messages or debugging output** — scrub sensitive info from error handling

**Correct pattern for secrets:**
1. User generates secrets locally (e.g., `openssl rand -hex 16` in a terminal)
2. User stores them securely as GitHub repository secrets
3. Workflows pass them to scripts as masked environment variables
4. Scripts consume them but never print or output them
5. Error messages that fail validation refer users to the generation command, not the secret itself

**If a secret is ever exposed** (even locally in logs or momentarily in a PR):
- Rotate it immediately via the GitHub Actions secrets UI or service dashboard
- Do not commit the exposed value to the repo

This applies to all development: deploy scripts, CI/CD workflows, seed scripts, test fixtures, and any infrastructure code.

## Local Build and Error Checking Requirement

- After every code change, always run the local build (e.g., `pnpm build` or project-specific build command) and check for errors.
- If any errors are found, fix them before marking the work as complete.
- This is mandatory to prevent pushing broken code, especially for users without local development environments.

## Database Migration Best Practices (REQUIRED)

  - Use `CREATE TABLE IF NOT EXISTS ...` for new tables, listing all current columns.
  - Use `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS ...` for every new/changed column, even if the column is in the CREATE TABLE above.
  - This ensures both fresh DBs and legacy DBs are always brought up to date.


## TypeScript Type Safety Policy (Critical)
- This policy is mandatory and must be enforced by all agents and contributors.

### Explicit Type Safety Rules
- If a legitimate exception to these rules is required (e.g., third-party library limitation), use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with an explanatory comment and a TODO to revisit.


## Plugin Feature Inventory Sync Policy (Critical)

All code changes to plugin routes, database schema, contracts, or seed scripts MUST be accompanied by corresponding updates to the plugin's feature inventory markdown file. This prevents drift between code state and documentation, ensuring feature inventories remain authoritative sources of truth for plugin capabilities, data models, and delivery status.

### Drift Vectors and Required Updates

When making code changes, consult this table to identify which inventory section(s) must be updated:

| Code Change Type | Location | Affected Inventory Section | Required Update |
|---|---|---|---|
| **Add/modify/remove API endpoint** | `ctf/packages/web/app/api/{plugin}/**/route.ts` | API Surface and Route Map | Add/update/remove route from list; update description, HTTP method, and parameters |
| **Add/modify endpoint contract** | `ctf/docs/contracts/{PLUGIN}_PLUGIN_COMMAND_CONTRACTS.yaml` | Security, Privacy, and Compliance Controls | Update command definition, input/output schemas, validation rules |
| **Add/modify access policy** | `ctf/docs/contracts/{PLUGIN}_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml` | Security, Privacy, and Compliance Controls | Update role requirements, approval gates, auth enforcement |
| **Add/modify deletion behavior** | `ctf/docs/contracts/{PLUGIN}_PROFILE_AND_DELETION_CONTRACT.md` | Security, Privacy, and Compliance Controls | Update which tables/columns are deleted on service/profile deletion |
| **Create new database table** | `ctf/schema.sql` (CREATE TABLE block) | Data Model and Storage Contracts | Add table to list; document primary key, constraints, indexes; update seed coverage status |
| **Add/remove database column** | `ctf/schema.sql` (ALTER TABLE block) | Data Model and Storage Contracts | Add/remove column from list; document type, constraints, default value |
| **Modify column constraints/type** | `ctf/schema.sql` | Data Model and Storage Contracts | Update column definition; document breaking changes and migration impact |
| **Add/modify seed script** | `ctf/scripts/seed{PluginName}Phase0.mjs` | Seed Coverage Status | Update what data is seeded; note any new columns/tables; document deterministic UUIDs |
| **Add mobile feature** | `ctf/packages/mobile/src/features/{plugin}/**` | Web and Android Delivery Status; Mobile Parity Contracts | Update delivery status; create/update `ctf/config/plugin-parity-contracts.json` entry; update milestone dates |
| **Remove/deprecate feature** | Web or mobile package | Web and Android Delivery Status; Target User Features | Move feature to changelog section; update milestone dates; document deprecation reason |
| **Create entirely new plugin** | Full stack (see below) | All sections | See new plugin checklist below |

### New Plugin Lifecycle Checklist

When creating a new plugin from scratch, ALL of the following must be completed before PR approval:

1. **Inventory File** (single combined document — see [120-plugin-feature-inventory-lifecycle-rules.mdc](120-plugin-feature-inventory-lifecycle-rules.mdc))
   - Create `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-{plugin-slug}-feature-inventory.md` with all required sections (Scope & Boundary, Intent, Target User Features, Target Admin Features, API Surface and Route Map, Data Model and Storage Contracts, Security/Privacy/Compliance Controls, Web and Android Delivery Status, Seed Coverage Status, Gaps & Known Technical Debt, Change Log)
   - Include a `## Build Checklist` section in that same file: an ordered, dependency-based task list (no phases). There is no separate checklist file.

2. **Schema & Migrations**
   - Add all plugin tables to `ctf/schema.sql` using `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` pattern
   - Document all tables and columns in inventory "Data Model and Storage Contracts" section

3. **Contract Files**
   - Create `ctf/docs/contracts/{PLUGIN}_PLUGIN_COMMAND_CONTRACTS.yaml` with all command definitions and dataAccess lists
   - Create `ctf/docs/contracts/{PLUGIN}_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml` with role-based access controls
   - Create `ctf/docs/contracts/{PLUGIN}_PROFILE_AND_DELETION_CONTRACT.md` with deletion scopes and data retention policy (if applicable)
   - Create `ctf/docs/contracts/{PLUGIN}_PLUGIN_AUDIT_CONTRACTS.yaml` with audit events (if applicable)

4. **Seed Script**
   - Create `ctf/scripts/seed{PluginName}Phase0.mjs` that populates all tables with deterministic seeding
   - Document in inventory "Seed Coverage Status" section

5. **API Routes**
   - Create all API endpoints under `ctf/packages/web/app/api/{plugin}/`
   - Document in inventory "API Surface and Route Map" section
   - Add corresponding command contracts

6. **Web Shell/UI**
   - Create React component shell at `ctf/packages/web/components/{plugin}/{plugin}-shell.tsx` or equivalent
   - Add route entry at `ctf/packages/web/app/apps/{plugin}/page.tsx`

7. **Mobile Feature (if applicable)**
   - Create feature directory at `ctf/packages/mobile/src/features/{plugin}/`
   - Create API client at `ctf/packages/mobile/src/features/{plugin}/{Plugin}Api.ts`
   - Update `ctf/config/plugin-parity-contracts.json` with parity entry
   - Update `ctf/packages/web/lib/plugins/repository.ts` registry entry

8. **Plugin Registry**
   - Add entry to `ctf/packages/web/lib/plugins/repository.ts` with slug, name, summary, availability state, nav rank

### Enforcement

**PR Review Gate**: 
- No PR can be approved if inventory file(s) are not updated to match all code changes
- For plugin modifications: inventory sections must reflect current code state (routes, schema, contracts, status)
- For new plugins: all inventory sections must be populated per the New Plugin Lifecycle Checklist

**Agent Responsibility**:
- Before submitting a PR, agents MUST verify:
  1. All modified code artifacts (routes, schema, contracts) have corresponding inventory updates
  2. Inventory section content matches actual code (e.g., route list is complete and accurate)
  3. If unsure which sections need updating, see "Drift Vectors" table above
- Treat missing or out-of-sync inventory updates as blockers (same as TypeScript errors)

**Cross-References**:
- Related rules: [120-plugin-feature-inventory-lifecycle-rules.mdc](120-plugin-feature-inventory-lifecycle-rules.mdc) (naming/folder structure), [122-schema-drift-predeployment-rules.mdc](122-schema-drift-predeployment-rules.mdc) (schema drift detection)
- Inventory template examples: [ctf/docs/developer/ctf-plugin-feature-inventories/](../docs/developer/ctf-plugin-feature-inventories/)

### Future Automation Opportunity

In the future, a nightly cron job (`0 0 * * * check-inventory-drift.sh`) could:
- Compare API routes in code against inventory "API Surface and Route Map" section
- Validate all schema.sql tables are documented in inventory "Data Model and Storage Contracts"
- Verify contract YAML definitions match inventory "Security, Privacy, and Compliance Controls"
- Create GitHub issues for detected drift (with PR suggestions for manual review)

For now, enforcement is manual via PR review gate. Automation can be added later if manual enforcement is insufficient.
