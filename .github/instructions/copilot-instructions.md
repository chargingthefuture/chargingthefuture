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
- [200-plugin-command-contract-templates.mdc](200-plugin-command-contract-templates.mdc)
- [201-plugin-command-schema-template.mdc](201-plugin-command-schema-template.mdc)
- [202-plugin-access-policy-schema-template.mdc](202-plugin-access-policy-schema-template.mdc)
- [203-plugin-audit-schema-template.mdc](203-plugin-audit-schema-template.mdc)
- [014-compliance-rules-index.mdc](014-compliance-rules-index.mdc)

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

- Every migration that adds or changes a table or column MUST:
	- Use `CREATE TABLE IF NOT EXISTS ...` for new tables, listing all current columns.
	- Use `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS ...` for every new/changed column, even if the column is in the CREATE TABLE above.
	- This ensures both fresh DBs and legacy DBs are always brought up to date.
- When a table or column is renamed or removed, always use guarded DDL and provide data migration steps if needed.
- The file `ctf/migrations/ALL_MIGRATIONS_COMBINED.sql` MUST be kept in sync with all individual migrations, so a fresh DB is always correct.
- When creating a new table, always include both the full CREATE TABLE and ALTER TABLE for every column, even if redundant.
- When adding a new column, always add a new migration with ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
- When reviewing or updating old migrations, ensure all columns are present in both CREATE TABLE and ALTER TABLE blocks.
