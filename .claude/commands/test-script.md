---
description: Write or refresh a plugin's manual test script by hand — the no-credit route for the manual test script workflow.
---

Do the job of `.github/workflows/manual-test-script.yml` (`ctf/scripts/generateManualTestScript.mjs`)
from this session: write the human-runnable test script for one plugin. `$ARGUMENTS` names the
plugin slug (or several, space-separated); with `diff` it means every plugin touched by
`git diff origin/main...HEAD`. If it is empty, ask which plugin; do not regenerate all of them.

## 1. Read the sources

The plugin's row in `ctf/config/manual-test-script-manifest.json` gives its inventory, code folders,
visibility, roles and seed target. Read the inventory's "User Features", "Admin Features" and route
map, and list the plugin's routes and screens from its code folders. Read
`ctf/docs/developer/test-scripts/README.md` and one recent sibling script (for example the one
`git log` shows as most recently generated) and match its headings, step numbering and role and
surface tags exactly. Read the script's prompt in `generateManualTestScript.mjs`; it is your
instructions for what a step must contain.

## 2. Write the script

Write `ctf/docs/developer/test-scripts/<slug>-test-script.md`. Every step is something a person does
on a real phone and what they should see, tagged by role (member / admin) and surface (web, the
phone-width layout). Keep the "Core smoke" section concrete: the user guide generator reads it and
invents nothing when it is specific. Steps come from the inventory and the code, never from memory
of what a plugin like this usually does. Keep an existing script's reviewed wording where the
feature did not change.

## 3. Open the PR

Per `/br`: title `docs: refresh manual test script for <slug>`, the `Parity Status:` line,
auto-merge lane.

## 4. Report

One line: the plugin and the PR link.
