# Codespaces Environment Notice

- The primary development environment is GitHub Codespaces.
- All environment-type updates, additions, and tooling changes must be reflected in the devcontainer setup (e.g., .devcontainer/setup.sh, devcontainer.json) to ensure reproducibility and zero manual steps on container start.

## Search Tooling Policy

- Prefer `rg`/ripgrep for recursive text and file discovery.
- Keep grep fallback logic in scripts and prompts where search commands are demonstrated.
- Use this portable shell pattern when needed:
  - `if command -v rg >/dev/null 2>&1; then rg -n "pattern" path; else grep -RIn "pattern" path; fi`

# Product Rules Index

## Scope

- Applies to the rewrite web/Android product under `ctf/`.
- The `/platform` folder is strictly for reference-only during migration and must never be referenced, deployed, or used for routing or domain configuration unless explicitly requested.
- Governs architecture, coding standards, delivery quality, and compliance.


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
- [111-deployment-topology-rules.mdc](111-deployment-topology-rules.mdc)
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

### PR Description — Parity Status (`pr-parity-status` in `rewrite-ci.yml`)

Every PR description must include one of:

```
Parity Status: web+android complete
```
Use when the change is backend-only, infrastructure, or both web and Android are implemented in this PR.

```
Parity Ticket: <GitHub issue URL or #issue-number>
```
Use when Android parity is deferred; link to the tracking issue.

### EOF Formatting (`formatting-eof` in `rewrite-ci.yml`)

All `.ts`, `.tsx`, `.js`, `.json`, `.yml`, `.yaml`, `.css` files must end with exactly one newline and no trailing blank lines. Validated by `ctf/scripts/check-eof-format.sh` on every PR.

## Agent Startup Read Order

- On each new task, read this `index.mdc` first.
- Then read directly relevant modules before editing code (architecture, coding, testing/release, and domain-specific rules).
- For user-facing copy changes, read `124-brand-voice-and-language-rules.mdc` and `ctf/docs/BRAND_VOICE_LEXICON.md` before editing content.
- For modularity governance checks, consult `116-file-size-and-modularity-rules.mdc`, including responsibility boundaries and complexity indicators.
- When unclear, prefer broader safety/compliance and boundary rules over feature-level rules.

## CTF Contract

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
| **Remove/deprecate feature** | Web or mobile package | Web and Android Delivery Status; Target User Features | Move feature to changelog section; update phase/milestone dates; document deprecation reason |
| **Create entirely new plugin** | Full stack (see below) | All sections | See new plugin checklist below |

### New Plugin Lifecycle Checklist

When creating a new plugin from scratch, ALL of the following must be completed before PR approval:

1. **Inventory Files**
   - Create `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-{plugin-slug}-feature-inventory.md` with all 10 required sections (Scope & Boundary, Intent, Target User Features, Target Admin Features, API Surface and Route Map, Data Model and Storage Contracts, Security/Privacy/Compliance Controls, Web and Android Delivery Status, Seed Coverage Status, Risks & Known Technical Debt)
   - Create `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-{plugin-slug}-rewrite-checklist.md` with implementation phases

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
