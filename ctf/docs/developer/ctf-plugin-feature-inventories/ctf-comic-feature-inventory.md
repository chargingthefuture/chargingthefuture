# comic AI Assistant Feature Inventory (CTF v3)

> **What this is.** `@comic` is the AI chat assistant inside the unified Hub/Feed chat —
> one of the feed's three interleaved content types (**admin-only announcements**,
> **AI Q&A via `@comic`**, **peer-to-peer community posts**) rendered in a single UI.
> This inventory is **dedicated to the AI portion only**. Announcements and peer-to-peer
> surfaces live in `ctf-feed-feature-inventory.md` /
> `ctf-survivor-hub-chat-feature-inventory.md`.
>
> **`@comic` already exists** as a defined persona in the Survivor Hub inventory (a
> hub-owned assistive bot that introduces survivor stories, gives onboarding nudges, and
> routes users to plugins). This document **extends** that persona from a navigation
> router into a **conversational Q&A assistant** backed by Rasa + Ollama. It does not
> redefine `@comic`; the Hub inventory's `@comic` section should be updated to point here.
>
> **Why a separate file.** The AI assistant is becoming a distinct subsystem (Rasa +
> Ollama, its own data layer, a human-in-the-loop correction loop). A separate file avoids
> colliding with the agent concurrently editing the feed plugin. `@comic` is **not** a
> separately navigable app — it surfaces inside the Hub/Feed chat.
>
> **Placement (confirmed 2026-05-31):** this dedicated file is the **single source of
> truth** for the AI assistant; the Hub inventory's `@comic` section points here.

## Owner-Locked Decisions (2026-05-31)

Decided now to unblock the build; specifics (threshold values, the layered content filter)
are intentionally left for a later tuning pass — see "Future Notes."

1. **Internal slug = `comic`; user-facing label = "AI Assistant". Invocation = `@comic`
   mention.** A chat message containing `@comic` routes to the assistant and renders its
   reply inline; a message with **no `@`** is peer-to-peer (human-to-human) and **never
   touches the bot.** Bot replies use the design's **"AI Assistant"** treatment (cyan card,
   Sparkles avatar, 🤖 AI Q&A badge — `design/.../survivor-hub/Desktop.tsx` @ `a460914`).
   The design's composer **post/ask mode toggle is superseded** by `@comic`-mention (owner
   decision 2026-05-31) — the design agent must drop the toggle from the composer. `comic`
   stays the internal slug (tables `comic_*`, routes `/api/comic/*`, namespace `comic.*`);
   users only ever see "AI Assistant".
2. **Target architecture = self-hosted Rasa + self-hosted Ollama, layered.**
   - **Rasa** = orchestration: NLU (intent + entity extraction), dialogue management
     (rules/stories), a **real, calibratable confidence** (the `FallbackClassifier`
     threshold — replacing today's *static* confidence number), and the **human-handoff**
     loop.
   - **Ollama** = generation backend, invoked by a Rasa custom action for free-form answers
     (falling back to the deterministic template when generation is unavailable, as today).
3. **Operating mode now (62 users) = hybrid by confidence/safety, owner-supervised.**
   Bad info must not get out. Three outcomes per `@comic` turn:
   - **Above threshold + safe →** bot auto-replies, then the reply is **queued for owner
     review/correction** (not "fire and forget").
   - **Below threshold →** the user sees a **safe, pre-approved preset response** (never
     speculative content) and the turn is **routed to a human**.
   - **Safety-flagged →** **human-first**, no auto-reply.
4. **Data bootstrapping = a Conversation-Driven Development (CDD) flywheel.** Every
   `@comic` turn is captured. Owner corrections + `helpful / not_helpful / flagged` ratings
   become Rasa training data — **extending the export mechanism that already exists**
   (`exportQuestionsForRasa` → Rasa NLU YAML). Retrain → raise the auto-respond threshold →
   shrink the human-review share. **This flywheel is the path from 62 users to ~5M.**
5. **New data layer = deterministic conversation/training tables + a Rasa SQL tracker
   store** in the same Neon Postgres. Existing `llm_inference_log` (generation audit) and
   `feed_answer_ratings` (quality signal) are reused. Seed UUIDs are deterministic.
   - **Naming = `comic_*` (confirmed 2026-05-31).** Matches the dominant `<domain>_*`
     convention used by all ~156 domain tables (`feed_*`, `chyme_*`, …); the `ctf_` prefix
     stays reserved for the one global table (`ctf_plugin_registry`).

## Existing Precursors (verified in code, 2026-05-31)

This subsystem is **not greenfield** — it is three disconnected pieces plus a dropped
design that this plan unifies:

1. **Feed Q&A (direct Ollama)** — `lib/feed/inference.ts`, `lib/chatbot/ollama.ts`,
   `POST /api/feed/questions`, `POST /api/feed/questions/:id/answer`. The actual LLM
   answering today: a direct Ollama HTTP call with a static confidence and a template
   fallback. No NLU/dialogue.
2. **Rasa NLU export (training pathway, brick #1)** — `exportQuestionsForRasa()`
   (`lib/feed/repository.ts`) + `GET /api/feed/admin/questions/export` emit **Rasa NLU
   YAML** (`version: "3.1"`; intents = the 5 categories). Admin-gated. *Known bug:* a
   nested duplicate loop double-counts examples — fix when this is wired to a real Rasa.
3. **Home-chat router (presentation precursor)** — `components/community-shell/use-home-chat.ts`:
   client-side `getActionForText()` keyword→plugin navigation (`ctf-home-bot`, "I'm still
   learning…" fallback, localStorage history). **Navigation only, not Q&A.** The Hub
   consolidation already calls for replacing this hardcoded router with Feed-backed data.
4. **`@comic` persona + `hub_bots` design** — defined in the Survivor Hub inventory
   (persona, `hub_bots` table, deterministic seed, DM wiring). **But** the consolidation
   dropped the `hub_*` tables and **none exist in schema** — so the persona is real, its
   backing tables are not.

## Scope and Boundary

- Subsystem name: `comic`. Bot handle: `@comic`.
- Surfaced inside: the unified Hub/Feed chat (web `/apps/feed` → Survivor Hub homepage;
  Android `packages/mobile/src/features/feed`).
- Owned data layer (target): new conversation/training tables + Rasa tracker store; reuses
  `llm_inference_log`, `feed_answer_ratings`.
- Owned services (target): self-hosted Rasa service + the existing `ctf-ollama` service.
- Command namespace (target): `comic.*` (interplays with the `feed.*` timeline).
- **Out of scope here:** announcements, peer-to-peer posts, feed timeline rendering, Stream
  fan-out — those stay in the feed/Hub inventories.

## Intent and Outcome

Give survivors a safe, always-available assistant reachable with `@comic` from the same
chat where they talk to peers and read announcements — **without ever emitting unverified
information.** Early on it is supervised: the owner reviews and corrects every answer, and
those corrections train the bot (feeding the export→train loop that already exists). Over
time the bot handles more, supervised by exception, so it scales with the user base — and
its plugin-routing role (today's hardcoded `getActionForText`) becomes Rasa-backed.

## Current State vs Target (Doc-vs-Code Reconciliation)

| Capability | Today (in code) | Target (`@comic`) |
|---|---|---|
| Invocation | Structured "submit a question" form; separately, a client-side home-chat router | `@comic` mention inside the chat stream |
| Engine | Direct Ollama HTTP call; no NLU/dialogue. Home router is hardcoded keywords | Rasa (NLU + dialogue + fallback) → Ollama custom action |
| Confidence | **Static constant** (0.85 / 0.68–0.79) — not model-derived | Real Rasa NLU confidence, threshold-gated |
| Rasa | NLU **export only** (`exportQuestionsForRasa`); no Rasa service consumes it | Running Rasa service trains on exported + corrected turns |
| "Approved sources" | Display-only category labels; no retrieval | Grounded retrieval (RAG) is a later target |
| Moderation | Regex-only input check; no output check | Layered filter + Rasa fallback (see Future Notes) |
| Human-in-the-loop | None (answers return directly; `flagged` rating exists, no queue) | Owner review/correction console; CDD loop |
| Conversation store | None (single-turn `feed_questions`/`feed_answers`) | Multi-turn `comic_*` + Rasa tracker |

## Target User Features

1. Reach the assistant with `@comic <question>`; reply renders inline.
2. Peer-to-peer messages (no `@`) are never sent to the bot.
3. When unsure, the bot shows a clear pre-approved holding response and hands the question
   to a human — the user is never shown speculative content.
4. Users can rate any answer (`helpful / not_helpful / flagged`) — feeds the training loop.

## Target Admin / Owner Features

1. **Review & correction console** — queue of bot turns awaiting review; approve, edit, or
   reject; corrections become training examples. **[UI — triggers DESIGN PASS when built.]**
2. **Threshold & safety controls** — auto-respond confidence threshold, safety-flag rules,
   the preset below-threshold response. (Target; values tuned later.)
3. **Training/retraining** — push corrected turns to Rasa (extends the existing export);
   observe accuracy and the human-review share over time.
4. **Inference monitoring** — model ID, confidence, latency, sources, status (reuses
   `llm_inference_log`).

## API Surface and Route Map

### Current (precursors)
- `POST /api/feed/questions`, `POST /api/feed/questions/:id/answer`,
  `POST /api/feed/answers/:id/rate` — Q&A submit/generate/rate.
- `GET /api/feed/admin/questions`, `GET /api/feed/admin/questions/export` — admin review +
  **Rasa NLU YAML export**.
- Client-side home-chat routing in `use-home-chat.ts` (no dedicated server route;
  `POST /api/hub/messages` is a stub).

### Implemented (backend foundation, server-only — `comic.*`)
Built on `feat/comic-ai-assistant`; all server-only routes (no rendered surface), under
`ctf/packages/web/app/api/comic/`. Each route gates auth via `lib/auth/server-authz`
(`evaluatePluginAccess`) and CSRF via `_lib.ensureMutationCsrf`, mirroring the feed plugin.

- `POST /api/comic/message` (`comic.message.route`) — member/approved-or-admin. Detects the
  `@comic` mention; no mention → `routedToAssistant:false` no-op (peer-to-peer never reaches
  the bot). On mention: consent + moderation + safety checks, captures the user turn, drafts
  via Ollama (captured as a bot turn), enqueues to `comic_review_queue`, and returns **only a
  safe holding response (HTTP 202)** — never the unreviewed draft. Safety-flagged turns skip
  generation and are queued human-first.
- `GET /api/comic/review` (`comic.reply.generate` data surface) — admin. Paginated list of
  pending review items (asker question + draft + intent/confidence + safety category).
- `POST /api/comic/review/[turnId]/resolve` (`comic.review.resolve`) — admin. Approve / correct
  (edit) / reject a queued draft; a correction persists a `comic_training_examples` row.
- `GET /api/comic/training/export` (`comic.training.export`) — admin. Rasa NLU YAML (or JSON
  via `?format=json`) from accumulated turns + corrections; single-loop (no double counting).

Interim engine reality: **Ollama is deployed, Rasa is not.** `lib/comic/rasa.ts`
`isRasaConfigured()` returns false until `RASA_BASE_URL` is set, so `policy.forceHumanReview()`
routes **every** `@comic` draft to human review — nothing unreviewed is surfaced to the asker.

### Target (`@comic`)
- Mention routing also to ride the Hub message path (`POST /api/hub/messages`) once that stub
  is wired; today the dedicated `POST /api/comic/message` is the server entry point.
- Auto-reply branch (above-threshold) activates only once Rasa supplies a real, calibratable
  confidence; until then the interim policy forces human review on all drafts.
- Rasa/Ollama are reached **server-side only**; no third-party LLM egress (parity with the
  Hub's stance — and Ollama is self-hosted, so it is not third-party).

## Data Model and Storage Contracts

**Conversation/training tables (`comic_*`; implemented in `ctf/schema.sql` with guarded DDL —
`CREATE TABLE IF NOT EXISTS` + per-column `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`;
all FKs `ON DELETE CASCADE`):**

1. `comic_conversations` — a chat thread (`id` uuid pk, `user_id` text, `channel` text
   [hub|feed], `status` text [open|closed], `created_at`, `updated_at`). Indexed on `user_id`,
   `created_at`.
2. `comic_turns` — one row per turn (`id` uuid pk, `conversation_id` uuid FK→comic_conversations,
   `role` ∈ user|bot|human, `body`, `intent` null, `nlu_confidence` numeric(5,4) null, `engine`
   ∈ rasa|ollama|template|human, `created_at`). Indexed on `conversation_id`, `created_at`.
3. `comic_review_queue` — supervision state (`id` uuid pk, `turn_id` uuid FK→comic_turns,
   `status` ∈ pending|approved|corrected|rejected, `reviewer_user_id` null, `corrected_body`
   null, `reason` null, `created_at`, `decided_at` null). Indexed on `status`, `turn_id`,
   `created_at`. (`reason` carries `safety:<category>` for human-first turns or
   `interim_human_review` for drafts.)
4. `comic_training_examples` — curated training data exported to Rasa (`id` uuid pk,
   `source_turn_id` uuid FK→comic_turns, `intent_label` text, `text` text, `entities` jsonb
   default `[]`, `story` jsonb null, `status` ∈ pending|exported|discarded, `exported_at` null,
   `created_at`). Indexed on `intent_label`, `status`, `source_turn_id`.

**Rasa tracker store:** Rasa's own SQL event store, provisioned in the same Neon Postgres
(managed by Rasa, not hand-authored here). Deferred — Rasa is not deployed.

**Reused:** `feed_answer_ratings` (quality signal). Note: `llm_inference_log` has NOT-NULL FKs
into `feed_questions`/`feed_answers`, so comic generation is **not** forced into that feed-shaped
table; comic captures request/response on its own `comic_turns` and emits a structured
`[comic.inference]` console audit for parity (revisit if a comic-native inference log is needed).

## Security, Privacy, and Compliance Controls

1. **No-bad-info guarantee:** below-threshold turns never show generated content — only a
   pre-approved preset — and are handed to a human.
2. **Supervision:** above-threshold auto-replies are still queued for owner review;
   safety-flagged turns are human-first.
3. **Consent:** LLM-processing consent verified before any generation (carry forward the
   current `llm_consent_granted` gate).
4. Server-side authz + CSRF on all state-changing routes; admin gating on review/training.
   **Implemented:** `_lib.requireComicReadAccess` / `requireComicAdminAccess` /
   `ensureMutationCsrf` (mirrors feed `_lib`).
5. Audit: allow/deny logged via `lib/comic/audit.ts` (`logComicAudit`, pluginId `comic`);
   generation logged via the `[comic.inference]` structured console audit (see Data Model note
   on the `llm_inference_log` FK constraint). Sensitive-payload redaction is a later pass.
6. Server-side-only Rasa/Ollama calls; no third-party LLM egress.
7. Deletion: `COMIC_PROFILE_AND_DELETION_CONTRACT.md` authored (draft) — documents what is
   purged on service/account deletion across the comic tables; CASCADE FKs mean deleting a
   conversation removes its turns/queue/training rows.

## Web and Android Delivery Status

Target: `web+android` parity.

- **Web backend: complete (foundation).** Schema (`comic_*` tables), library
  (`lib/comic/{types,constants,audit,rasa,policy,repository}.ts`), server-only API
  (`/api/comic/message`, `/api/comic/review`, `/api/comic/review/[turnId]/resolve`,
  `/api/comic/training/export`), contracts, and a deterministic seed are landed. `@comic`
  mention routing, conversation/turn capture, Ollama drafting, the human-in-the-loop review
  queue, correction→training, and Rasa NLU export are implemented. Interim policy forces human
  review on every draft (Rasa undeployed).
- **Web UI: not started — design-gated (rule 127).** No `@comic` chat rendering, no owner
  review/correction console. `DESIGN PASS REQUIRED` for both surfaces (see this file's "Design
  Status & Guidance — Missing"). No React/`.tsx` was created in this pass.
- **Android: not started.** Deferred behind the web UI + a running Rasa; tracked for parity
  (`plugin-parity-contracts.json` entry to be added when the mobile feature lands).
- **Still deferred:** standing up the Rasa service + tracker store; replacing the home-chat
  `getActionForText` router with Rasa-backed routing; the layered content filter / threshold
  tuning; RAG grounding.

## Seed Coverage Status

**Implemented:** `ctf/scripts/seedComicPhase0.mjs` (deterministic UUIDs, idempotent
`ON CONFLICT (id) DO UPDATE`). Seeds: one conversation; five turns (housing + services
question/draft pairs, plus a safety-flagged user turn); a populated `comic_review_queue`
(one pending interim-review draft, one corrected/resolved item, one pending safety-flagged
human-first turn); two `comic_training_examples`. Requires `DATABASE_URL`.

The `@comic` bot profile previously sketched against the dropped `hub_bots` design is not
reseeded here; `@comic` is a fixed system mention, not a `hub_bots` row, in the real data layer.

## Gaps and Known Technical Debt

1. Three disconnected precursors + a dropped `hub_bots` design; no running Rasa, no `@comic`
   routing, no conversation store, no human-in-the-loop (verified 2026-05-31).
2. `exportQuestionsForRasa` has a duplicate nested loop that double-counts examples.
3. Confidence, "approved sources," moderation, and token counts are overstated in the feed
   inventory relative to code — reconcile there (coordinate with the feed-plugin agent).
4. Single LLM provider, no failover (carried from feed gap #1).
5. The Hub message path (`POST /api/hub/messages`) is a stub; `@comic` routing depends on
   wiring it to the Feed/comic data layer first.
6. `@comic` persona is defined against dropped `hub_*` tables; persona + data layer must be
   reconciled with the Hub consolidation.

## Future Notes (deliberately deferred — do not get bogged down now)

- **Threshold tuning + layered content filter.** The owner's research describes a full
  moderation pipeline (rule prefilter → ML classifier → embedding similarity → policy
  thresholds → transform/block/escalate → audit + threshold calibration) — the intended
  safety layer riding alongside Rasa's fallback. Target only; concrete thresholds,
  classifier choice, and the preset copy are a later pass (preset copy needs brand-voice
  review).
- **RAG / grounding.** Replace display-only source labels with real retrieval against
  approved CTF data so answers are grounded, not just attributed.
- **Replace `getActionForText`.** Move plugin routing from the hardcoded client keyword map
  to Rasa-backed routing (already on the Hub consolidation roadmap).

## Design Status & Guidance (design submodule @ `a460914`)

Pulled 2026-05-31 (`design` `origin/main`, ahead of the pinned pointer). Designs are
placeholder-data mockups; **this inventory is the authoritative spec.** A design-pointer
bump is a separate step (rule 128), not part of this docs work.

**Covered — adopt as-is:**
- AI answer card in the unified community stream: cyan treatment, Sparkles avatar, label
  **"AI Assistant"**, **🤖 AI Q&A** badge, "Asked by … · time", Q:/A: layout
  (`Desktop.tsx`, `HubPublic.tsx`), interleaved with announcement + community-post cards.
- Public (unauthenticated) stream shows AI answers read-only ("sign in to post or ask the
  assistant").

**Modify — design diverges from a locked decision:**
- **Composer:** design uses a post/ask mode toggle; the owner kept **`@comic`-mention** as
  the trigger. Use the normal chat input; typing `@comic …` routes to the assistant. Remove
  the post/ask toggle.

**Missing — no mockup yet; must be designed before that UI is built (gated):**
1. **AI answer "pending human review" state** — interim mode holds every AI draft for owner
   approval before the asker sees it. Show the asker "AI Assistant is preparing an answer — a
   teammate is reviewing"; never surface a partial/unreviewed answer publicly.
2. **Owner review/correction console** (admin) — queue of pending drafts; approve/edit/reject;
   show question, model draft, sources, confidence; corrected-text path; empty + loading.
3. **LLM-consent affordance** at first `@comic` use (one-time consent to AI processing).
4. **Rating control** on AI cards (helpful / not_helpful / flagged).

Required states per rule 126 for the AI surfaces: Unauthenticated, Auth+Loading (generating /
review pending), Auth+Empty (no Q&A yet), Auth+Populated (answered).

## Change Log

- 2026-05-31: Built the production backend foundation (non-UI) on `feat/comic-ai-assistant`.
  Added the `comic_*` schema (conversations, turns, review queue, training examples) with
  guarded DDL + CASCADE FKs; `lib/comic/{types,constants,audit,rasa,policy,repository}.ts`
  (mention detection, input moderation, keyword safety-category detection, interim
  force-human-review, conversation/turn capture, Ollama drafting reusing
  `SURVIVOR_SYSTEM_PROMPT`, review queue create/list/resolve, correction→training,
  Rasa NLU YAML export); server-only API under `/api/comic/` (`message`, `review`,
  `review/[turnId]/resolve`, `training/export`) mirroring the feed `_lib` authz/CSRF;
  `COMIC_PLUGIN_{COMMAND,ACCESS_POLICY,AUDIT}_CONTRACTS.yaml` + `COMIC_PROFILE_AND_DELETION_CONTRACT.md`
  (namespace `comic.*`); and `seedComicPhase0.mjs`. Interim policy: Rasa undeployed
  (`isRasaConfigured()` false) → every `@comic` draft is enqueued for human review and the
  asker sees only a safe holding response. Web build + typecheck + lint pass. **All UI is
  deferred (design-gated, rule 127): `DESIGN PASS REQUIRED` for `@comic` chat rendering and the
  owner review/correction console.**
- 2026-05-31: Pulled design `a460914`; reconciled to owner decisions — `@comic` mention stays
  the trigger (design toggle superseded), adopt the "AI Assistant" reply treatment, keep the
  `comic` internal slug. Added Design Status & Guidance (covered / modify / missing) to steer
  the design agent.
- 2026-05-31: Created. Captured owner-locked decisions (`@comic` invocation; Rasa+Ollama
  target; hybrid confidence/safety with a safe preset below threshold; human-in-the-loop
  CDD flywheel for 62→5M; deterministic conversation/training tables + Rasa tracker store).
  Corrected an initial draft that mislabeled the subsystem "greenfield": documented the
  three existing precursors (Feed direct-Ollama Q&A, the `exportQuestionsForRasa` Rasa NLU
  export, the `use-home-chat` router) and the existing `@comic` persona/`hub_bots` design.

## Build Checklist

Ordered; dependencies noted; no phases. A task with no dependency can run anytime.

- [x] Lock owner decisions (this document). No dependencies.
- [x] Confirm table-name prefix (`comic_*`) and `@comic` placement (dedicated file =
      source of truth; Hub inventory points here). Decided 2026-05-31.
- [x] Add the conversation/training schema. (Rasa SQL tracker store deferred — Rasa undeployed.)
  - Done 2026-05-31: `comic_*` tables in `ctf/schema.sql`, guarded DDL, CASCADE FKs; drift gate
    satisfied by the schema.sql change.
- [x] Implement `@comic` mention routing; no-`@` stays peer.
  - Done 2026-05-31: `POST /api/comic/message` + `policy.mentionsComic`/`routeComicMessage`.
    Non-mentions return `routedToAssistant:false` and never reach the bot.
- [x] Capture every `@comic` turn; compute safety; branch draft+queue vs human-first.
  - Done 2026-05-31: every turn captured; safety-flagged → human-first (no draft);
    non-flagged → Ollama draft enqueued to review (never auto-published). Confidence-gated
    auto-reply waits on Rasa (interim force-human-review).
- [ ] Owner review/correction console. **UI — DESIGN PASS REQUIRED before building.**
  - Backend done 2026-05-31 (`GET /api/comic/review`, `POST /api/comic/review/[turnId]/resolve`;
    approve/edit/reject; corrections persist as `comic_training_examples`). UI design-gated.
- [ ] Stand up self-hosted Rasa; tracker store on Neon; custom action → Ollama; consume the
      (fixed) NLU export.
  - Blocked by: schema. Parallel to routing/console. Acceptance: Rasa returns intent + real
    confidence; custom action calls Ollama with graceful fallback; export double-loop fixed.
- [ ] Replace home-chat `getActionForText` with Rasa-backed routing.
  - Blocked by: running Rasa. Acceptance: keyword map retired; routing comes from Rasa.
- [ ] Export corrected turns → Rasa training; retrain loop; raise the auto-respond threshold
      as data accumulates.
  - Export mechanism done 2026-05-31: corrections persist to `comic_training_examples`;
    `GET /api/comic/training/export` emits Rasa NLU YAML (single loop, no double counting).
    Still blocked by Rasa for the retrain loop + threshold raise.
- [x] Author `comic.*` command / access-policy / audit / deletion contracts.
  - Done 2026-05-31: `COMIC_PLUGIN_{COMMAND,ACCESS_POLICY,AUDIT}_CONTRACTS.yaml` +
    `COMIC_PROFILE_AND_DELETION_CONTRACT.md` (commands `comic.message.route`,
    `comic.reply.generate`, `comic.review.resolve`, `comic.training.export`).
- [x] Deterministic `seedComicPhase0.mjs`.
  - Done 2026-05-31: seeds a conversation, turns, a populated review queue, and training set.
- [ ] Android parity for `@comic`.
  - Blocked by: routing + turn capture. Acceptance: mention, reply, preset, rating work on
    Android; `plugin-parity-contracts.json` updated.
- [ ] Reconcile feed-inventory overstatements + Hub `@comic` persona section.
  - No hard dependency; coordinate with the feed-plugin agent to avoid a merge conflict.
