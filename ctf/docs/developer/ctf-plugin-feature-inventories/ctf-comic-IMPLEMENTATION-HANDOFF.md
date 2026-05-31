# comic — Production Build Handoff (TRANSIENT — delete when the backend PR lands)

> Working notes to resume bringing `@comic` to production in a **fresh session**. This
> session ran out of context after research + the inventory PR. The authoritative feature
> spec is `ctf-comic-feature-inventory.md` (same folder). Delete this file once the backend
> is implemented.

## State as of handoff (2026-05-31)

- **Branch:** `claude/tender-knuth-Yuq9s`. **PR #176** (draft, base `main`) — currently the
  inventory docs only. Continue on the **same branch/PR**.
- **Already committed:** `ctf-comic-feature-inventory.md` (new, source of truth),
  `@comic` cross-link in `ctf-survivor-hub-chat-feature-inventory.md`, README index entry.
- **Owner directive:** bring the AI/`@comic` feature to production in this PR; it has its
  own session so it doesn't block the other agent productionizing every other feature.

## HARD BLOCKER — Design Pass Gate (read `.github/instructions/127-design-pass-gating-rules.mdc`)

- **Verified: NO `comic` design exists** in the `design/` submodule (`rg -il "comic" design`
  → empty). Existing survivor-hub mockups are Feed/Announcements/Hub only — no `@comic`
  chat, no review console.
- Therefore **do NOT write any UI** (the `@comic` chat rendering, the owner
  review/correction console) — user-facing **or** admin. No bypass keyword was given
  (`bypass design` / `design done` / `hotfix`).
- **Build the non-UI foundation now** (schema, libraries, server-only API routes,
  contracts, seed) — these are explicitly exempt from the gate. Then **announce
  `DESIGN PASS REQUIRED`** for the two UI surfaces and hand a modification prompt to the
  Replit design agent (out-of-band).

## Infra reality

- **Ollama IS deployed on Render** (`ctf-ollama`). Env: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
  (default `llama3.2`). See `ctf/docs/developer/OLLAMA.md`, `ctf/ops/README.md`,
  `ctf/scripts/ollamaModelManager.sh`. Client: `lib/chatbot/ollama.ts` (`callOllamaChat`,
  `isOllamaConfigured`, `OLLAMA_MODEL`, `SURVIVOR_SYSTEM_PROMPT`).
- **Rasa is NOT deployed.** So there is no real NLU confidence yet. **Interim operating
  mode:** treat the bot as untrained → **human-in-the-loop on every `@comic` answer**. Bot
  drafts via Ollama, but the draft goes to the **review queue**; the user sees a safe
  preset/holding message until the owner approves/edits (or: bot posts and owner corrects —
  owner picked "hybrid by confidence/safety", but with no Rasa confidence the safe interim
  is human-review-all). Add a `lib/comic/rasa.ts` client whose `isRasaConfigured()` returns
  false until `RASA_BASE_URL` is set, so policy forces human review until Rasa lands.

## Existing precursors to extend (do not duplicate)

1. Feed Q&A direct-Ollama: `lib/feed/inference.ts` (`generateFeedAssistedAnswer`),
   `lib/feed/repository.ts` (`generateFeedQuestionAnswer` ~L1210; `llm_inference_log` insert
   ~L1264). Static confidence; template fallback; `APPROVED_SOURCE_MAP` (display-only).
2. Rasa NLU export: `exportQuestionsForRasa()` (`lib/feed/repository.ts` ~L1644) +
   `GET /api/feed/admin/questions/export`. **Bug:** historically a duplicate nested loop
   double-counted examples — current code at ~L1661 looks single-loop; verify and keep
   single. comic training export should supersede this (turns + corrections, not just
   category buckets).
3. Home-chat router: `components/community-shell/use-home-chat.ts` (`getActionForText`
   keyword→plugin nav; `ctf-home-bot`; posts to stub `POST /api/hub/messages`). This is the
   presentation precursor; replacing it with Rasa-backed routing is later + UI-gated.

## Backend to build (production; all NON-UI = unblocked)

1. **Schema** (`ctf/schema.sql`, guarded DDL: `CREATE TABLE IF NOT EXISTS` + per-column
   `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`):
   - `comic_conversations` (id uuid pk, user_id text, channel text, status text, created_at,
     updated_at).
   - `comic_turns` (id uuid pk, conversation_id uuid fk, role text [user|bot|human],
     body text, intent text null, nlu_confidence numeric null, engine text
     [rasa|ollama|template|human], created_at).
   - `comic_review_queue` (id uuid pk, turn_id uuid fk, status text
     [pending|approved|corrected|rejected], reviewer_user_id text null, corrected_body text
     null, reason text null, created_at, decided_at null).
   - `comic_training_examples` (id uuid pk, source_turn_id uuid fk, intent_label text,
     text text, entities jsonb default '[]', story jsonb null, status text, exported_at null,
     created_at).
   - Reuse `llm_inference_log` (generation audit) + `feed_answer_ratings` (quality signal).
   - Prefix decision = `comic_*` (matches the ~156 `<domain>_*` tables; `ctf_` is only the
     global `ctf_plugin_registry`).
2. **Library** `ctf/packages/web/lib/comic/`:
   - `types.ts`, `constants.ts` (error codes mirror `lib/feed/constants.ts`; `@comic`
     trigger regex; max lengths; rate limits).
   - `audit.ts` (mirror `lib/feed/audit.ts` `logFeedAudit`).
   - `rasa.ts` (interim client; `isRasaConfigured()` false until `RASA_BASE_URL`).
   - `policy.ts` (consent gate, moderation [reuse feed's `passesFeedModeration` idea: reject
     `<>`, URL cap, non-empty], safety-category detection, interim confidence → force review).
   - `repository.ts` (DB via `withDbTransaction`/`queryDb` — see `lib/feed/repository.ts`
     imports for the helper path; conversation+turn capture, Ollama draft generation reusing
     `callOllamaChat` + `SURVIVOR_SYSTEM_PROMPT`, `llm_inference_log` insert, review-queue
     create/list/resolve, training export).
3. **API (server-only, NOT gated)** under `ctf/packages/web/app/api/comic/`:
   - `_lib.ts` (mirror `app/api/feed/_lib.ts`: `getAuthContext`, `ensureCsrf` →
     `requireComicReadAccess` / `requireComicAdminAccess` / `ensureMutationCsrf`).
   - `POST /api/comic/message` — accept a chat message; if it contains `@comic`, create
     conversation+turn, consent+moderation+safety checks, generate Ollama draft, enqueue to
     review (interim: do not surface draft to user; return a holding/preset). No `@` → no-op
     for comic (peer path stays in hub/feed).
   - `GET /api/comic/review` — admin list of pending turns.
   - `POST /api/comic/review/[turnId]/resolve` — admin approve/edit/reject; corrected text →
     `comic_training_examples`.
   - `POST /api/comic/training/export` — admin; Rasa NLU YAML from turns+corrections.
4. **Contracts** `ctf/docs/contracts/`: `COMIC_PLUGIN_COMMAND_CONTRACTS.yaml`,
   `COMIC_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`, `COMIC_PLUGIN_AUDIT_CONTRACTS.yaml`,
   `COMIC_PROFILE_AND_DELETION_CONTRACT.md`. Mirror the `FEED_*` files +
   `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`. Namespace
   `comic.*` (commands: `comic.message.route`, `comic.reply.generate`,
   `comic.review.resolve`, `comic.training.export`).
5. **Seed** `ctf/scripts/seedComicPhase0.mjs` — deterministic UUIDs; mirror
   `seedFeedAnnouncements.mjs`. Seed conversations, turns, a populated review queue, a few
   training examples.
6. **Do NOT** add a navigable plugin-registry entry (comic is not a standalone app; a nav
   entry is a UI surface).
7. **Inventory sync:** update `ctf-comic-feature-inventory.md` (API, data model, delivery
   status, seed coverage, change log, build-checklist checkboxes) to match the code.

## Process gotchas (CI + repo rules)

- **schema-drift gate** (`bash ctf/scripts/check-schema-drift.sh`): changing
  `ctf/schema.sql` satisfies the DB/seed/contract evidence requirement. Contract YAML
  changes need a schema.sql change OR `ctf/docs/developer/**` change OR `122` mdc edit. Run
  it before pushing.
- **EOF** (`ctf/scripts/check-eof-format.sh`): `.ts/.tsx/.js/.json/.yml/.yaml/.css` end with
  exactly one trailing newline. `.md` is exempt.
- **Local build is mandatory:** run the web build (e.g. `pnpm -C ctf/packages/web build` or
  the repo build) and fix errors before done. TypeScript: no `any` without justified
  eslint-disable.
- **PR:** keep #176; retitle to `feat: ...` (conventional commit) when it carries code. Body
  must carry a parity line — Android is deferred, so use `Parity Ticket: <issue>` (create a
  GitHub issue for Android `@comic` parity and link it), or `Parity Status: web+android
  complete` only if truly no client work remains (it won't, since UI is gated — prefer the
  ticket). Keep **draft**; owner marks ready.
- **CodeRabbit:** this is a brand-new stateful subsystem + new API contracts → it
  **qualifies** for the `coderabbit` label. Apply the label once after pushing (rate cap
  1/hour) via `issue_write`. Still leave PR as draft.
- **Commit messages** must end with the **current session's** URL on its own line
  (`https://claude.ai/code/session_<NEW_ID>`). **Never** put the model identifier in any
  committed artifact.
- **Subscribed to PR #176 activity** — handle CI failures / review comments as events.

## After backend lands — announce DESIGN PASS REQUIRED for:

1. **`@comic` chat rendering** in the unified Hub/Feed chat: user vs bot turns, the safe
   holding/preset state, source attribution, rating affordance.
2. **Owner review/correction console** (admin): pending queue, approve/edit/reject,
   correction → training.
Hand a modification prompt to the Replit design agent (out-of-band, not committed).
