# EOL Module Feature Inventory

> **Note:** EOL is a shared module/package (`@ctf/eol` under `ctf/packages/eol`) consumed by plugins for end-of-life workflows. It is not a registered plugin (no `/api/eol/*` routes, no `eol_*` tables, no entry in `lib/plugins/repository.ts`). This file is retained as a non-plugin module inventory; Rule 120 plugin-required sections do not apply.

## Core Features

- Modular educational component (optional, updatable)
- Step-by-step wizard for basic will/testament creation (MVP)
- Review and summary before finalization
- Export/print instructions (no storage yet)
- Legal disclaimers and trauma-informed UX

## Compliance & Safety

- All flows trauma-informed and privacy-first
- Clear legal disclaimers and warnings
- No data storage; the will is local-only (print/export). The earlier Supabase
  document-storage integration was removed and is not yet replaced.

## Documentation

- README with usage and compliance notes
- Legal and trauma-informed design notes

## Educational Module Integration

- Uses shared `@ctf/education` system
- Content in Markdown, updatable without code changes
- Always skippable, never blocks access to main features

## Change Log

- 2026-05-18: Removed "Planned Features" section to comply with Rule 120 forbidden patterns. Added module-vs-plugin scope note; this file documents a shared library, not a registered plugin.
- 2026-06-23: Removed the Supabase document-storage integration (`supabase-client.ts`, `save-to-supabase.ts`, and the "Save to Supabase" call in `index.tsx`) as part of removing all Supabase usage. The will is now local-only (print/export); persistence is not yet replaced.
