---
description: Regenerate the public user guide by hand from the plugin inventories — the no-credit route for the user guide workflow.
---

Do the job of `.github/workflows/generate-user-guide.yml` (`ctf/scripts/generate-user-guide.mjs`)
from this session. That script has a model rewrite each app's section from its inventory and test
script; you write the sections instead, and the script renders the markdown copy from your JSON so
the two never drift. `$ARGUMENTS` may name one or more plugin slugs; if it is empty, refresh every
section whose source documents changed since its `updated` date.

The guide is public (`/guide`). Never paste raw inventory text into it; it is written for
developers and once shipped as an ungrounded dump. Every sentence is in plain member-facing words.

## 1. Find the sections to refresh

Read the `ORDER` list in `ctf/scripts/generate-user-guide.mjs` for the slug, title and sources of
each section, and `ctf/packages/web/app/guide/guide-content.json` for the current text. A section
needs refreshing when its inventory (`ctf/docs/developer/ctf-plugin-feature-inventories/ctf-<slug>-feature-inventory.md`)
or its test script (`ctf/docs/developer/test-scripts/<slug>-test-script.md`) has a commit newer
than the section's `updated` date (`git log -1 --format=%cs -- <file>`).

## 2. Write each section

Read the script's system prompt (`GROUNDING`, `VOICE`) and user prompt; they are your instructions.
Ground each section in exactly three blocks and nothing else: the inventory's "Intent and Outcome"
statement (framing only, never copied), its "User Features" section, and the test script's "Core
smoke" steps. Produce `summary` (one plain sentence), `body` (1 to 3 short paragraphs) and `howTo`
(2 to 4 plain steps, or none). Set the section's `updated` to today.

## 3. Render and open the PR

Edit the sections in `guide-content.json` in place (keep the `intro` and the order), then run
`USER_GUIDE_RENDER_ONLY=1 node ctf/scripts/generate-user-guide.mjs` from `ctf/` to rebuild
`ctf/docs/USER_GUIDE.md`. The script rewrites the JSON with two-space indentation; that is expected.
Open the PR per `/br`: title `docs: refresh user guide from plugin docs`, the `Parity Status:` line,
auto-merge lane.

## 4. Report

One line: which sections changed and the PR link.
