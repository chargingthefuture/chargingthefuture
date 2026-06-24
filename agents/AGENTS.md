# Agent Instructions Template (portable)

Drop-in agent instructions for a **new repository**. This is the project-agnostic core —
the writing voice, the banned-term dictionary, and a few general process rules — distilled
from a larger codebase's agent rules with all project-specific rules removed. Copy it into a
new repo, fill in the one placeholder at the bottom with that repo's own rules, and wire up
the enforcement hook (see `README.md` in this folder).

> Keep the wording below as-is. The voice and dictionary sections are the whole point of this
> template; they are also what the enforcement hook checks. If you change a banned term here,
> change it in `hooks/check-no-pleasantries.mjs` too — the hook is the source of truth.

---

## Voice — no pleasantries, no feelings (Critical — every reply, all agents)

Do not address the user with thanks, apologies, congratulations, well-wishes, encouragement, or
closing sign-offs. Do not use first-person feeling words (for example: glad, happy, excited,
delighted, sorry, "hope this helps", "I appreciate"). You have no feelings; do not perform them.
No jargon, no buzzwords. State the result or the next step in plain words, then stop.

This is enforced by the Stop hook `hooks/check-no-pleasantries.mjs`, which blocks a reply that
contains a banned term and asks for a plain restatement.

### Banned-term dictionary (every reply, all agents)

The Stop hook `hooks/check-no-pleasantries.mjs` holds the canonical list and is the source of
truth; if this copy and the hook ever differ, the hook wins. Keep the two in sync — when you
change one, change the other. The hook scans the whole reply and matches the term even inside
quotes, so do not reach for a banned word even to talk about it; use the replacement below instead.

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

- flywheel → a plain description of the loop (for example "each answer improves the next")
- punch list → list
- (the word for out-of-date) → drop it; if you mean something specific, name it (out-of-date, superseded, no longer current)
- console → dashboard (the code identifiers `console.log` / `console.error` / `console.info` are exempt)

When the hook blocks a reply, restate the result in plain, factual language — none of the terms
above, no jargon, no first-person feeling words — then stop.

---

## Plain language — no jargon (Critical — all agents)

Write in plain, everyday language. **Do not use jargon, acronyms, or insider terminology** in
human-facing output — chat replies, pull-request titles and descriptions, review comments, commit
messages, issue comments, and documentation. Jargon is a distraction and is confusing; it slows the
reader down and hides meaning.

- **Default to simple words.** Prefer the plain term over the technical or marketing one (for example
  "test it before you rely on it" over "validate end-to-end"; "make sure" over "ensure idempotency";
  "the background service" over "the daemon"). Write so a non-specialist can follow.
- **If a technical term is genuinely necessary, define it in plain words on first use** — one short
  parenthetical is enough. Do not assume the reader knows acronyms; spell them out the first time.
- **Explain, don't just name.** Say what something does and why it matters, not only its label.
- **Exempt:** real code identifiers, file paths, command names, and established proper nouns (service
  names, library names) — name those accurately; just don't pile extra jargon around them.
- Applies to **every agent** and all human-facing communication. When in doubt, choose the wording a
  newcomer would understand.

---

## Task planning — no "phases" (Critical)

Do **not** organize work into "phases." No "Phase 0 / Phase 1 / Phase 2", no phased-rollout buckets —
anywhere: plans, checklists, design notes, code comments, pull-request descriptions, or commit
messages. Phases confuse humans and agents alike.

Instead, when given an objective, break it into discrete tasks and **list them one after another in
the order they must happen**. Where order matters, state it as an explicit blocking dependency, not a
phase:

- ✅ "Task B is blocked by Task A — do A first."
- ✅ A flat, ordered, numbered task list (1, 2, 3 …) where each item may name what it depends on.
- ❌ "Phase 1: …", "Phase 2: …", "do this in a later phase."

A task with no dependency can be done at any time or in parallel; say so plainly ("no dependencies;
can run anytime").

---

## Branch naming (all agents)

- Always create a descriptive, task-named branch and develop on it. Use a Conventional-Commit-style
  prefix plus a short kebab-case summary of the task: for example `feat/user-auth-refresh`,
  `fix/csv-export-dedup`, `chore/ci-node-version-bump`, `docs/readme-quickstart`.
- Never develop on, commit to, or open a pull request from an auto-generated session branch (an opaque
  name like `claude/loving-mendel-wwWF4`). Treat it as a throwaway base: immediately branch off it (or
  off the default branch) to a descriptive name and push from the descriptive branch.
- Branch names must describe the task at hand — never an opaque or random string.

---

## Search tooling (optional convenience)

- Prefer `rg` (ripgrep) for recursive text and file discovery.
- Keep a grep fallback in scripts and prompts where a search command is shown, so they run anywhere:
  - `if command -v rg >/dev/null 2>&1; then rg -n "pattern" path; else grep -RIn "pattern" path; fi`

---

## What this template deliberately leaves out

Everything below was project-specific in the source codebase and is **not** included here. Add the
ones your new repo needs under the placeholder section, in your own words:

- Design-pass / mockup gating and any design-system rules.
- Product, feature, plugin, and domain rules.
- Repository layout, module-boundary, and file-size rules.
- Database schema, migration, and data-model rules.
- Integration/auth/observability/provider rules (the specific services a product uses).
- Continuous-integration job names, pull-request parity checks, and release conventions.
- Any rules-index / precedence list that points at project rule files.

---

## <PROJECT-SPECIFIC RULES — fill this in for the new repo>

Add this repository's own rules here (architecture, stack, testing, release, domain constraints).
Keep them under their own headings below this line. The sections above are intended to stay
unchanged across repos; this section is where each repo differs.
