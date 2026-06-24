# Portable agent-instructions template

A project-agnostic starter so a **new repository** keeps the same writing voice and banned-term
dictionary without re-deriving them each time. It is distilled from this codebase's agent rules,
with every project-specific rule removed (design-pass gating, product/plugin rules, schema and
migration rules, continuous-integration conventions, and the like). What stays is the part that
should be identical in every repo: the plain-voice rule, the banned-term dictionary, and a few
general process rules.

## What's in this folder

| File | What it is |
|---|---|
| `AGENTS.md` | The instructions themselves. Copy into the new repo (as its `CLAUDE.md` or `AGENTS.md`). Ends with a placeholder for that repo's own rules. |
| `hooks/check-no-pleasantries.mjs` | The Stop hook that enforces the voice rule and the dictionary. This file is the canonical list. |
| `settings.example.json` | The `.claude/settings.json` snippet that registers the Stop hook. |

## Use it in a new repo

1. Copy `AGENTS.md` to the new repo's root as `CLAUDE.md` (or `AGENTS.md`).
2. Copy `hooks/check-no-pleasantries.mjs` to the new repo at `.claude/hooks/check-no-pleasantries.mjs`.
3. Register the Stop hook: merge `settings.example.json` into the new repo's `.claude/settings.json`
   (create the file if it does not exist). The command path is `node .claude/hooks/check-no-pleasantries.mjs`.
4. Fill in the `<PROJECT-SPECIFIC RULES>` section at the bottom of the copied `AGENTS.md` with that
   repo's own rules. Leave the voice, dictionary, and process sections above it unchanged.

That is enough for the dictionary to apply from the first session: the model reads `CLAUDE.md` at
startup, and the Stop hook blocks any reply that breaks the voice rule and asks for a plain restatement.

## Keeping the two copies in step

`AGENTS.md` documents the dictionary for humans; `hooks/check-no-pleasantries.mjs` enforces it. If you
add or remove a term, change both. When they disagree, the hook is the source of truth.

## What was left out on purpose

Project-specific rules are not carried here — see the "What this template deliberately leaves out"
section in `AGENTS.md` for the list. Add the ones a new repo needs under that file's placeholder.
