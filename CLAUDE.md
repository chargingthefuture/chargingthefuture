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

**Production-era policy (2026-06-05): the gate is for new surfaces, not iteration on shipped screens.** The app is live. Once a screen ships, the **running screen is the source of truth** — change it directly in code, no mockup round-trip, and do not keep a mockup byte-identical to it. The gate applies only to a **net-new** surface (a new page, modal, plugin, or featured surface that does not exist yet) **or a deliberate from-scratch redesign** of an existing one. For those, verify a design exists in the `design/` submodule (canonical source; remote: `https://github.com/chargingthefuture/design`); if none exists, **stop** and announce `DESIGN PASS REQUIRED` per `.github/instructions/127-design-pass-gating-rules.mdc`. Designs are produced in parallel by the Replit design agent; build non-UI foundation now and circle back for the UI once its design lands.

Iterate in code (NOT gated): any change to an already-shipped screen that doesn't introduce a fundamentally new layout — removing/hiding an element, copy, color, spacing, reordering, adding an empty/loading/error state, the mobile-responsive layout of a shipped screen, and all bug fixes. Also never gated: changes with no rendered surface — schema, libraries, server-only API routes, infra/CI, refactors, type/lint/test changes.

Owner-issued bypass keywords (must appear in the user's prompt): `bypass design`, `design done`, `hotfix`.

Full trigger conditions, checkpoint behavior, resume protocol, and worked examples: see `.github/instructions/127-design-pass-gating-rules.mdc`.
