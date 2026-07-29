# Agent Home — Charging The Future

This file is the single source of agent instructions for this repo. Read it first. Non-Claude
tools and humans: start here too — `AGENTS.md` only points back to this file.

The numbered rule modules live in `.claude/rules/` (e.g. `.claude/rules/119-github-actions-ci-rules.mdc`).
The "Product Rule Modules" list below links every module; the compliance modules (`001`–`013`,
`099-rule-authoring-and-change-control.mdc`) are listed in `.claude/rules/014-compliance-rules-index.mdc`.

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

Full policy, the deprecated stop-for-design machinery (history), and worked examples: see `.claude/rules/127-design-pass-gating-rules.mdc`.

# Monorepo Layout

```
chargingthefuture/          ← repo root
├── ctf/                    ← main product (Next.js web + React Native mobile)
│   ├── packages/
│   │   ├── web/            ← Next.js app (@ctf/web)
│   │   ├── mobile/         ← React Native / Expo app (@ctf/mobile)
│   │   ├── shared/         ← shared types, contracts, utilities
│   │   ├── education/
│   │   ├── economic-models/
│   │   └── eol/
│   ├── scripts/            ← operational helpers (migrations, audits, seeds)
│   ├── docs/               ← architecture docs, quota impact notes, setup guides
│   └── package.json        ← workspace root (pnpm)
├── landing-page/           ← marketing landing page
├── waitlist-landing-page/  ← waitlist page
├── wiki-site/              ← wiki/blog
├── .devcontainer/
│   └── devcontainer.json   ← dev container config
├── .github/
│   └── workflows/          ← GitHub Actions CI/CD
├── .claude/
│   └── rules/              ← agent rule modules (001–203 series)
├── CLAUDE.md               ← this file (agent home / index)
└── AGENTS.md               ← short pointer back to this file
```

**Package manager:** `pnpm` everywhere. Use `pnpm --filter @ctf/web` to scope commands.

**Do not** create app code outside `ctf/packages/*`. Scripts go in `ctf/scripts/`.

## Credits Are Not Money (Critical — all agents)

ServiceCredits and every in-app credit are a **non-fiat internal credits unit** — not money, not
cash, not a currency, not a security, and never redeemable or withdrawable for fiat value. Never
describe credits in money terms anywhere (code, comments, docs, UI copy, PR/commit text, posts); a
credit movement is a "send", "transfer", or "exchange", not a "payment". Real fiat amounts
unrelated to credits (e.g. a LightHouse listing's actual rent, Contributions' confirmed USD
donations) are real money and are described as such. The committed statement of record is
`ctf/docs/DISCLAIMER.md`; the approved phrasing lives in `ctf/docs/BRAND_VOICE_LEXICON.md`. Any
money-framing of credits in this repo is an error, not a claim.

## Secrets — Infisical is the single source of truth

All secrets are stored in the self-hosted Infisical instance. The Infisical `production`
environment is the single source of truth for all secrets. Two integrations — GetStream and
Formance — additionally keep `*_STAGING` values in that same environment; demo mode selects them at
runtime so recording sessions never touch the production Stream quota or the real ledger. Do not
rename, remove, or restructure secret keys without explicit user approval.

Only a small set of bootstrap secrets live outside Infisical:

| Where | Secrets |
|---|---|
| GitHub Actions secrets | `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_PROJECT_SLUG`, `INFISICAL_URL` |

**To use secrets in a task or script:**
```bash
infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
  <your command>
```

Infisical is the single source of truth for secrets; the bootstrap secrets above are all that is
needed to authenticate `infisical run`.

## Key Rules (pointers to full detail)

| Topic | Rule file |
|---|---|
| Environment variables | `.claude/rules/123-environment-configuration-rules.mdc` |
| CI gates | `.claude/rules/119-github-actions-ci-rules.mdc` |
| Monorepo layout | `.claude/rules/101-monorepo-layout-rules.mdc` |
| Schema drift | `.claude/rules/122-schema-drift-predeployment-rules.mdc` |
| Plugin architecture | `.claude/rules/112-platform-architecture-rules.mdc` |
| Auth (Clerk) | `.claude/rules/107-integration-stack-rules.mdc` |
| File size limits | `.claude/rules/116-file-size-and-modularity-rules.mdc` |
| Agent cost/readability | `.claude/rules/117-agent-readability-and-cost-rules.mdc` |

# Codespaces Environment Notice

- The primary development environment is GitHub Codespaces.
- All environment-type updates, additions, and tooling changes must be reflected in the devcontainer setup (e.g., .devcontainer/setup.sh, devcontainer.json) to ensure reproducibility and zero manual steps on container start.

## Branch Naming (Critical — all agents)

- Always create a descriptive, task-named branch and develop on it. Use a Conventional-Commit-style prefix plus a short kebab-case summary of the task: e.g. `feat/survivor-hub-feed-consolidation`, `fix/feed-csrf-dedup`, `chore/agent-branch-naming-rule`, `docs/brand-voice-lexicon`.
- Never develop on, commit to, or open a PR from the auto-generated session branch that the Claude Code harness assigns (e.g. `claude/<random-slug>` such as `claude/loving-mendel-wwWF4`). That name is opaque and meaningless. Treat it as a throwaway base: immediately branch off it (or off `main`) to a descriptive name and push/open the PR from the descriptive branch.
- Branch names must describe the task at hand — never an opaque/random string. This applies even when a session is initialized on a `claude/<slug>` branch: the first action for any code work is to create the descriptive branch.

## Search Tooling Policy

- Prefer `rg`/ripgrep for recursive text and file discovery.
- Keep grep fallback logic in scripts and prompts where search commands are demonstrated.
- Use this portable shell pattern when needed:
  - `if command -v rg >/dev/null 2>&1; then rg -n "pattern" path; else grep -RIn "pattern" path; fi`

## Task Planning — No Phases (Critical)

Do **not** organize work into "phases." No "Phase 0 / Phase 1 / Phase 2", no "Phase F", no
phased-rollout buckets — anywhere: plans, inventories, checklists, design artifacts, mockups, code
comments, PR descriptions, or commit messages. Phases confuse humans and agents and have been
hard-coded into design mockups by mistake.

Instead, when given an objective, break it into discrete tasks and **list them one after another in
the order they must happen**. Where order matters, state it as an explicit blocking dependency, not a
phase:

- ✅ "Task B is blocked by Task A — do A first."
- ✅ A flat, ordered, numbered task list (1, 2, 3 …) where each item may name what it depends on.
- ❌ "Phase 1: …", "Phase 2: …", "do this in a later phase."

A task with no dependency can be done at any time or in parallel; say so plainly ("no dependencies;
can run anytime"). Reserve the word "phase" only for fixed product-maturity terms already in the
rules (e.g. "MVP", "post-MVP hardening") — never as a unit of work breakdown.

## Plain Language — No Jargon (Critical — all agents)

Write in plain, everyday language. **Do not use jargon, acronyms, or insider terminology** in
human-facing output — chat replies, PR titles and descriptions, review comments, commit messages,
issue comments, and documentation. Jargon is a distraction and is confusing; it slows the reader down
and hides meaning.

- **Default to simple words.** Prefer the plain term over the technical or marketing one (e.g. "test
  it before you rely on it" over "validate end-to-end"; "make sure" over "ensure idempotency"; "the
  background service" over "the daemon/pserv"). Write so a non-specialist can follow.
- **If a technical term is genuinely necessary, define it in plain words on first use** — one short
  parenthetical is enough (e.g. "Ollama (the self-hosted tool that writes a draft answer)"). Don't
  assume the reader knows acronyms; spell them out the first time.
- **Explain, don't just name.** Say what something does and why it matters, not only its label.
- **Exempt:** real code identifiers, file paths, command names, and established proper nouns (service
  names, library names) — name those accurately; just don't pile extra jargon around them.
- Applies to **every agent** and all human-facing communication. When in doubt, choose the wording a
  newcomer would understand.

# Product Rules Index

## Scope

- Applies to the v3 web/Android product under `ctf/`.
- The `/platform` folder is strictly for reference-only during migration and must never be referenced, deployed, or used for routing or domain configuration unless explicitly requested.
- Governs architecture, coding standards, delivery quality, and compliance.

## App Versioning and Repository Policy

- This is **v3** of the app. The legacy app has been removed; the codebase under `ctf/` is the
  single, mature product. Do not describe it as "the rewrite" — that label has lost its meaning now
  that there is only one app. Prefer "the v3 app" or just "the app".
- **No new repositories.** Going forward, ship changes as app versions only — `v3.0.1`, `v3.1.0`,
  `v3.1.1`, etc. (semver under the `v3` major). Do not propose or create a new repo for a "v4" or a
  fresh rewrite; increment the version instead. This rule targets new *product/app* repos. It does
  **not** forbid internal operational repos: the project already runs a separate design repo and a
  separate landing-page repo, and the owner has approved a separate **private** bug-report triage repo
  (decided 2026-06-10 — see `.claude/rules/129-bug-reporting-and-triage-rules.mdc`). Do not flag that triage repo as
  a violation of this rule.
- Note: the CI workflow was renamed `rewrite-ci.yml` → `ci.yml` during the Render migration (PRs
  #98–#117 on `main`); its jobs (`pr-parity-status`, `formatting-eof`, `schema-drift-gate`, etc.) are
  unchanged. The package name still retains the historical name for stability; do not rename it without
  an explicit instruction.


## Product Rule Modules

- [099-agent-scope-guardrails.mdc](.claude/rules/099-agent-scope-guardrails.mdc)
- [100-product-context-and-experience-rules.mdc](.claude/rules/100-product-context-and-experience-rules.mdc)
- [101-monorepo-layout-rules.mdc](.claude/rules/101-monorepo-layout-rules.mdc)
- [102-shared-boundary-rules.mdc](.claude/rules/102-shared-boundary-rules.mdc)
- [103-web-nextjs-structure-rules.mdc](.claude/rules/103-web-nextjs-structure-rules.mdc)
- [104-mobile-react-native-android-rules.mdc](.claude/rules/104-mobile-react-native-android-rules.mdc)
- [105-web-android-feature-parity-rules.mdc](.claude/rules/105-web-android-feature-parity-rules.mdc)
- [106-expo-eas-mobile-workflow-rules.mdc](.claude/rules/106-expo-eas-mobile-workflow-rules.mdc)
- [107-integration-stack-rules.mdc](.claude/rules/107-integration-stack-rules.mdc)
- [108-observability-provider-abstraction-rules.mdc](.claude/rules/108-observability-provider-abstraction-rules.mdc)
- [109-sentry-implementation-rules.mdc](.claude/rules/109-sentry-implementation-rules.mdc)
- [110-stream-maker-tier-rules.mdc](.claude/rules/110-stream-maker-tier-rules.mdc)
- [112-platform-architecture-rules.mdc](.claude/rules/112-platform-architecture-rules.mdc)
- [113-platform-coding-rules.mdc](.claude/rules/113-platform-coding-rules.mdc)
- [114-single-profile-and-plugin-extension-rules.mdc](.claude/rules/114-single-profile-and-plugin-extension-rules.mdc)
- [115-neon-migration-delivery-rules.mdc](.claude/rules/115-neon-migration-delivery-rules.mdc)
- [116-file-size-and-modularity-rules.mdc](.claude/rules/116-file-size-and-modularity-rules.mdc)
- [117-agent-readability-and-cost-rules.mdc](.claude/rules/117-agent-readability-and-cost-rules.mdc)
- [118-platform-testing-and-release-rules.mdc](.claude/rules/118-platform-testing-and-release-rules.mdc)
- [119-github-actions-ci-rules.mdc](.claude/rules/119-github-actions-ci-rules.mdc)
- [120-plugin-feature-inventory-lifecycle-rules.mdc](.claude/rules/120-plugin-feature-inventory-lifecycle-rules.mdc)
- [121-canonical-metric-registry-rules.mdc](.claude/rules/121-canonical-metric-registry-rules.mdc)
- [122-schema-drift-predeployment-rules.mdc](.claude/rules/122-schema-drift-predeployment-rules.mdc)
- [123-environment-configuration-rules.mdc](.claude/rules/123-environment-configuration-rules.mdc)
- [124-brand-voice-and-language-rules.mdc](.claude/rules/124-brand-voice-and-language-rules.mdc)
- [125-railway-mcp-debugging-rules.mdc](.claude/rules/125-railway-mcp-debugging-rules.mdc)
- [126-design-mockup-implementation-rules.mdc](.claude/rules/126-design-mockup-implementation-rules.mdc)
- [127-design-pass-gating-rules.mdc](.claude/rules/127-design-pass-gating-rules.mdc)
- [128-design-sync-workflow-rules.mdc](.claude/rules/128-design-sync-workflow-rules.mdc)
- [129-bug-reporting-and-triage-rules.mdc](.claude/rules/129-bug-reporting-and-triage-rules.mdc)
- [130-link-sharing-and-copy-url-rules.mdc](.claude/rules/130-link-sharing-and-copy-url-rules.mdc)
- [131-admin-surface-design-and-build-rules.mdc](.claude/rules/131-admin-surface-design-and-build-rules.mdc)
- [132-trust-signal-coverage-rules.mdc](.claude/rules/132-trust-signal-coverage-rules.mdc)
- [133-manual-test-script-sweep-rules.mdc](.claude/rules/133-manual-test-script-sweep-rules.mdc)
- [134-navigation-and-back-control-rules.mdc](.claude/rules/134-navigation-and-back-control-rules.mdc)
- [135-ai-behavior-change-log-and-user-preferences.mdc](.claude/rules/135-ai-behavior-change-log-and-user-preferences.mdc)
- [136-backup-and-restore-testing-rules.mdc](.claude/rules/136-backup-and-restore-testing-rules.mdc)
- [200-plugin-command-contract-templates.mdc](.claude/rules/200-plugin-command-contract-templates.mdc)
- [201-plugin-command-schema-template.mdc](.claude/rules/201-plugin-command-schema-template.mdc)
- [202-plugin-access-policy-schema-template.mdc](.claude/rules/202-plugin-access-policy-schema-template.mdc)
- [203-plugin-audit-schema-template.mdc](.claude/rules/203-plugin-audit-schema-template.mdc)
- [014-compliance-rules-index.mdc](.claude/rules/014-compliance-rules-index.mdc)

# Supabase Instructions

- For any Supabase-related development, always consult the `.claude/rules/supabase/` folder for the latest rules and best practices.
- Supabase is ONLY to be used for document storage at this time. Do not use Supabase for authentication, user profiles, or any other features unless explicitly authorized in future instructions.

## Precedence

1. Product safety/compliance constraints
2. Environment configuration rules (integral to Clerk auth functioning)
3. Monorepo and boundary rules
4. Platform architecture rules
5. Platform coding rules
6. Testing and release rules
7. GitHub Actions CI rules
8. Plugin feature rules

If two rules conflict, choose the stricter rule and document the decision.

## Pull Request Conventions (enforced by CI — applies to all agents)

### PR Title — Conventional Commits (`pr-title-semantic.yml`)

Every PR title must start with one of these prefixes:

| Prefix | Use for |
|---|---|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `refactor:` | Code restructure, no behaviour change |
| `chore:` | Tooling, config, deps, devcontainer |
| `ci:` | GitHub Actions / CI workflow changes |
| `docs:` | Documentation only |
| `perf:` | Performance improvement |
| `test:` | Tests only |
| `build:` | Build system changes |
| `style:` | Formatting only |
| `revert:` | Revert a previous commit |

Example: `feat: add Ollama chatbot integration to feed question answers`

### PR Description — Parity Status (`pr-parity-status` in `ci.yml`)

Every PR description must include one of:

```
Parity Status: web + mobile-responsive + android complete
```
Use when the change is backend-only/infrastructure, or when everything in scope is implemented in
this PR. **Mobile-first web (owner decision, 2026-07-20 — see rule 105): the web app ships a single
phone-width layout at every viewport.** A desktop visitor sees that same layout in a centered
phone-proportioned column (`.ctf-phone-frame`); there is no separate desktop layout to build or
maintain, and no agent should build one. So the "web" and "mobile-responsive" words in the line are
one deliverable — the phone-width layout — and "android" is the React Native app (keep-list only,
below). The line keeps its three-part wording only so the CI gate and older PRs stay stable. (The
older `Parity Status: web+android complete` is still accepted by the gate so older PRs don't break,
but new PRs should use the three-part line.)

**Android app is narrowed to Chyme (owner decision, 2026-07-20 — see rule 105).** The native Android
app now carries only Clerk auth, Chyme (and any feature the Chyme plugin links to), bug reporting, and
settings / account; everything else is served by the installable web app (PWA). So for a **web-only**
change to any feature outside that keep-list — the common case now — the "android" part of the line is
satisfied because the app intentionally has no Android surface for that feature. Use the same
`Parity Status: web + mobile-responsive + android complete` line and add a one-liner in the body:
`Android: out of scope (web-only per rule 105)`. Only a change to a keep-list surface (Clerk, Chyme,
bug reporting, settings) still needs its Android side built in the same PR. **Do not** add React
Native screens for non-keep-list features.

```
Parity Ticket: <GitHub issue URL or #issue-number>
```
Use when Android parity is deferred; link to the tracking issue.

### EOF Formatting (`formatting-eof` in `ci.yml`)

All `.ts`, `.tsx`, `.js`, `.json`, `.yml`, `.yaml`, `.css` files must end with exactly one newline and no trailing blank lines. Validated by `ctf/scripts/check-eof-format.sh` on every PR.

### Known: a freshly-opened PR fails "Semantic PR Title" and "PR Parity Status" — just fix it, don't re-diagnose

PRs in this repo are usually opened from the Claude Code web UI, which auto-generates the title and
description. That generated text does **not** follow the two conventions above, so the **Semantic PR
Title** (`pr-title-semantic.yml`) and **PR Parity Status** (`pr-parity-status` in `ci.yml`) checks go
red within seconds of the PR opening. **This is expected and well understood — do not spend tokens
investigating why these two checks fail on a brand-new PR.** Fix the metadata directly:

1. **Title** — edit it to a Conventional Commit (`feat:` / `fix:` / `chore:` / `refactor:` / `docs:` /
   `ci:` / `perf:` / `test:` / `build:` / `style:` / `revert:`). Editing the title re-runs the
   Semantic PR Title check automatically.
2. **Description** — add a line that is *exactly* `Parity Status: web + mobile-responsive + android complete`
   (backend/infra, or all three shipped in this PR) **or** `Parity Ticket: #<issue>` (Android deferred).
3. **Re-trigger parity** — the PR Parity Status check does **not** re-run on a description edit. Push
   one empty commit to the PR branch to re-evaluate it:
   `git commit --allow-empty -m "chore: re-trigger CI" && git push`.

After that both go green. The whole fix costs about one title edit, one description edit, and one
empty commit. If you can set the PR body at creation time, put the Conventional-Commit title and the
`Parity Status:` line in up front so both pass on the first run and no empty commit is needed.

### Code Review (CodeRabbit removed — replaced by the in-repo code-review pipeline)

**CodeRabbit has been removed from this repo (owner directive): it is replaced by the in-repo
code-review pipeline.** Its config (`.coderabbit.yaml`), the VS Code extension, the devcontainer CLI
install, and the old `coderabbit-review.yml` / `pace-coderabbit-reviews.yml` workflows are all gone.
Do **not** re-add a `.coderabbit.yaml`, apply a `coderabbit` label, open PRs as drafts to wait for a
CodeRabbit review, or comment `@coderabbitai`. Code review now runs from
`.github/workflows/code-review-sweep.yml` (reviews one plugin/module per run and files `code-review`
issues) and `code-review-implement.yml` (turns an actionable finding into a PR). Note: removing these
repo files does not uninstall the CodeRabbit GitHub App — if it is still installed at the org/UI
level, uninstall it there so it cannot resume reviewing with default settings.

**Working the findings by hand: `/cr`.** The owner asks for this most days, so the whole routine —
find the open findings, verify each one against the code before acting, fix the real ones on a
descriptive branch, open the PR with the title and `Parity Status:` line set at creation, pick the
auto-merge or owner-review lane, then keep the branch up to date until it merges — lives in
`.claude/commands/cr.md`. Follow that file when asked to work code-review issues, whether or not the
request came in as the slash command.

#### Two lanes by risk

The repo has **auto-merge** and **auto-delete head branches** turned on. Pick the lane by risk:

**Low-risk lane (default — the bulk of work).** Restyles, copy/color/spacing, responsive layout of
shipped screens, rule-116 decompositions, docs, refactors, type/lint/test changes. For these:

- Open the PR **ready for review** (`draft: false`), with the Conventional-Commit title and the
  `Parity Status:` line set at creation so the title/parity checks pass on the first run.
- **Turn on auto-merge** right after opening (GitHub MCP `enable_pr_auto_merge`, merge method per repo
  default). CI runs, and when it's green GitHub merges the PR and deletes the branch — hands-off.

**Owner-review lane (risky).** Anything that touches money / ServiceCredits ledger, auth/authz, CSRF,
data deletion, schema / migrations, new or changed API contracts, or brand-new stateful logic / a
whole new plugin. For these:

- Open the PR **ready for review** (not a draft), with the title and `Parity Status:` line set at
  creation, but do **not** enable auto-merge — leave it for the owner to review with their tool and
  merge (owner decision, 2026-06-05: risky changes get human eyes first). Branch cleanup is still
  automatic on merge.
- **Never treat a pending review as a blocker.** Keep building the backlog; a risky PR simply waits for
  the owner's review and merge.

Net effect: **low-risk = ready + auto-merge (completes itself); risky = ready, owner reviews and merges.**

#### If a risky PR merges before its review findings were applied, open a follow-up PR (always)

Review findings are wanted, not optional. If a risky PR is merged (often via a quick owner merge)
**before** its review findings were applied, the agent **must open a small follow-up PR** that applies
the still-valid findings — never leave them dropped on the floor (owner directive, 2026-06-19). Verify
each finding against the merged code first: apply the ones that still hold, skip any that no longer
apply with a one-line reason, keep the change minimal, and reference the original PR.

### Updating `PRODUCTION_READINESS_PLAN.md` (avoid change-log merge conflicts)

When several plugin PRs are open at once, all appending narrative to the **same** change-log section
of `ctf/docs/developer/PRODUCTION_READINESS_PLAN.md` produces a merge conflict every time a sibling
merges first. To avoid this:

- In `PRODUCTION_READINESS_PLAN.md`, a per-plugin PR should **only flip that plugin's row** in the
  progress table (the row is the single source of truth for delivery status). Do **not** append a
  per-PR change-log entry there.
- Put the detailed change-log narrative in that plugin's **own inventory file**
  (`ctf/docs/developer/ctf-plugin-feature-inventories/ctf-<plugin>-feature-inventory.md`), which is
  one file per plugin and therefore never collides with sibling PRs.
- Reserve the plan's change-log section for cross-cutting milestones (infra, policy, multi-plugin
  reconciliations), not routine per-plugin passes.

## Agent Startup Read Order

- On each new task, read this file (`CLAUDE.md`) first.
- Then read directly relevant modules before editing code (architecture, coding, testing/release, and domain-specific rules).
- For user-facing copy changes, read `.claude/rules/124-brand-voice-and-language-rules.mdc` and `ctf/docs/BRAND_VOICE_LEXICON.md` before editing content.
- For modularity governance checks, consult `.claude/rules/116-file-size-and-modularity-rules.mdc`, including responsibility boundaries and complexity indicators.
- When unclear, prefer broader safety/compliance and boundary rules over feature-level rules.

## CTF Contract

## Security and Secrets Policy (Critical)

**This is an open source repository.** Everything committed to this codebase is publicly visible. Never expose secrets, credentials, API keys, encryption keys, tokens, or any sensitive information through:

- **Code commits** — no secrets hardcoded or in examples
- **GitHub Actions logs/stdout** — no auto-generated secrets printed to console
- **Job summaries or outputs** — no sensitive values in workflow summaries
- **Documentation or comments** — no example credentials or keys
- **Error messages or debugging output** — scrub sensitive info from error handling

**Correct pattern for secrets:**
1. User generates secrets locally (e.g., `openssl rand -hex 16` in a terminal)
2. User stores them securely as GitHub repository secrets
3. Workflows pass them to scripts as masked environment variables
4. Scripts consume them but never print or output them
5. Error messages that fail validation refer users to the generation command, not the secret itself

**If a secret is ever exposed** (even locally in logs or momentarily in a PR):
- Rotate it immediately via the GitHub Actions secrets UI or service dashboard
- Do not commit the exposed value to the repo

This applies to all development: deploy scripts, CI/CD workflows, seed scripts, test fixtures, and any infrastructure code.

## Local Build and Error Checking Requirement

- After every code change, always run the local build (e.g., `pnpm build` or project-specific build command) and check for errors.
- If any errors are found, fix them before marking the work as complete.
- This is mandatory to prevent pushing broken code, especially for users without local development environments.

## Database Migration Best Practices (REQUIRED)

  - Use `CREATE TABLE IF NOT EXISTS ...` for new tables, listing all current columns.
  - Use `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS ...` for every new/changed column, even if the column is in the CREATE TABLE above.
  - This ensures both fresh DBs and legacy DBs are always brought up to date.


## TypeScript Type Safety Policy (Critical)
- This policy is mandatory and must be enforced by all agents and contributors.

### Explicit Type Safety Rules
- If a legitimate exception to these rules is required (e.g., third-party library limitation), use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with an explanatory comment and a TODO to revisit.


## Plugin Feature Inventory Sync Policy (Critical)

All code changes to plugin routes, database schema, contracts, or seed scripts MUST be accompanied by corresponding updates to the plugin's feature inventory markdown file. This prevents drift between code state and documentation, ensuring feature inventories remain authoritative sources of truth for plugin capabilities, data models, and delivery status.

**Why this matters — the inventory serves three readers, and an out-of-date or vague inventory fails them:**

1. **The next agent.** On a later task an agent reads the inventory to understand what already exists, to catch feature drift, and to spot incomplete or half-shipped work. If the inventory does not match the code, the agent acts on a wrong map — re-doing finished work, missing a gap, or "fixing" something that is actually correct.
2. **The owner's product description.** The inventory is the owner's always-current list of what the product actually does, used to describe the product accurately to users. A wrong inventory means the product gets described wrong.
3. **Automated generators.** Some sections are the only facts fed to generators (e.g. the public user guide is built from each inventory's **User Features** section plus the test-script **Core smoke** steps, and nothing else). A vague or abstract line there does not produce vague output — it produces **invented** output, because the generator fills the gap with plausible-but-wrong features. Write generator-grounding sections concretely, in plain member-facing words; see [120-plugin-feature-inventory-lifecycle-rules.mdc](.claude/rules/120-plugin-feature-inventory-lifecycle-rules.mdc) "Downstream Generators — Write Concretely".

So the inventory update is **part of the change, not optional follow-up**: a change is not complete until the inventory matches it. This applies to every change that alters a feature, a route, the data model, a contract, or delivery status — not literally every whitespace/refactor edit, but anything that changes what the product does or how its data/contracts are shaped (see the Drift Vectors table below for the exact triggers).

### Drift Vectors and Required Updates

When making code changes, consult this table to identify which inventory section(s) must be updated:

| Code Change Type | Location | Affected Inventory Section | Required Update |
|---|---|---|---|
| **Add/modify/remove API endpoint** | `ctf/packages/web/app/api/{plugin}/**/route.ts` | API Surface and Route Map | Add/update/remove route from list; update description, HTTP method, and parameters |
| **Add/modify endpoint contract** | `ctf/docs/contracts/{PLUGIN}_PLUGIN_COMMAND_CONTRACTS.yaml` | Security, Privacy, and Compliance Controls | Update command definition, input/output schemas, validation rules |
| **Add/modify access policy** | `ctf/docs/contracts/{PLUGIN}_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml` | Security, Privacy, and Compliance Controls | Update role requirements, approval gates, auth enforcement |
| **Add/modify deletion behavior** | `ctf/docs/contracts/{PLUGIN}_PROFILE_AND_DELETION_CONTRACT.md` | Security, Privacy, and Compliance Controls | Update which tables/columns are deleted on service/profile deletion |
| **Create new database table** | `ctf/schema.sql` (CREATE TABLE block) | Data Model and Storage Contracts | Add table to list; document primary key, constraints, indexes; update seed coverage status |
| **Add/remove database column** | `ctf/schema.sql` (ALTER TABLE block) | Data Model and Storage Contracts | Add/remove column from list; document type, constraints, default value |
| **Modify column constraints/type** | `ctf/schema.sql` | Data Model and Storage Contracts | Update column definition; document breaking changes and migration impact |
| **Add/modify seed script** | `ctf/scripts/seed{PluginName}Phase0.mjs` | Seed Coverage Status | Update what data is seeded; note any new columns/tables; document deterministic UUIDs |
| **Add mobile feature** | `ctf/packages/mobile/src/features/{plugin}/**` | Web and Android Delivery Status; Mobile Parity Contracts | Update delivery status; create/update `ctf/config/plugin-parity-contracts.json` entry; update milestone dates |
| **Remove/deprecate feature** | Web or mobile package | Web and Android Delivery Status; User Features | Move feature to changelog section; update milestone dates; document deprecation reason |
| **Create entirely new plugin** | Full stack (see below) | All sections | See new plugin checklist below |

### New Plugin Lifecycle Checklist

When creating a new plugin from scratch, ALL of the following must be completed before PR approval:

1. **Inventory File** (single combined document — see [120-plugin-feature-inventory-lifecycle-rules.mdc](.claude/rules/120-plugin-feature-inventory-lifecycle-rules.mdc))
   - Create `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-{plugin-slug}-feature-inventory.md` with all required sections (Scope & Boundary, Intent, User Features, Admin Features, API Surface and Route Map, Data Model and Storage Contracts, Security/Privacy/Compliance Controls, Web and Android Delivery Status, Seed Coverage Status, Gaps & Known Technical Debt, Change Log)
   - Include a `## Build Checklist` section in that same file: an ordered, dependency-based task list (no phases). There is no separate checklist file.

2. **Schema & Migrations**
   - Add all plugin tables to `ctf/schema.sql` using `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` pattern
   - Document all tables and columns in inventory "Data Model and Storage Contracts" section

3. **Contract Files**
   - Create `ctf/docs/contracts/{PLUGIN}_PLUGIN_COMMAND_CONTRACTS.yaml` with all command definitions and dataAccess lists
   - Create `ctf/docs/contracts/{PLUGIN}_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml` with role-based access controls
   - Create `ctf/docs/contracts/{PLUGIN}_PROFILE_AND_DELETION_CONTRACT.md` with deletion scopes and data retention policy (if applicable)
   - Create `ctf/docs/contracts/{PLUGIN}_PLUGIN_AUDIT_CONTRACTS.yaml` with audit events (if applicable)

4. **Seed Script**
   - Create `ctf/scripts/seed{PluginName}Phase0.mjs` that populates all tables with deterministic seeding
   - Document in inventory "Seed Coverage Status" section

5. **API Routes**
   - Create all API endpoints under `ctf/packages/web/app/api/{plugin}/`
   - Document in inventory "API Surface and Route Map" section
   - Add corresponding command contracts

6. **Web Shell/UI**
   - Create React component shell at `ctf/packages/web/components/{plugin}/{plugin}-shell.tsx` or equivalent
   - Add route entry at `ctf/packages/web/app/apps/{plugin}/page.tsx`

7. **Mobile Feature (if applicable)**
   - Create feature directory at `ctf/packages/mobile/src/features/{plugin}/`
   - Create API client at `ctf/packages/mobile/src/features/{plugin}/{Plugin}Api.ts`
   - Update `ctf/config/plugin-parity-contracts.json` with parity entry
   - Update `ctf/packages/web/lib/plugins/repository.ts` registry entry

8. **Plugin Registry**
   - Add entry to `ctf/packages/web/lib/plugins/repository.ts` with slug, name, summary, availability state, nav rank

9. **Trust Signal (if the plugin has real member participation)**
   - If members complete/accept/claim/publish real rows in this plugin, add one categorical Trust signal so a member active only here is still seen — per [132-trust-signal-coverage-rules.mdc](.claude/rules/132-trust-signal-coverage-rules.mdc). Add a metric to `TrustSignalMetrics`, a coarse `COUNT` to `computeTrustSignalMetrics`, an entry to the `participationSignals` array in `buildTrustEvidence` (all in `ctf/packages/web/lib/trust/`), bump `TRUST_SNAPSHOT_MODEL`, and add the table to the `trust.signal.snapshot.refresh` contract `dataAccess`.
   - **Never** surface sensitive personal-wellbeing/safety/verification participation as public evidence (no numeric score, ever). If the plugin is admin-only, read-only, or sensitive, record it as not-applicable in the Trust inventory with the reason.

### Enforcement

**PR Review Gate**: 
- No PR can be approved if inventory file(s) are not updated to match all code changes
- For plugin modifications: inventory sections must reflect current code state (routes, schema, contracts, status)
- For new plugins: all inventory sections must be populated per the New Plugin Lifecycle Checklist

**Agent Responsibility**:
- Before submitting a PR, agents MUST verify:
  1. All modified code artifacts (routes, schema, contracts) have corresponding inventory updates
  2. Inventory section content matches actual code (e.g., route list is complete and accurate)
  3. If unsure which sections need updating, see "Drift Vectors" table above
- Treat missing or out-of-sync inventory updates as blockers (same as TypeScript errors)

**Cross-References**:
- Related rules: [120-plugin-feature-inventory-lifecycle-rules.mdc](.claude/rules/120-plugin-feature-inventory-lifecycle-rules.mdc) (naming/folder structure), [122-schema-drift-predeployment-rules.mdc](.claude/rules/122-schema-drift-predeployment-rules.mdc) (schema drift detection)
- Inventory template examples: [ctf/docs/developer/ctf-plugin-feature-inventories/](ctf/docs/developer/ctf-plugin-feature-inventories/)

### Automated Enforcement (and remaining gaps)

A CI gate runs `node ctf/scripts/check-inventory-drift.mjs` on every PR (job `inventory-drift-gate` in `.github/workflows/ci.yml`; run locally with `pnpm --dir ctf run check:inventory-drift`). It fails the build when a schema table or an API route exists in the code but is documented in **no** feature inventory — so a new table/route can no longer ship undocumented, and enforcement no longer depends on an agent remembering. Known pre-existing gaps are recorded in `ctf/scripts/inventory-drift-allowlist.json`, a burn-down list that should only ever shrink (never add a new table/route there to silence the gate — document it instead).

Still manual / not yet automated (follow-ups):
- Verifying a table/route is in the **right** plugin's inventory, not merely documented somewhere — the slug ↔ api-dir ↔ table-prefix mapping is irregular (e.g. api `gdp` ↔ `gross-domestic-product`), so it needs an explicit manifest.
- Matching contract YAML definitions against the inventory "Security, Privacy, and Compliance Controls" section.
- Opening GitHub issues for detected drift (the gate currently fails the PR instead, which catches it earlier).
</content>
