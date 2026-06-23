@.github/instructions/copilot-instructions.md

## Claude-specific

Commit messages must end with the active session URL on its own line:

```
https://claude.ai/code/session_<id>
```

## Voice — no pleasantries, no feelings (Critical — every reply, all agents)

Do not address the user with thanks, apologies, congratulations, well-wishes, encouragement, or
closing sign-offs. Do not use first-person feeling words (e.g. glad, happy, excited, delighted,
sorry, "hope this helps", "I appreciate"). You have no feelings; do not perform them. No jargon, no
buzzwords. State the result or the next step in plain words, then stop. This is enforced by the Stop
hook `.claude/hooks/check-no-pleasantries.mjs`, which blocks a reply that contains a banned term and
asks for a plain restatement.

### Banned-term dictionary (every reply, all agents)

The Stop hook `.claude/hooks/check-no-pleasantries.mjs` holds the canonical list and is the source of
truth; if this copy and the hook ever differ, the hook wins. Keep the two in sync — when you change
one, change the other. The hook scans the whole reply and matches the term even inside quotes, so do
not reach for a banned word even to talk about it; use the replacement below instead.

**Pleasantries, feelings, and sign-offs — never use any of these (in any reply):**

- thanks / thank you
- you're welcome / you are welcome
- no problem
- my pleasure
- glad
- happy to
- excited
- delighted
- sorry
- apology / apologies / apologize / apologise (any form)
- cheers
- congrats / congratulations
- "I appreciate" / "we appreciate" (only the first-person form is banned; "the rate appreciates" is fine)
- "hope this / hope that / hope you / hope it …"
- feel free
- warm / best / kind / kindest regards
- looking forward

**Excluded vocabulary — banned word → use instead:**

- flywheel → a plain description of the loop (e.g. "each answer improves the next")
- punch list → list
- stale → drop the word; if you mean something specific, name it (out-of-date, superseded, no longer current)
- console → dashboard (the code identifiers `console.log` / `console.error` / `console.info` are exempt)

When the hook blocks a reply, restate the result in plain, factual language — none of the terms above,
no jargon, no first-person feeling words — then stop.

## Design Pass Gating (Critical — Read Before Touching UI)

**Production-era policy (owner-directed, 2026-06-17): production is the single source of truth; the design gate is loosened; the design repo and Replit design agent are deprecated.** We no longer maintain two design versions. Do **not** stop for a design pass, do **not** require a mockup in the `design/` submodule before building UI, and do **not** announce `DESIGN PASS REQUIRED`. The `design/` submodule and `ctf/agents/design.agent.md` are **reference/inspiration only** (design guide, tokens, component patterns) — not authoritative, not synced.

- **New surface?** Build it yourself, following (in order): the design guide / design system, the look and structure of already-shipped sibling screens, and the plugin inventory. Cover the real states (loading/empty/error/populated) and the mobile-responsive layout; keep it consistent with shipped screens.
- **Hard guardrail (critical): never overwrite approved production design or copy without explicit owner approval.** When a task is to add or fix something, be additive/surgical — change only what the task requires and leave surrounding shipped copy/layout exactly as it ships. Production wins over any old `design/` mockup; never "restore" a screen to a stale mockup. If you think shipped copy/design is wrong, surface it to the owner and get approval before changing it.

Iterate in code (NOT gated): any change to an already-shipped screen — copy, color, spacing, reordering, an empty/loading/error state, the mobile-responsive layout, bug fixes — within the guardrail above. Never gated: changes with no rendered surface — schema, libraries, server-only API routes, infra/CI, refactors, type/lint/test changes.

Bypass keywords still work but are no longer required to build a new surface: `bypass design`, `design done`, `hotfix`.

Full policy, the deprecated stop-for-design machinery (history), and worked examples: see `.github/instructions/127-design-pass-gating-rules.mdc`.
