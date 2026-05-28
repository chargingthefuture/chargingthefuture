# Education Module

This package provides a modular, updatable, and optional educational component for all plugins in the CTF monorepo. Despite living alongside plugins in `packages/`, it is a shared library (consumed via `@ctf/education`), not a registered plugin.

## Features
- Loads educational content from Markdown with frontmatter (see `content/`)
- Presents content in a reusable React modal with skip/complete options
- Designed for easy integration into any plugin
- Content can be updated without code changes (just edit Markdown)

## Usage

1. **Add Markdown content**
   - Place a file like `eol.md` in the `content/` folder with frontmatter:
     ```markdown
     ---
     plugin: eol
     title: End-of-Life Planning: What & Why?
     lastUpdated: 2026-03-31
     ---
     # ...content...
     ```

2. **Import and use in your plugin**
   ```tsx
   import { EducationModal } from '@ctf/education';
   import { loadEducationContent } from '@ctf/education/content/loader';

   const content = loadEducationContent('eol');
   <EducationModal content={content} onSkip={...} onComplete={...} pluginName="eol" />
   ```

3. **Make educational content optional**
   - Always provide a "Skip" button and do not block plugin features if skipped.

## Updating Content
- Edit the relevant Markdown file in `content/`.
- No code changes or redeploys needed for content updates.

## Type Safety
- All types are defined in `types.ts`.

## Compliance
- Follows CTF monorepo modularity and typecheck rules.

---
For questions, see the main monorepo documentation or contact the maintainers.
