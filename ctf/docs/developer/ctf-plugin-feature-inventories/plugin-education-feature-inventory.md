# Plugin Education Module Feature Inventory

> **Note:** Plugin Education is a shared module/package (`@ctf/plugin-education` under `ctf/packages/plugin-education`) consumed by plugins for first-run educational content. It is not a registered plugin (no `/api/plugin-education/*` routes, no dedicated tables, no entry in `lib/plugins/repository.ts`). This file is retained as a non-plugin module inventory; Rule 120 plugin-required sections do not apply.

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

- Type safe (TypeScript schema)
- Follows CTF monorepo modularity and typecheck rules
- Documentation and usage in README

## Change Log

- 2026-05-18: Removed "Planned Features" section to comply with Rule 120 forbidden patterns. Added module-vs-plugin scope note; this file documents a shared library, not a registered plugin.
