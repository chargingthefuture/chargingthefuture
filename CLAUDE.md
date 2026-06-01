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

## Design Pass Gating (Critical — Read Before Touching UI)

Before writing any UI — user-facing **or** admin/internal — for a new page, modal, plugin, featured surface, or material layout/IA change, you **must** verify a design exists in the `design/` submodule (canonical source; the only authoritative design location, remote: `https://github.com/chargingthefuture/design`). If no design exists for the feature, you **must** stop and announce `DESIGN PASS REQUIRED` per the protocol in `.github/instructions/127-design-pass-gating-rules.mdc`. No UI surface is skippable. Designs are produced in parallel by the Replit design agent; build non-UI foundation now and circle back for the UI once its design lands.

The gate only fails to apply to changes with no rendered surface: schema, libraries, server-only API routes, infra/CI, bug fixes, refactors, type/lint/test changes.

Owner-issued bypass keywords (must appear in the user's prompt): `bypass design`, `design done`, `hotfix`.

Full trigger conditions, checkpoint behavior, resume protocol, and worked examples: see `.github/instructions/127-design-pass-gating-rules.mdc`.
