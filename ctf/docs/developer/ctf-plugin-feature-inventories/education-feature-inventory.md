# Education Module Feature Inventory

> **Note:** Education is a shared module/package (`@ctf/education` under `ctf/packages/education`) consumed by plugins for first-run educational content. It is not a registered plugin (no `/api/education/*` routes, no dedicated tables, no entry in `lib/plugins/repository.ts`). This file is retained as a non-plugin module inventory; Rule 120 plugin-required sections do not apply.

## Core Features

- Modular, updatable educational content system for all plugins
- Loads content from Markdown with frontmatter
- Reusable React modal with skip/complete options
- Analytics-ready (track skip/complete if needed)

## Integration

- Consumed by EOL and other plugin surfaces
- Content is always optional/skippable
- Content can be updated without code changes

## Compliance

- Type safe (TypeScript types in `types.ts`)
- Follows CTF monorepo modularity and typecheck rules
- Documentation and usage in README

## Change Log

- 2026-05-18: Removed "Planned Features" section to comply with Rule 120 forbidden patterns. Added module-vs-plugin scope note; this file documents a shared library, not a registered plugin.
- 2026-05-19: Renamed package `@ctf/plugin-education` → `@ctf/education`; renamed directory `ctf/packages/plugin-education` → `ctf/packages/education`; renamed inventory file from `plugin-education-feature-inventory.md` → `education-feature-inventory.md` to remove confusing `plugin-` prefix from a non-plugin shared module. Also renamed internal `schema.ts` → `types.ts` since the file holds TypeScript interfaces for educational content (not a DB schema); the prior name false-tripped the `Schema Drift Gate` keyword scanner.
