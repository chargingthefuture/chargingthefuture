@.github/instructions/copilot-instructions.md

## Claude-specific

Commit messages must end with the active session URL on its own line:

```
https://claude.ai/code/session_<id>
```

## Design Pass Gating (Critical — Read Before Touching UI)

Before writing any user-facing UI for a new page, modal, plugin, featured surface, or material layout/IA change, you **must** verify a design exists in the `design/` submodule (canonical source; the only authoritative design location, remote: `https://github.com/chargingthefuture/design`). If no design exists for the feature, you **must** stop and announce `DESIGN PASS REQUIRED` per the protocol in `.github/instructions/127-design-pass-gating-rules.mdc`.

Skippable: schema, libraries, API-only routes, admin-internal tooling, infra/CI, bug fixes, refactors, type/lint/test changes.

Owner-issued bypass keywords (must appear in the user's prompt): `bypass design`, `design done`, `hotfix`.

Full trigger conditions, checkpoint behavior, resume protocol, and worked examples: see `.github/instructions/127-design-pass-gating-rules.mdc`.
