# Claude Code — Project Instructions

## Pull Request Requirements

Every PR created by this agent must satisfy all CI checks. These are enforced
automatically and will fail the PR if missing.

### PR Title — Conventional Commits (enforced by `pr-title-semantic.yml`)

Always prefix PR titles with a conventional commit type:

```
feat: <description>     — new feature or capability
fix: <description>      — bug fix
refactor: <description> — code restructure, no behaviour change
chore: <description>    — tooling, config, deps, devcontainer
ci: <description>       — GitHub Actions / CI changes
docs: <description>     — documentation only
perf: <description>     — performance improvement
test: <description>     — tests only
build: <description>    — build system changes
style: <description>    — formatting only
revert: <description>   — revert a previous commit
```

Examples:
- `feat: add Ollama chatbot integration to feed question answers`
- `fix: relabel question category syncs feed_items title`
- `ci: add pnpm install step to modularity-governance job`

### PR Description — Parity Status (enforced by `pr-parity-status` in `rewrite-ci.yml`)

Every PR description must include one of:

```
Parity Status: web+android complete
```
— use this when the change is either backend-only, web-only with no mobile
surface needed, or when both web and Android are fully implemented in this PR.

```
Parity Ticket: <GitHub issue URL or #issue-number>
```
— use this when Android parity is deferred; link to the tracking issue.

### PR Description Template

```markdown
## Summary
- <bullet describing what changed and why>

## Parity Status
Parity Status: web+android complete

## Test plan
- [ ] Web tested
- [ ] Android tested (if applicable)
```

## EOF Formatting (enforced by `formatting-eof` in `rewrite-ci.yml`)

All `.ts`, `.tsx`, `.js`, `.json`, `.yml`, `.yaml`, `.css` files must end with
exactly one newline character. No trailing blank lines. The CI script
`ctf/scripts/check-eof-format.sh` validates this on every PR.

When writing or editing files, always ensure they end with `\n`.

## Commit Messages

Use the same conventional commit format as PR titles. Include a blank line
between the subject and body. End with the session URL.

## File Modularity (enforced by `modularity-governance` in `rewrite-ci.yml`)

- Max 200 lines per function (excluding blanks and comments)
- Max cyclomatic complexity of 10 per function
- Checked via ESLint on all changed `packages/**/*.ts(x)` files
