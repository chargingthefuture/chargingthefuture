# comic AI Assistant Feature Inventory (CTF v3)

> UPDATE 2026-06-14 — Rasa removed; this supersedes the Rasa parts below.
> The self-hosted Rasa NLU service (`ctf-rasa`) and its backend client (`lib/comic/rasa.ts`) were
> removed. Rasa only attached an intent + confidence label to each turn for the reviewer; it never
> generated answers and never gated auto-publish. Wherever this document describes a "target
> architecture" of Rasa + Ollama, Rasa orchestration, a Rasa training/retrain loop, a Rasa SQL
> tracker store, or Rasa-backed routing, treat it as cancelled history, not the plan.
>
> Current and intended direction: generation is Ollama only; every `@comic` answer still goes
> through human review (`policy.forceHumanReview()` is unconditionally `true`). The `engine` enum
> still lists `rasa` and the `intent`/`nlu_confidence` columns remain, but only for historical rows
> — nothing writes them now. The training-example export (`GET /api/comic/training/export`) is kept
> as a portable dataset of asker questions + owner-labelled corrections for whatever model is
> trained later. The path to scale is: upgrade the self-hosted Ollama model on a GPU host (issue
> #502), then build retrieval and a confidence/safety gate, and later fine-tune an open model on the
> exported, de-identified dataset. A third-party API (e.g. Claude) is off the table for survivor
> question text on privacy grounds.

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
   store** in the same Neon Postgres. The existing `llm_inference_log` reuse note holds only
   as a pattern reference — its NOT-NULL FKs target the feed tables, so comic emits a
   structured `[comic.inference]` console audit instead of writing rows there (see Data Model).
   Answer ratings are **not** reused from `feed_answer_ratings` (that table is FK'd into
   `feed_answers` and cannot host comic turns); comic ratings live in the dedicated
   `comic_answer_ratings` table. Seed UUIDs are deterministic.
   - **Naming = `comic_*` (confirmed 2026-05-31).** Matches the dominant `<domain>_*`
     convention used by all ~156 domain tables (`feed_*`, `chyme_*`, …); the `ctf_` prefix
     stays reserved for the one global table (`ctf_plugin_registry`).

## Owner-Locked Decisions (2026-06-14) — supersede #2, #4, #5 above

These replace the Rasa-based decisions and are settled; do not relitigate.

1. No third-party AI service for survivor question text. `@comic` questions can carry location,
   identity, and abuse details, so the text must not leave our infrastructure. A hosted API
   (e.g. Claude) is therefore off the table for drafting `@comic` answers. Generation stays
   self-hosted.
2. Rasa is removed (see the note at the top of this file). It only produced reviewer-side intent
   labels, never generated answers, and never gated auto-publish — not worth its hosting cost. The
   `engine` enum's `rasa` value and the `intent`/`nlu_confidence` columns remain for historical
   rows only.
3. Generation is self-hosted Ollama, to be upgraded. Near term, move `ctf-ollama` from the weak
   CPU `llama3.2` to a stronger open model on a GPU host (issue #502). The deterministic template
   fallback stays for when Ollama is unreachable.
4. The human-in-the-loop work is the dataset. Every captured turn plus the owner's approve/correct
   decision and the `helpful/not_helpful/flagged` rating is the training set. It lives in the
   `comic_*` tables and is exportable via `GET /api/comic/training/export`. The owner answering
   questions now is building this dataset, not just clearing a queue.
5. Path to scale (no model-training shortcut). The model does not learn from answers automatically.
   Order: (a) capture the dataset cleanly now; (b) build a retrieval layer so new drafts are
   grounded in the owner's approved answers; (c) once there is volume, fine-tune an open model on
   the exported, de-identified dataset and serve it self-hosted. Strategy tracked in its own issue.
6. Human review stays at 100% (`policy.forceHumanReview()` unconditionally `true`) until a
   confidence/safety gate is built and tested. No confidence-based auto-publish exists yet.

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
- Owned data layer: `comic_*` conversation/training/rating tables + (target) a Rasa tracker
  store. `llm_inference_log` and `feed_answer_ratings` are **not** reused (their FKs target the
  feed tables); comic uses a `[comic.inference]` console audit and the `comic_answer_ratings`
  table instead.
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
| Human-in-the-loop | None (answers return directly; `flagged` rating exists, no queue) | Owner review/correction dashboard; CDD loop |
| Conversation store | None (single-turn `feed_questions`/`feed_answers`) | Multi-turn `comic_*` + Rasa tracker |

## User Features

1. Reach the assistant with `@comic <question>`; reply renders inline.
2. Peer-to-peer messages (no `@`) are never sent to the bot.
3. When unsure, the bot shows a clear pre-approved holding response and hands the question
   to a human — the user is never shown speculative content.
4. Users can rate any answer (`helpful / not_helpful / flagged`) — feeds the training loop.
5. **Contribute your own writing (`/knowledge`).** The path is `/knowledge`, deliberately **not**
   `/contribute` — the Contributions plugin is a different thing entirely (the fundraiser and donation
   surface), and two member-facing paths a word apart would be a standing source of confusion (owner
   decision, 2026-07-29). The screen is titled "Knowledge library" for the same reason. A member can lend their own public Quora
   answers and posts to the assistant's reference library, so the bot answers from more than one
   person's experience. **Two ways, and picking a few posts is the default (owner decision,
   2026-07-29):** most people's public writing is mixed — dating, politics, faith, memes — and
   *nothing in this pipeline sorts on-topic from off-topic automatically*, so an export would make the
   reviewer read hundreds of posts to find a handful. Picking puts that choice with the author, who
   knows instantly which posts belong, and is the more honest consent: choosing three posts is
   knowing exactly what you are giving, where handing over an archive is agreeing in bulk to things
   you have forgotten you wrote. It also carries no upload at all.
   - **Pick a few posts (default).** For each, paste the Quora link and the post's text (up to 20 per
     submission). **Nothing fetches the link** — it is provenance, so a reviewer can confirm the post
     is public and the contributor's; scraping would inherit the exact link-rot fragility that got
     URLs stripped from the corpus in the first place. Only quora.com links are accepted, duplicates
     within one submission are rejected, and a post under 120 characters is refused up front (not a
     quality judgement — a couple of lines cannot ground an answer, and saying so now saves the wait).
   - **Whole export.** For the rarer member whose public writing is nearly all on-topic: they get the
     Quora export (Settings → Privacy → Download your information) and upload the `.zip` exactly as
     it arrived. On the same page they read and tick
   six consent statements — one checkbox each, no bundled "agree to all" — covering: it is their own
   public writing; the one use permitted; they keep every right; they can withdraw; a human reads it
   and not everything is used; parts naming other people may be cut. An optional box asks whether
   anyone else is named, so a reviewer knows to look.
   On arrival the export is parsed **in memory** and only the public sections are kept — inbox
   messages, drafts, and profile data are discarded before any person opens it, and **the `.zip`
   itself is never stored**. The member does not have to clean the file first. They immediately see a
   receipt naming how many pieces were kept and what was thrown away.
6. **Withdraw a contribution** at any time from the same page. Withdrawal deactivates every
   knowledge row that contribution produced, in the same transaction — real because the assistant
   *retrieves* from a table at answer time rather than being trained on the text.

## Target Admin / Owner Features

### Contributed-writing review (`/admin/comic/contributions`, shipped 2026-07-29)

1. Queue of contributions waiting to be read, each showing the **actual writing** — the decision
   cannot be made from a summary. The contributor's own note about third parties is surfaced at the
   top of the card, not buried with the text, because that is the thing to check before promoting.
2. Per-entry **Leave out / Put back**. Nothing is excluded by default: the reviewer opts a post OUT
   after reading it rather than opting each one in, so a skim cannot silently drop someone's writing.
3. **Accept** promotes the kept entries into `comic_knowledge_entries` — the moment a member's
   writing becomes something the assistant can quote — stamping `contribution_id` on each row so
   withdrawal and account deletion can still reach it. `content_hash` uses the same formula as
   `importComicKnowledge.mjs` with `ON CONFLICT DO NOTHING`, so two members quoting the same
   widely-shared passage collapse onto one row instead of duplicating it.
4. **Decline** requires a reason, which the contributor reads on their own page. A decline nobody can
   understand reads as a judgement on what they lived through.
5. **ServiceCredits recognition grant** on accept: a flat 100 credits per accepted contribution
   (flat, not per-post — paying by volume would reward padding, and the reviewer would end up arguing
   about counts with people already having a hard week). **Only a member who has finished Unlock
   receives credits** (owner decision, 2026-07-29); anyone signed in may contribute. `granted_at` is
   stamped before the mint and the mint carries a per-contribution idempotency key, so a retried
   review, a double-click, or a crash between the two cannot mint twice. The admin screen states which
   of granted / not-yet-verified / already-granted / failed happened, so a skipped grant never looks
   like a silent no-op.

1. **Review & correction dashboard** — queue of bot turns awaiting review; approve, edit, or
   reject; corrections become training examples. **[Web UI delivered — design `9a4a1af`; at
   `/admin/comic`. 4 states: queue / empty / loading / detail-edit.]**
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
- `POST /api/comic/contributions` (`comic.contribution.submit`) — signed-in member. Accepts either
  **`kind=links`** (the default: pasted posts, each with a quora.com URL as provenance — nothing is
  fetched) or **`kind=export`** (a Quora export `.zip`, multipart, 25 MB cap), plus the consent
  payload. **Consent is validated before the
  file is read at all**, and the submitted `consentVersion` must match the current
  `CONTRIBUTION_CONSENT_VERSION` (a cached older page is refused rather than recorded as having
  agreed to wording it never showed). The archive is read in memory — only `index.html` is
  decompressed, entry names are validated, and a decompressed-size ceiling guards against a zip
  bomb; nothing is written to disk or executed. Public sections are kept, everything else discarded.
  Rate-limited to 5 per member per 24h. Audits the **consent**, never the content.
- `GET /api/comic/contributions` — signed-in member. The caller's own contribution history.
- `POST /api/comic/contributions/[id]/withdraw` (`comic.contribution.withdraw`) — signed-in member,
  own contribution only (scoped inside the query, so another member's id is indistinguishable from a
  missing one). Marks it withdrawn and deactivates its `comic_knowledge_entries` rows in one
  transaction, so there is no window where it reads as withdrawn while still being quoted.
- `GET /api/comic/admin/contributions?status=<status>` — admin. The contribution review queue, each
  row with its entries so the reviewer reads the writing rather than a count.
- `POST /api/comic/admin/contributions/[id]/review` (`comic.contribution.review`) — admin. Accept
  (promoting the chosen entries into `comic_knowledge_entries` and making the ServiceCredits
  recognition grant) or decline (a reason is **required** — the contributor reads it). Promotion and
  the status flip share one transaction, so a half-accepted contribution cannot exist. The grant runs
  after promotion and is allowed to fail without undoing it: a mint outage must not cost the library
  the writing or make the reviewer redo the reading.
- `GET /api/comic/review` (`comic.reply.generate` data surface) — admin. Paginated list of
  pending review items (asker question + draft + intent/confidence + safety category).
- `POST /api/comic/review/[turnId]/resolve` (`comic.review.resolve`) — admin. Approve / correct
  (edit) / reject a queued draft; a correction persists a `comic_training_examples` row.
- `GET /api/comic/training/export` (`comic.training.export`) — admin. The de-identified training
  dataset: owner corrections (asker questions grouped by intent label, the NLU YAML `nlu:` block /
  the JSON `byIntent` map) **plus** the human feedback signal — every answered turn paired with its
  question text, published answer text, and most-recent helpful/not_helpful/flagged rating + when it
  was rated (`ratedAnswers` in JSON; YAML comments in the download). No user id or other PII — text +
  rating value + timestamps only. JSON via `?format=json`; YAML is the default download.
- `GET /api/comic/admin/ai-status` (`comic.ai.status`) — admin. Read-only live status of the Ollama
  drafting backend (configured / reachable / latency). An admin diagnostic probe only — it no longer
  backs a UI badge. The always-"reachable" engine badges were removed because they only pinged the
  endpoint's liveness (`/health` or `/api/tags`), not whether a real draft would succeed, so they
  read "reachable" while "Generate draft" failed. The real drafting outcome now comes from the
  synchronous regenerate action, which reports the actual failure reason.
- `GET /api/comic/admin/training-stats` (`comic.training.stats`) — admin. Read-only at-a-glance
  counts for the dashboard: total non-discarded `comic_training_examples` (with a pending/exported
  breakdown) and the number of distinct rated answered turns. Aggregate counts only — no PII.
- `GET /api/comic/conversation` (`comic.conversation.read`) — member/approved-or-admin. The
  asker-facing read powering the unified stream: returns the **requesting user's own** @comic Q&A
  items as answered cards (approved/corrected reviews only) or pending "Reviewing for safety" cards.
  **Never returns an unreviewed draft** (repository suppresses any non-approved/corrected answer
  body) and is scoped to the caller's conversations.
- `POST /api/comic/answers/[turnId]/rate` (`comic.answer.rate`) — member/approved-or-admin + CSRF.
  Rate an answered turn `helpful | not_helpful | flagged`. The repository enforces the turn is one
  the caller may rate (own conversation, review resolved approved/corrected); one rating per
  (user, turn), re-rating updates in place. Mirrors the feed answer-rating pattern; feeds the CDD
  flywheel.

Engine reality (2026-06-14): Ollama is the only AI engine. The Rasa NLU service and
`lib/comic/rasa.ts` were removed. `routeComicMessage` no longer calls any NLU service, so the user
turn's `intent` + `nlu_confidence` are left null. `policy.forceHumanReview()` returns `true`
unconditionally, so **every** `@comic` answer still goes to human review. Generation happens in the
app via Ollama (`generateComicDraft`), with a deterministic template fallback when Ollama is
unconfigured or unreachable.

### Target (`@comic`)
- Mention routing also to ride the Hub message path (`POST /api/hub/messages`) once that stub
  is wired; today the dedicated `POST /api/comic/message` is the server entry point.
- Auto-reply branch (above-threshold) is **deferred**. There is no model-derived confidence now
  (Rasa removed), so `forceHumanReview()` stays unconditionally true. A confidence/safety gate is
  future work, after an Ollama model upgrade (issue #502) and a retrieval layer.
- Ollama is reached **server-side only**; no third-party LLM egress. Ollama is self-hosted, so
  survivor question text never leaves our infrastructure — the privacy reason a third-party API is
  not used here.

## Data Model and Storage Contracts

**Conversation/training tables (`comic_*`; implemented in `ctf/schema.sql` with guarded DDL —
`CREATE TABLE IF NOT EXISTS` + per-column `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`;
FKs `ON DELETE CASCADE` except `comic_review_queue.answer_turn_id` which is `ON DELETE SET NULL`).
Enum/range columns are guarded by named, idempotent CHECK constraints (DO-block pattern) so legacy
DBs converge: `comic_conversations(channel, status)`, `comic_turns(role, engine, nlu_confidence
0..1)`, `comic_review_queue(status)`, `comic_training_examples(status)`,
`comic_answer_ratings(rating)`:**

1. `comic_conversations` — a chat thread (`id` uuid pk, `user_id` text, `asker_username` text null
   [the asker's @username snapshotted at ask time, shown in the review dashboard in place of the raw
   user id; null for rows created before this was captured], `channel` text [hub|feed], `status` text
   [open|closed], `created_at`, `updated_at`). Indexed on `user_id`, `created_at`.
2. `comic_turns` — one row per turn, including `grounding_entry_ids` (jsonb array, default `[]`;
   the `comic_knowledge_entries` ids injected as grounding when a bot draft was generated —
   added 2026-07-23) (`id` uuid pk, `conversation_id` uuid FK→comic_conversations,
   `role` ∈ user|bot|human, `body`, `intent` text null, `nlu_confidence` numeric(5,4) null [0..1],
   `engine` ∈ rasa|ollama|template|human, `linked_plugin_slugs` jsonb not null default `'[]'`,
   `created_at`). Indexed on `conversation_id`, `created_at`. `linked_plugin_slugs` holds the
   applicable plugins a reviewer tagged when publishing an answer (approve/correct) — a JSON array of
   plugin slugs validated against the visible plugin registry, deduped, and capped at 5; rendered as
   tappable plugin links beneath the published answer. Empty array = no links (default for all
   non-answer turns).
   **`intent` + `nlu_confidence` on the user turn are Rasa-sourced when `RASA_BASE_URL` is set**
   (`routeComicMessage` → `parseComicIntent` → `/model/parse`); they remain null when Rasa is
   unconfigured or the parse fails (graceful degradation). Bot/draft turns keep null intent/confidence.
3. `comic_review_queue` — supervision state (`id` uuid pk, `turn_id` uuid FK→comic_turns
   ON DELETE CASCADE, `status` ∈ pending|approved|corrected|rejected, `reviewer_user_id` null,
   `corrected_body` null, `answer_turn_id` uuid null FK→comic_turns ON DELETE SET NULL,
   `draft_turn_id` uuid null FK→comic_turns ON DELETE SET NULL,
   `reason` null, `created_at`, `decided_at` null). Indexed on `status`, `turn_id`,
   `answer_turn_id`, `created_at`. (`reason` carries `safety:<category>` for human-first turns or
   `interim_human_review` for drafts.) `turn_id` always points at the asker's question turn (never
   repointed), so the question is inferred stably. `draft_turn_id` is the background-generated AI
   draft bot turn (null = human-first, no AI draft); the reviewer reads the draft from it and
   approving publishes it. `answer_turn_id` is the published turn the asker sees + rates
   once a review is approved/corrected — an approved bot draft, or the reviewer's `human` turn for a
   correction / approved human-first turn; null while pending/rejected so an unreviewed draft is
   never surfaced. Named CHECK constraints (`comic_review_queue_status_check`) guard the status enum
   on legacy DBs.
4. `comic_training_examples` — **training input #1: owner corrections.** Curated supervised
   examples (`id` uuid pk, `source_turn_id` uuid FK→comic_turns, `intent_label` text, `text` text,
   `entities` jsonb default `[]`, `story` jsonb null, `status` ∈ pending|exported|discarded,
   `exported_at` null, `created_at`). Indexed on `intent_label`, `status`, `source_turn_id`. A row is
   written whenever the owner *corrects* a draft in review (`resolveComicReview`). Exported by
   `exportComicTrainingExamples()` as the intent→texts map.
5. `comic_answer_ratings` — **training input #2: the human feedback signal.** One rating per answered
   turn per user (`user_id` text, `turn_id` uuid FK→comic_turns ON DELETE CASCADE, `rating` ∈
   helpful|not_helpful|flagged, `created_at`, `updated_at`; composite pk `(user_id, turn_id)`).
   Indexed on `turn_id`. One rating per user per answered turn; re-rating updates in place. Added
   2026-05-31 with the web UI — `feed_answer_ratings` is FK'd into `feed_answers` and cannot host
   comic turns, so comic gets its own ratings table. **As of 2026-06-21 these ratings are part of the
   training export:** `exportComicRatedAnswers()` joins each rated answered turn back to its question
   and published answer text and the most-recent rating, de-identified (no user id, no other PII), and
   `GET /api/comic/training/export` returns them alongside the owner corrections.

Together, `comic_training_examples` (owner corrections) and `comic_answer_ratings` (helpful /
not_helpful / flagged ratings) are the **two training inputs** for the @comic assistant. See the
"Training dataset & how to begin fine-tuning" subsection below for how they are exported and used.

6. `comic_knowledge_entries` — **retrieval knowledge base for draft grounding (#504 retrieval
   step, added 2026-07-23).** Curated, redacted excerpts of the owner's public writing that ground
   AI drafts at generation time (`id` uuid pk, `source` ∈ quora_export|github_wiki|approved_answer,
   `entry_type` ∈ answer|post|comment|submission|wiki, `title` null, `question` null, `content`
   text, `content_hash` text UNIQUE — idempotent imports, `active` boolean default true — the
   curation off-switch, `authored_at` null, `created_at`). Full-text search runs over
   question+title+content via the GIN expression index `idx_comic_knowledge_entries_search`;
   also indexed on `active`. Populated by `ctf/scripts/importComicKnowledge.mjs` from the JSONL
   files produced by `parseQuoraExportToComicDataset.mjs` / `parseWikiToComicDataset.mjs`. At
   draft time `retrieveComicGrounding()` fetches the top 4 active entries ranked by
   `ts_rank`/`websearch_to_tsquery` and injects them into the Ollama model instructions; retrieval is
   best-effort (failure or no match → the draft runs ungrounded, as before). The draft turn
   records which entries grounded it in `comic_turns.grounding_entry_ids` (jsonb array, default
   `[]`) so grounded vs ungrounded drafts can be compared on correction rate — the #504
   "measure" step.

7. `comic_contributions` — **member-contributed writing, and the consent that permits using it
   (added 2026-07-29).** One row per submitted Quora export (`id` uuid pk, `user_id`, `status` ∈
   pending_review|accepted|declined|withdrawn, `consent_version` — WHICH wording the member read, so a
   later edit to the form cannot retroactively be claimed as something an earlier contributor agreed
   to, `consent_granted_at`, `third_party_note` — the member's own statement about anyone named in
   their posts, `entry_count`, `discarded_sections` jsonb — what the automatic strip threw away, shown
   back as the contributor's receipt, `reviewed_by`/`reviewed_at`/`decline_reason`, `granted_at` —
   set once the ServiceCredits recognition grant is made so a re-review cannot double-grant,
   `withdrawn_at`, `created_at`, `updated_at`), plus `kind` ∈ links|export — which path was used;
  `links` is the default and carries no upload at all. Indexed on (`user_id`, `created_at` desc) and
   (`status`, `created_at` desc).
   **What is deliberately NOT stored: the uploaded `.zip`.** The archive is parsed in memory and
   discarded with the request — there is no file at rest to leak and nothing to delete later. Inbox
   messages, drafts, and profile data never reach this table at all; they are dropped by the
   allowlist in `lib/comic/quora-export-intake.ts` before any human sees them.
8. `comic_contribution_entries` — the surviving public entries of one contribution, held for review
   (`id` uuid pk, `contribution_id` uuid FK → `comic_contributions` ON DELETE CASCADE, `entry_type` ∈
   answer|post|comment|submission, `question` null, `content` text, `source_url` text null — the
   Quora link for a picked post, kept as provenance and never fetched, `knowledge_entry_id` uuid null —
   set once a reviewer promotes it, so re-running review is safe, `excluded` boolean, `authored_at`
   null, `created_at`). Indexed on `contribution_id`. **Nothing here is visible to the assistant** —
   an entry only reaches the bot once it is copied into `comic_knowledge_entries`. The gap between
   these two tables *is* the human review step.

**Rasa tracker store:** Rasa's own SQL event store, provisioned in the same Neon Postgres
(managed by Rasa, not hand-authored here). **Still deferred** — the scaffolded Rasa service is
**NLU-only** (`/model/parse` is stateless and needs no tracker store); `endpoints.yml` leaves the
`tracker_store` block commented. Provision it only when stateful dialogue (stories) is added.

**Reused:** Note: `llm_inference_log` has NOT-NULL FKs into `feed_questions`/`feed_answers`, so
comic generation is **not** forced into that feed-shaped table; comic captures request/response on
its own `comic_turns` and emits a structured `[comic.inference]` console audit for parity (revisit
if a comic-native inference log is needed). The feed `feed_answer_ratings` table is **not** reused
for comic answers (its FK targets `feed_answers`); comic ratings live in `comic_answer_ratings`.

### Training dataset & how to begin fine-tuning

This subsection is the single place a future engineer (or the owner) needs to read to pick up the
fine-tuning step. The model does **not** train itself: nothing auto-learns, nothing auto-notifies the
owner. Fine-tuning is an owner-initiated step, done by hand when the owner decides there is enough
data.

**What the dataset is.** Two human signals, both accumulated as members and the owner use @comic:

1. **Owner corrections** — every time the owner *corrects* a draft answer in the review dashboard, the
   asker's question is saved as a row in `comic_training_examples` (with the intent label the owner's
   resolution implied). This is the supervised "here is a better answer" signal.
2. **Helpful / not-helpful / flagged ratings** — every time an asker rates an answer they received,
   one row is saved/updated in `comic_answer_ratings` (one rating per person per answer). This is the
   "did the answer actually help" signal.

**Where each lives.** `comic_training_examples` and `comic_answer_ratings` (both in `ctf/schema.sql`).
The export logic is in `ctf/packages/web/lib/comic/repository.ts`:
`exportComicTrainingExamples()` (the corrections, grouped by intent) and `exportComicRatedAnswers()`
(the rated answers, de-identified). The published answer and question text are read back from
`comic_turns` / `comic_review_queue`.

**How to export it.** Call `GET /api/comic/training/export` (admin only, same gate as the rest of the
@comic admin). Two formats:
  - `?format=json` → `{ ok, totalExamples, byIntent, ratedAnswers }`, where `byIntent` is the
    corrections map (`intent → [question text]`) and `ratedAnswers` is
    `{ question, answer, rating, ratedAt }[]` — every rated answer, de-identified.
  - default (no `format`) → a downloadable NLU-style YAML file with the corrections as the `nlu:`
    block and the rated answers appended as YAML comments so the file stays a valid training file
    while still carrying the feedback signal.
  No user id or any other PII is ever included in either format — question/answer text, the rating
  value, and timestamps only.

**Privacy note.** Because Ollama is self-hosted (server-side only, no third-party LLM egress), the
exported text never has to leave our infrastructure to be used for training.

**At-a-glance counter.** `GET /api/comic/admin/training-stats` returns
`{ trainingExamplesTotal, trainingExamplesByStatus, ratedAnswersTotal }`. The @comic review dashboard
shows this in the queue header as "Training examples collected: N (… awaiting export · … exported ·
… rated answers)" so the owner can see at a glance how much data has accumulated. The breakdown is
by training-example export status; "awaiting export" was previously labelled "pending", which read
confusingly next to the review queue's own "N pending" badge (the two count different things — export
status vs. queued reviews). It is read-only and best-effort — if the count fails to load it is simply
hidden, never blocking the review queue.

**To begin fine-tuning** (owner-initiated, future): export the dataset via the route above, convert
the corrections + rated answers into the chosen model's fine-tuning format, run the fine-tune against
the self-hosted Ollama model, and swap the served model. None of this is automated yet by design;
this counter and export exist so the data is ready the moment the owner chooses to start.

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

Delivery: **web + mobile-responsive complete**. **Android (React Native) surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA). (Note: the native Commons/Chyme chat that remains on Android is covered by the Chyme inventory; the `@comic` AI-assistant surfaces are web-only.)

- **Web backend: complete (foundation).** Schema (`comic_*` tables), library
  (`lib/comic/{types,constants,audit,rasa,policy,repository}.ts`), server-only API
  (`/api/comic/message`, `/api/comic/review`, `/api/comic/review/[turnId]/resolve`,
  `/api/comic/training/export`), contracts, and a deterministic seed are landed. `@comic`
  mention routing, conversation/turn capture, Ollama drafting, the human-in-the-loop review
  queue, correction→training, and Rasa NLU export are implemented.
- **Rasa NLU service: scaffolded + integrated (not yet trained/deployed in prod).** The
  `ctf-rasa` private Render pserv (`ctf/ops/rasa/`: `config.yml` DIET+FallbackClassifier pipeline,
  `domain.yml` with the 5 intents, seed `data/nlu.yml`, `credentials.yml`, deferred `endpoints.yml`,
  `Dockerfile` that trains at build time) + the `build-images.yml` `ctf-rasa` image build +
  `render.yaml` pserv block. The backend `lib/comic/rasa.ts` now implements `parseComicIntent`
  (`POST /model/parse`, timeout + try/catch, nulls on failure); `routeComicMessage` stores the real
  intent + `nlu_confidence` on the user turn when `RASA_BASE_URL` is set. **Policy is unchanged:
  `forceHumanReview()` returns true unconditionally — every answer is still human-reviewed.** A real
  `rasa train nlu`/deploy validation is required before enabling in prod (see RASA.md).
- **Web UI: complete** (design `9a4a1af`, locked/owner-approved). Two surfaces delivered:
  - **Asker surface** in the unified community/home chat (`components/community-shell/`): AI
    Assistant answer cards (cyan #0EA5E9, Sparkles, "AI Assistant" label, 🤖 AI Q&A badge, Q/A)
    interleaved with hub messages; the `ai_pending` "Reviewing for safety" card; the unified
    composer (no post/ask toggle) with the `@comic` mention chip + helper copy "Type @comic to ask
    the AI Assistant"; the helpful/not-helpful/flag rating row; and the first-use consent modal
    (`comic-consent-modal.tsx`, gating `llm_consent_granted`). Wired to `POST /api/comic/message`
    (peer-to-peer when no `@comic`), `GET /api/comic/conversation`, and
    `POST /api/comic/answers/[turnId]/rate`. The asker-never-sees-an-unreviewed-draft invariant is
    enforced server-side (message route returns only a 202 holding response; the conversation read
    suppresses non-approved answer bodies) and reflected in the UI (pending card on submit).
    All four rule-126 states covered: Unauthenticated (read-only stream + locked composer with the
    @comic helper), Auth+Loading, Auth+Empty, Auth+Populated.
  - **Owner Review & Correction Dashboard** (`components/comic/comic-review-dashboard.tsx`) routed at
    **`/admin/comic`** (admin-gated server-side). All four states: queue (populated), empty (queue
    clear / "All caught up"), loading, and detail with editable corrected-text and Approve /
    Edit&approve / Reject actions; each item shows question, AI draft, provenance (engine/intent/
    safety category — real fields, no fabricated source documents), and confidence (the real
    `nlu_confidence`, now Rasa-populated on the user turn when `RASA_BASE_URL` is set, otherwise
    surfaced as "Not yet scored"). Wired to `GET /api/comic/review` and
    `POST /api/comic/review/[turnId]/resolve`.
- **Android: surface removed 2026-07-20 (rule 105, PR #1742)** — the `@comic` AI-assistant surfaces
  are now web-only, served by the installable web app (PWA). Historical detail (previously complete
  against design `9a4a1af`): the mobile `@comic` surfaces lived in
  `ctf/packages/mobile/src/features/comic/` and were wired into the mobile feed stream
  (`ctf/packages/mobile/src/features/feed/FeedStream.tsx`):
  - AI Assistant answer cards (cyan, Sparkles, "AI Assistant" label, 🤖 AI Q&A badge, Q/A layout)
    and the `ai_pending` "Reviewing for safety" card, interleaved with the feed timeline. Wired to
    `GET /api/comic/conversation` (asker-scoped; never surfaces an unreviewed draft).
  - The single-field `@comic` mention composer (no toggle) with the `@comic` chip + helper
    "Type @comic to ask the AI Assistant" (`ComicComposer.tsx`). Wired to `POST /api/comic/message`;
    the asker only ever sees a safe holding state (HTTP 202), never the draft.
  - First-use consent bottom sheet (`ComicConsentSheet.tsx`, matches `MobileAIConsent`) gating the
    `consentGranted` flag before any send.
  - The helpful / not_helpful / flag rating row, wired to `POST /api/comic/answers/[turnId]/rate`.
  - The Owner Review & Correction Dashboard (`ComicReviewDashboard.tsx`, matches `MobileAIReviewConsole`
    / `MobileAIReviewConsoleDetail` / `MobileAIReviewConsoleEmpty`) at the "AI Review" tile in the
    mobile app shell; admin-gated server-side (a non-admin sees an access notice). Queue chips +
    detail (question, AI draft, a dedicated **Confidence card** — band label + progress bar + a
    low-confidence safety note — and real provenance) + Approve&send / Edit&approve / Reject. The
    edit view now splits into a read-only **Original AI draft** ("Needs correction") beside an
    editable **corrected answer** with **Reset** and a character count, plus a **safety reminder
    banner**, matching `MobileAIReviewConsoleDetail`. Every publish/reject prompts a confirm dialog
    (`Alert.alert`). Wired to `GET /api/comic/review` and `POST /api/comic/review/[turnId]/resolve`.
    The mockup's fabricated "Sources" list and hardcoded confidence values are intentionally not
    reproduced — only the real `nlu_confidence` and provenance are shown, matching the web dashboard.
  - All requests send the `x-ctf-csrf: 1` header (mirrors the web CSRF handling) and target
    `/api/comic/*`. No third-party LLM egress.
  - Interim safety policy honored end-to-end: every answer routes through human review before it
    reaches the asker; there is no auto-publish path on mobile.
- **Still deferred:** a real `rasa train nlu`/deploy validation + setting `RASA_BASE_URL` in prod;
  the Rasa custom action that calls Ollama for generation; the SQL tracker store; raising the
  auto-respond threshold / any confidence-based auto-publish; replacing the home-chat
  `getActionForText` router with Rasa-backed routing; the layered content filter / threshold
  tuning; RAG grounding.

## Seed Coverage Status

**Implemented:** `ctf/scripts/seedComicPhase0.mjs` (deterministic UUIDs and a fixed
`decided_at` constant, idempotent `ON CONFLICT (id) DO UPDATE`). Seeds: one conversation; six
turns (housing + services question/draft pairs, the reviewer's published `human` answer turn for
the corrected services item, plus a safety-flagged user turn); a populated `comic_review_queue`
(one pending interim-review draft, one corrected/resolved item with its `answer_turn_id` linked to
the human answer turn, one pending safety-flagged human-first turn); two `comic_training_examples`.
Requires `DATABASE_URL`.

The `@comic` bot profile previously sketched against the dropped `hub_bots` design is not
reseeded here; `@comic` is a fixed system mention, not a `hub_bots` row, in the real data layer.

## Gaps and Known Technical Debt

1. Originally three disconnected precursors + a dropped `hub_bots` design. Now unified: `@comic`
   routing, conversation store, and the human-in-the-loop review queue are implemented; the
   **web UI** (asker stream + owner review dashboard) is delivered (2026-05-31, design `9a4a1af`); and
   the **Android UI** (asker cards + pending card + `@comic` composer + consent sheet + rating row +
   owner review dashboard) is delivered (2026-06-01, design `9a4a1af`). Still outstanding: a running
   Rasa (interim policy forces human review on every draft).
2. `exportQuestionsForRasa` has a duplicate nested loop that double-counts examples.
3. Confidence, "approved sources," moderation, and token counts are overstated in the feed
   inventory relative to code — reconcile there (coordinate with the feed-plugin agent).
4. Single LLM provider, no failover (carried from feed gap #1).
5. The Hub message path (`POST /api/hub/messages`) is a stub; `@comic` routing depends on
   wiring it to the Feed/comic data layer first.
6. `@comic` persona is defined against dropped `hub_*` tables; persona + data layer must be
   reconciled with the Hub consolidation.
7. Draft grounding retrieval (2026-07-23) is keyword full-text search (`websearch_to_tsquery`),
   not semantic/embedding retrieval — good enough to start measuring, but questions phrased with
   no word overlap against the knowledge base retrieve nothing. The embedding upgrade is
   unblocked (#502, the GPU host with the stronger model, closed 2026-07-22) and is follow-up
   work: serve an embedding model on the same self-hosted engine and rank by vector similarity.
   Knowledge-base curation is manual (`active` flag); no admin UI for it yet.

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

## Design Status & Guidance (design submodule @ `9a4a1af` — LOCKED, implemented)

The design pointer was bumped to `9a4a1af` (rule 128) and the web UI was built against it
(2026-05-31). This inventory remains the authoritative spec; the mockups carry placeholder data.

**Covered — adopted:**
- AI answer card in the unified community stream: cyan treatment, Sparkles avatar, label
  **"AI Assistant"**, **🤖 AI Q&A** badge, "Asked by … · time", Q:/A: layout
  (`Desktop.tsx`, `HubPublic.tsx`), interleaved with announcement + community-post cards.
- Public (unauthenticated) stream shows AI answers read-only with the locked composer ("Sign in to
  post — or type @comic to ask the AI Assistant…").

**Modified — design diverged from a locked decision (resolved):**
- **Composer:** the design's post/ask mode toggle is superseded — the owner kept **`@comic`-mention**
  as the trigger. Implemented as the normal chat input; typing `@comic …` routes to the assistant.
  No toggle rendered.

**Previously "Missing" — now DELIVERED against `9a4a1af`:**
1. **AI answer "pending human review" state** — the `ai_pending` "Reviewing for safety" card
   (`comic-cards.tsx` → `ComicPendingCard`). Interim mode holds every AI draft; the asker
   sees only this card until a human approves an answer.
2. **Owner review/correction dashboard** (admin) — `comic-review-dashboard.tsx` at `/admin/comic`;
   queue / empty / loading / detail-edit; approve/edit/reject; shows question, AI draft, provenance,
   confidence; editable corrected-text. (Mockups `AIReviewConsole*.tsx`.)
3. **LLM-consent affordance** at first `@comic` use — `comic-consent-modal.tsx` (mockup
   `AIConsent.tsx`); Confirm persists consent (`llm_consent_granted`), "Not now" does not route.
4. **Rating control** on AI cards — helpful / not_helpful / flagged row, wired to
   `POST /api/comic/answers/[turnId]/rate`.

Required states per rule 126, all covered for the AI surfaces: Unauthenticated, Auth+Loading,
Auth+Empty, Auth+Populated. Mobile (`Mobile*`/`MobileAIConsent` + `MobileAIReviewConsole*`) is now
delivered (2026-06-01) in `ctf/packages/mobile/src/features/comic/`. Divergence carried over from
the web build: the review dashboard mockup's fabricated "Sources" list and hardcoded confidence
buckets are not reproduced — only real provenance (engine / intent / safety category / the real
`nlu_confidence`, surfaced as "Not yet scored" when null) is shown.

## Change Log

- 2026-07-29: **Third-party identifier scrub applied to production; the one-time tooling is deleted
  (#1912 closed out).** The first seed import ran before `redact()` covered Quora profile links and
  @handles, so live rows could carry another person's identity into a model prompt. The dry run
  scanned 1,575 rows and reported 609 changes; the apply run (workflow_dispatch, 2026-07-29) landed
  them. Most of the 609 are the URL removal — an **accuracy** decision, not a privacy one: a quarter
  of the seed's links were already truncated by Quora's own exporter, old app deep links point at
  routes that no longer exist, and a link to another member's account can rot into something worse
  than out-of-date if that account is deleted or taken over.
  `.github/workflows/scrub-comic-knowledge-identifiers.yml` and
  `ctf/scripts/scrubComicKnowledgeIdentifiers.mjs` are now removed: they were catch-up for rows
  imported before the fix, and the fix itself lives permanently in the parsers' shared `redact()` and
  in `lib/comic/redact.ts`. Nothing to re-run.
  **Note for the record:** the scrub corrected the **database**. The original seed file is still in
  git history at commit `6f423fe` with 14 profile links naming 9 people. Those are public Quora posts
  and links to accounts their owners made public — the risk was always accuracy rather than
  disclosure — but removing them from history would need a force-push rewrite of a public repo, which
  has not been done.

- 2026-07-29: **Quora space renamed — `space` label updated in the retained seed export (data-only, no schema impact).** The owner renamed their Quora space (subdomain `tiskillsnetwork.quora.com` → `skillseconomy.quora.com`; visible name "TI Skills Network" → "Skills Economy"). In `ctf/scripts/data/comic-knowledge-seed-2.jsonl` the `space` metadata field was changed from `TI Skills Network` to `Skills Economy` on the 70 rows for that space (the parser maps `rec.space` to the knowledge-entry `title` when a row has no explicit title — see `importComicKnowledge.mjs`), so a future re-import grounds under the current space name. Left exact: post `url` values (never imported, and several encode the old subdomain inside the canonical slug — rewriting would corrupt them) and every "TI Skills Network" mention inside verbatim post `content` (a member's own words). Note: this repo file is the retained source-of-record; the rows already imported into `comic_knowledge_entries` are not changed by the seed edit. To bring the live rows in step, a one-time script `ctf/scripts/renameComicSpaceTitle.mjs` plus a manually-triggered workflow (`.github/workflows/rename-comic-space-title.yml`) update the `title` from `TI Skills Network` to `Skills Economy` — matched exactly on `title` so only space-post rows are touched; `content` is left verbatim and `content_hash` is not recomputed (title is not part of the hash), so import idempotency is unaffected. Dry-run by default. The owner ran the apply job green against production, so the live rows now carry the new title; per the one-time-tooling pattern, `ctf/scripts/renameComicSpaceTitle.mjs` and `.github/workflows/rename-comic-space-title.yml` have since been removed. All 225 seed lines re-validated as JSON.
- 2026-07-29: **Members can contribute their own public Quora writing, with the consent form on the
  page (`/knowledge`).** The path and the screen title avoid the word "contribute" on purpose: the
  Contributions plugin is the fundraiser/donation surface, and two member-facing paths a word apart
  would be a standing source of confusion (owner decision). The assistant answers from one person's writing; this is the intake that
  lets it answer from more than one. New page, two member routes, two tables.
  **The consent form is on the page itself**, not behind a link, because a link is a thing people
  click past. Six clauses, one checkbox each, no bundled "agree to all" — own public writing / the
  single permitted use / contributor keeps every right / withdrawal / a human reads it and not
  everything is used / parts naming others may be cut. The clauses render from
  `lib/comic/contribution-consent.ts`, the same module the server version-stamps into the record, so
  the displayed wording and the agreed wording cannot come apart; changing what a contributor agrees
  to requires bumping `CONTRIBUTION_CONSENT_VERSION`, and a page cached from before a change is
  refused rather than recorded as consent to wording it never showed. The file picker stays disabled
  until all six are ticked, so the order is always read-then-choose.
  **Picking a few posts is the default; the whole export is the fallback (owner decision,
  2026-07-29).** Most people's public writing is mixed — dating, politics, faith, memes — and nothing
  in this pipeline sorts on-topic from off-topic automatically, so an export means the reviewer reads
  hundreds of posts to find a handful. Picking moves that choice to the author, who knows instantly
  which posts belong, and is the more honest consent: choosing three posts is knowing exactly what you
  are giving. It also carries no upload at all, which removes the whole attack surface for the common
  case. Picked posts are pasted as text with a quora.com link as **provenance that is never fetched** —
  scraping would inherit the exact link-rot fragility that got URLs stripped from the corpus.
  **On the export path, the contributor is still not asked to clean their own file.** A Quora `.zip` bundles inbox messages,
  drafts, and profile data alongside the public posts; most people would get the stripping wrong, and
  the ones who got it wrong would be the ones harmed. So it happens automatically, in
  `lib/comic/quora-export-intake.ts`, on an **allowlist** — an unrecognized section is discarded, so a
  new Quora section containing private mail would be dropped for never having been named. The member
  gets an immediate receipt naming what was kept and what was thrown away.
  **The uploaded archive is never stored.** It is parsed in memory (`lib/comic/contribution-archive.ts`:
  only `index.html` decompressed, entry names validated against traversal, decompressed-size ceiling
  against a zip bomb, nothing executed and no shell invoked) and discarded with the request — the
  upload endpoint takes files from anyone signed in, and the people this community exists to protect
  against are motivated to send a malicious one.
  **Withdrawal is real, and the design is why.** `POST /api/comic/contributions/[id]/withdraw`
  deactivates every knowledge row a contribution produced in the same transaction that marks it
  withdrawn. That is possible because the assistant retrieves from a table at answer time rather than
  being trained on the text. Account deletion goes further and removes them, enforced by
  `comic_knowledge_entries.contribution_id` ON DELETE CASCADE rather than a step in the orchestrator,
  so it cannot be forgotten. Comic's deletion-registry entry and deletion contract updated to match.
  Schema: `comic_contributions`, `comic_contribution_entries`, and `comic_knowledge_entries.contribution_id`.
  New commands `comic.contribution.submit` / `comic.contribution.withdraw` in the command, access-policy,
  and audit contracts — the audit records the **consent**, never the content. New dependency: `fflate`
  (zip reading, no transitive dependencies).
  **The admin review surface ships with it** (`/admin/comic/contributions`, owner requirement before
  launch): accept promotes the chosen entries and makes the grant, decline requires a reason the
  contributor reads. Until a contribution is accepted there it stays inert — nothing a member sends
  can reach the assistant on its own.
  **Credits require Unlock (owner decision).** Anyone signed in may contribute; only a verified member
  receives the ServiceCredits grant. An accepted contribution from a not-yet-verified member stays
  accepted and ungranted, and the grant can be made later. Requiring verification also puts a real
  cost in front of the obvious abuse: paying for contributions is an invitation to submit poisoned
  material.
  **Apps list:** registered as `knowledge` / "Knowledge Library" in the plugin registry; the launcher
  tile at `/apps/knowledge` redirects to the top-level `/knowledge` page so there is one page rather
  than two copies to keep in step. Also declared in `ctf/config/plugin-parity-contracts.json` as
  web-only (`requiresMobileSurface: false`) — the native Android app is narrowed to the Chyme
  keep-list under rule 105, so there is deliberately no Android surface for this. New admin area
  "Contributed Writing" on the admin landing.
- 2026-07-26: **Seed corpus drops URLs — an accuracy decision, not a privacy one (owner, 2026-07-26).** The seed's value is the writing, not a link directory, and links are its most perishable part. Measured across the 1,800 seed records: **35% contain a URL, and 24% contain a URL the Quora export itself truncated with `...`** — already unusable and unfixable from this data. Others point at routes that no longer exist (e.g. `/apps/directory/public/<id>`; the Directory's public projection was removed 2026-05-18 and legacy URLs are deliberately not redirected). Worst case, a link to another member's account can rot into a safety failure: that account may be deleted, or taken over, and a bot answer sending a survivor there is not merely out-of-date. `redact()` now replaces every URL with `[link removed]` (Quora profile links keep their own `[profile link removed]` label). **Prose is untouched** — people and places are still named, so attribution survives ("Nat Morris created a list of questions…"); only the fragile pointer goes. Average answer length is unchanged at ~514 characters. The bot should tell a member to open LightHouse, not hand them a URL it cannot vouch for. Applies to both parsers and, via `scrubComicKnowledgeIdentifiers.mjs`, to the rows already imported (609 of 1,575 change).
- 2026-07-26: **Second Quora account export parsed and staged for import (#504; data-only, no schema impact).** The owner supplied the second account's Quora export ("Pedigree101"), the last open dependency on #504. Parsed with the existing `parseQuoraExportToComicDataset.mjs`: **225 records** (43 answers, 72 space posts, 87 comments, 23 space submissions), 16 exact duplicates dropped, and a post-run scan confirming **zero** remaining emails, Signal links, or wallet addresses. Staged as a temporary data file (`ctf/scripts/data/comic-knowledge-seed-2.jsonl`) plus a one-time manually-triggered workflow (`.github/workflows/import-comic-knowledge-2.yml`), the same pattern the first import used; both are deleted after one green run (tracked on its own cleanup issue). The import is idempotent (sha256 content hash + `ON CONFLICT DO NOTHING`), so content overlapping the first account's 1,575 entries inserts nothing twice. **The companion "data" export was deliberately excluded**: it holds account metadata (139 bookmarks, 101 user follows, 11 user blocks, 25 user mutes, topic/question mutes) plus the owner's own name/email/profile URL — settings and ~137 third-party identities, not "what good help looks like". Training on it would add no answer-quality signal and would risk a fine-tuned model emitting another member's name from a block list, which #504's de-identification rule exists to prevent. Only owner-authored public content is imported.
- 2026-07-23: **Seed import completed and one-time tooling removed (#504; data-only, no schema impact).** The one-time workflow ran green (run #1, workflow_dispatch by the owner): 1,575 entries imported into `comic_knowledge_entries`, 0 duplicates, 0 invalid lines. Per the cleanup checklist on #504, `.github/workflows/import-comic-knowledge.yml` and `ctf/scripts/data/comic-knowledge-seed.jsonl` are deleted — the knowledge base now lives in the production database only. @comic drafts ground in it from the next question onward. Future imports (e.g. the second account's Quora export) re-add a temporary data file + the same workflow pattern, then delete both again.
- 2026-07-23: **One-time production import of the seed knowledge base (#504; no schema impact).** Added a manually-triggered workflow (`.github/workflows/import-comic-knowledge.yml`) plus a temporary data file (`ctf/scripts/data/comic-knowledge-seed.jsonl`, 1,575 redacted all-public-source records) so the owner can load `comic_knowledge_entries` from the Actions tab without terminal access. Data-only: the table itself shipped with the retrieval-grounding change below; `ctf/schema.sql` is untouched here. The import is idempotent (content-hash keyed). Both files are temporary and must be deleted after one green run — cleanup checklist tracked on #504.
- 2026-07-23: **Retrieval grounding for AI drafts (#504 retrieval step).** Drafts are now grounded in the owner's own published answers instead of the base model's generic training. (1) Schema: new `comic_knowledge_entries` table (source ∈ quora_export|github_wiki|approved_answer; entry_type ∈ answer|post|comment|submission|wiki; content_hash UNIQUE for idempotent imports; `active` boolean as the curation off-switch; GIN full-text index over question+title+content) and new `comic_turns.grounding_entry_ids` jsonb column (which entries grounded each bot draft — the #504 "measure" hook: compare correction rates for grounded vs ungrounded drafts). `schema.demo.sql` regenerated. (2) Import: new `ctf/scripts/importComicKnowledge.mjs` loads the seed JSONL produced by `parseQuoraExportToComicDataset.mjs` / `parseWikiToComicDataset.mjs` (1,575 records currently: 110 Quora answers, 601 posts, 620 comments, 59 submissions, 185 wiki pages), keyed on sha256 content hash so re-runs insert nothing twice. (3) Draft path: `generateComicDraft` calls new `retrieveComicGrounding()` — Postgres full-text search (`websearch_to_tsquery` + `ts_rank`), top 4 active entries, each capped at 1,200 chars — and appends a grounding block to `SURVIVOR_SYSTEM_PROMPT` instructing the model to prefer the excerpts' guidance, facts, and tone. Retrieval is best-effort: on failure or no match the draft runs ungrounded exactly as before. Applies to both the background draft at ask time and the admin "Generate draft" (regenerate) path. The `[comic.inference]` audit gains `groundingEntryCount`. (4) Human review is unchanged: every draft still goes to the review queue; `policy.forceHumanReview()` stays unconditionally true. (5) Contracts: `comic.message.route` and `comic.reply.generate` bumped to 1.1.0 with `comic_knowledge_entries` in dataAccess. Remaining #504 work: import the second account's Quora export when it arrives, measure grounded-vs-ungrounded correction rates, upgrade retrieval to embeddings (unblocked — #502 closed 2026-07-22, the stronger GPU-hosted model is already what grounded drafts run on), fine-tune once volume is sufficient.
- 2026-07-14: **Android pull-to-refresh on the owner Review Dashboard (`ComicReviewDashboard.tsx`).** Dragging the detail pane down re-pulls the review queue, training stats, and plugin list in the background (the existing `load` only shows the full-screen spinner on first mount, so the queue stays visible while it re-pulls). Mobile-client only — no backend, schema, route, or contract change.
- 2026-07-01: **Relabel the training-examples "pending" count to "awaiting export" so it no longer reads like a queued review.** The queue header shows two counts side by side: the review-queue badge ("N pending" / "0 pending — Queue is clear") and the training-examples breakdown ("Training examples collected: N (N pending · … exported · … rated answers)"). Both used the word "pending" for different things — queued reviews vs. training-example export status — so "1 pending" in the training line read as a queue item even when the queue was clear. Renamed only the training-example status label to "awaiting export" in both surfaces (`comic-review-dashboard.tsx` `TrainingStatsBadge`, `packages/mobile/src/features/comic/ComicReviewDashboard.tsx` `TrainingStatsLine`). Copy only — no data, API, schema, or contract change; the underlying `trainingExamplesByStatus.pending` field is unchanged. Parity: web + mobile-responsive + android.
- 2026-07-01: **Removed the misleading engine-status badges; the draft action now names the real failure; clearer "Generate draft" copy.** The always-"reachable" "Chat AI engine (RunPod / Ollama)" badge only pinged the endpoint's liveness (`/health` or `/api/tags`, 5s), not whether a real draft would succeed, so it showed "reachable · 65ms" while "Generate draft" failed — confusing. (1) Removed the badge from both surfaces: deleted `packages/web/app/admin/admin-ai-status-badge.tsx` and its use on the admin landing (`app/admin/page.tsx`), and removed the queue-header engine badge (`ServiceStatusBadge` + its `/api/comic/admin/ai-status` fetch) from `comic-review-dashboard.tsx`. The "Training examples collected" line stays. (2) `GET /api/comic/admin/ai-status` is kept as an admin diagnostic probe only (no UI). (3) Honest failure reason: `describeOllamaFailure(err)` (new export in `lib/chatbot/ollama.ts`) maps the thrown error to a plain cause (timeout / model-not-found 404 / auth 401-403 / engine 5xx / empty / network). `generateComicDraft` captures it as `OllamaDraft.failureReason`; `regenerateComicDraft` returns `{ attached, reason }`; the regenerate route returns `reason`; the dashboard shows it instead of a blanket "still unreachable". (4) Copy: the empty-draft placeholder now points at the real control — web "Use Generate draft to try again, or Edit & approve…" (there is no Refresh button), mobile "Check back in a moment, or use Edit & approve…" (no draft button on mobile). (5) The action label is state-aware while in flight: "Generating…" for a first draft, "Regenerating…" when re-running an existing one. No schema change. Parity: web + mobile-responsive + android (placeholder copy mirrored on the RN dashboard).
- 2026-06-23: **Android parity — @comic applicable-plugin links (#688).** The React Native @comic surfaces now match the web applicable-plugins feature. (1) Review dashboard (`packages/mobile/src/features/comic/ComicReviewDashboard.tsx`): a new "Applicable plugins" multi-select chip row (sourced from the new best-effort `fetchVisiblePlugins()` over `GET /api/plugins`) lets the reviewer tag the plugins an answer points to; the chosen `linkedPluginSlugs` are sent to `resolveComicReview` on approve/correct (dropped for reject) — the server validates/caps them (`comic.review.resolve` v1.1.0, already shipped). (2) Answer card (`comic-cards.tsx`): the asker's published answer renders its `linkedPlugins` (new on the mobile `ComicStreamItem`, resolved to `{ slug, name }` and already returned by `GET /api/comic/conversation`) as plugin chips beneath the answer. The chips are informational on mobile for now (not yet deep-linked into each plugin screen — a follow-up can thread slug→tab navigation, like the directory presence rows). No schema or contract change — binds the existing route/contract.
- 2026-06-23: **Android parity — "Training examples collected" counter on the mobile review dashboard.** The React Native owner review dashboard (`packages/mobile/src/features/comic/ComicReviewDashboard.tsx`) now fetches `GET /api/comic/admin/training-stats` and renders the same "Training examples collected: N (… pending · … exported · … rated answers)" line under the dashboard header, in both the populated and all-clear states. New best-effort client `fetchComicTrainingStats()` (`packages/mobile/src/features/comic/api.ts`) returns null on any failure (including the 401/403 a non-admin gets), so the line simply hides — it never blocks the queue. Read-only; no API, schema, or contract change. Closes the Android parity ticket for the counter (#694).
- 2026-06-21: **Helpful/not-helpful/flagged ratings now part of the training export, plus a "Training examples collected" counter.** (1) The training export (`GET /api/comic/training/export`) now includes the human feedback signal alongside owner corrections: new repository helper `exportComicRatedAnswers()` joins each rated answered turn (`comic_answer_ratings`) back to its question text + published answer text + most-recent helpful/not_helpful/flagged rating + when it was rated, de-identified (no user id, no other PII). JSON gains a `ratedAnswers: { question, answer, rating, ratedAt }[]` field; the YAML download appends the rated answers as comments so the file stays a valid NLU training file. (2) New admin-only read endpoint `GET /api/comic/admin/training-stats` (`getComicTrainingStats`) returns `{ trainingExamplesTotal, trainingExamplesByStatus, ratedAnswersTotal }`; the `/admin/comic` review dashboard shows "Training examples collected: N (… pending · … exported · … rated answers)" near the engine-status badge — read-only, best-effort (a failed fetch hides it). (3) Documented the two training inputs (`comic_training_examples` = owner corrections, `comic_answer_ratings` = ratings) in the Data Model section and added the "Training dataset & how to begin fine-tuning" subsection so a future engineer/owner can pick up the owner-initiated fine-tuning step. No schema change (reads/joins only). Command + access-policy contracts updated: `comic.training.export` bumped to 1.1.0 (now lists `ratedAnswers` and the wider `dataAccess`), new `comic.training.stats` command added.
- 2026-06-21: **Applicable-plugin links on published answers.** A reviewer can now tag the plugins an answer points to, and the published answer renders them as tappable links. (1) Schema: added `linked_plugin_slugs jsonb not null default '[]'` to `comic_turns` (`schema.sql` CREATE + `ALTER … ADD COLUMN IF NOT EXISTS` companion, `schema.demo.sql` regenerated). (2) `ComicReviewResolveInput` gained `linkedPluginSlugs?: string[]`; the resolve route (`POST /api/comic/review/[turnId]/resolve`) parses it (string-array narrowing) and `resolveComicReview` validates the slugs against the visible plugin registry (`listPluginRegistry`) — dropping unknown/hidden slugs, deduping, and capping at 5 — then stores the result on the published answer turn (the reused AI draft for approve, or the freshly inserted human turn for correct / approved human-first). Reject stores nothing. (3) Read path: `listComicAskerStream` now selects `comic_turns.linked_plugin_slugs` on the answer turn and resolves each slug to `{ slug, name }` against one registry fetch per page, exposing `ComicAskerStreamItem.linkedPlugins` (empty for pending). The field is threaded through `/api/comic/conversation` → `useHomeChat` → `ComicStreamItem` to `ComicAnswerCard`, which renders each as a small `next/link` chip to `/apps/<slug>` (nothing when empty). (4) Dashboard: `comic-review-dashboard.tsx` fetches `/api/plugins` and shows an "Applicable plugins" toggle-chip picker in both the default (approve) view and the Edit view; the chosen slugs are sent as `linkedPluginSlugs` on approve and correct. (5) Contract: `comic.review.resolve` bumped to 1.1.0 with the new input and `comic_turns.linked_plugin_slugs` + `ctf_plugin_registry` in dataAccess. Android (RN dashboard + mobile comic card) is deferred — see the parity ticket on the PR.
- 2026-06-21: **Regenerate a draft + show why the engine is unreachable.** (1) New admin-only `POST /api/comic/review/[turnId]/regenerate` (`regenerateComicDraft`) re-runs the model for a still-pending review and attaches the draft synchronously, so a backlog of draftless questions (the engine was down at ask time) can be cleared once it is healthy; the review dashboard gains a "Regenerate draft"/"Generate draft" button. If the engine is still unreachable it leaves the item human-first and says so. No schema change (writes a bot turn + sets `draft_turn_id`, same as the background path). (2) `pingOllama` now returns a `detail` string naming the failure (`HTTP 401 — check OLLAMA_API_KEY`, `HTTP 404 — check OLLAMA_BASE_URL / endpoint id`, `timeout`, etc.) plus the `provider` (runpod/native), so an "unreachable" status is debuggable — the admin landing badge and the `/admin/comic` queue badge now show the reason. This distinguishes a real outage from a config mistake (a wrong/missing RunPod API key or an out-of-date endpoint id while the RunPod endpoint itself is "Ready").

- 2026-06-21: Surfaced the chat AI engine status on the **main admin landing** (`/admin`), not just the `/admin/comic` dashboard. New client component `app/admin/admin-ai-status-badge.tsx` calls the existing admin-only `GET /api/comic/admin/ai-status` probe once on mount and renders a one-line status bar under the header: green "reachable · Nms", red "asleep or not responding" (a cold or down RunPod serverless endpoint fails the `/health` probe — a retry usually wakes it), grey "not configured", plus the model id. This is so the owner sees whether drafting is live the moment they open admin, instead of inferring it from canned/absent answers. Read-only, best-effort (a failed fetch shows "status unavailable"); reuses the existing endpoint, so no new route, schema, or contract. Reconfirmed behaviour: when the RunPod/Ollama engine is unreachable, `generateAndAttachDraft` attaches no draft (the review stays human-first, shown as "No AI draft … drafting was unavailable"), and the Feed assistant falls back to its approved-sources template — both already documented below.
- 2026-06-17: Review dashboard now shows the asker's **@username** instead of the raw Clerk user id, and presents an honest **no-draft** state. (1) Added a nullable `asker_username` column to `comic_conversations` (`schema.sql` + `schema.demo.sql`); `routeComicMessage` now takes the actor's username and snapshots it on the conversation at ask time (backfilled on later turns via `COALESCE`). Older rows have no snapshot and fall back to the user id. (2) `listPendingComicReviews` now returns `asked_by_username` and a `has_draft` flag (`q.draft_turn_id IS NOT NULL`); `ComicReviewItem` gained `askedByUsername` and `hasDraft` (web + mobile). When `hasDraft` is false — `draft_turn_id` is null, which means no draft is attached yet (it may still be generating in the background, drafting was unavailable, or the question was safety-held) — the web and Android dashboards no longer show the question text in the "AI draft" slot or offer "Approve & send"; they show a "No AI draft … write the answer" state and route the owner to Edit & approve. Server already blocks approving a draftless item with empty content (`approve_requires_content`). No new endpoints or contracts.
- 2026-06-14: Added a live Ollama status badge to the `/admin/comic` review dashboard. New admin-only read endpoint `GET /api/comic/admin/ai-status` calls `pingOllama` (`lib/chatbot/ollama.ts`) — a 5s, no-inference liveness probe that hits `GET /health` for a RunPod endpoint or `GET /api/tags` for a native Ollama host (reusing the `OLLAMA_API_KEY` bearer) — and returns `{ ok, ollama: { configured, reachable, latencyMs, model } }`. The dashboard queue header shows one badge (green reachable + latency / red unreachable / grey not configured) so the owner can tell at a glance whether drafting is working. Read-only; best-effort (a failed fetch hides the badge, never blocks the queue). Supersedes the never-merged #498, which also pinged Rasa — Rasa was removed (#503), so only Ollama is shown. No schema or contract change.
- 2026-06-14: Moved the RunPod worker image out of this monorepo into its own repo (`ctf/Runpod`). Deleted `ctf/ops/runpod-ollama/Dockerfile` here; the endpoint now builds from the dedicated repo so pushes to this monorepo's `main` never trigger a ~20 GB image rebuild (the worker repo changes rarely). The handler stays inlined in that one Dockerfile. The RunPod client adapter (`lib/chatbot/ollama.ts`) and the RunPod section of `ctf/docs/developer/OLLAMA.md` remain here and now point at the worker repo. No behavior change.
- 2026-06-14: Generate the @comic draft in the BACKGROUND so the asker's submit never waits on the model. Previously `routeComicMessage` awaited `generateComicDraft` before returning; with the model moved to a serverless GPU (issue #502, PR #506), a cold start could take tens of seconds and stall the submit. Now the user turn + a `pending` review row commit in one short transaction first and the request returns immediately; the AI draft is generated in a detached background task (`generateAndAttachDraft`) that, only if the review is still `pending`, inserts the bot draft turn and records it on the new `comic_review_queue.draft_turn_id` column (guarded by `FOR UPDATE` + `WHERE status = 'pending'`). The review's `turn_id` is never repointed — it stays the asker's question turn, so the question is inferred stably even when the asker sends another message before the draft lands (fixes the mispairing flagged in CodeRabbit review of #507). A `template`-engine result (Ollama unreachable) is treated as a failed generation and not attached, leaving the item human-first. The admin dashboard reads the draft from `draft_turn_id` (falling back to the question body for human-first); `resolveComicReview` publishes the draft turn on approve. Schema: added the nullable `draft_turn_id UUID` column to `comic_review_queue` (`schema.sql` + `schema.demo.sql`). The human-review guarantee is unchanged and strengthened — the question is enqueued before any AI work, so a slow/failed/absent model never loses it.
- 2026-06-14: Talk to a RunPod serverless endpoint for drafts (issue #502, PR #506). `lib/chatbot/ollama.ts` detects an `api.runpod.ai` `OLLAMA_BASE_URL`, submits the chat as a RunPod job (`/run`) and polls `/status/<id>` within the same 30s budget, reusing `OLLAMA_API_KEY` as the RunPod bearer; the self-hosted worker image was added at `ctf/ops/runpod-ollama/Dockerfile` (later moved to the dedicated worker repo — see the entry above). Inert unless `OLLAMA_BASE_URL` points at RunPod.
- 2026-06-14: Removed the Rasa NLU integration; Ollama is now the only @comic AI engine. Deleted the `ctf-rasa` private Render service block (`render.yaml`), its image build job and path filter (`build-images.yml`), the ops project (`ctf/ops/rasa/`), the backend client (`lib/comic/rasa.ts`), the deploy runbook (`ctf/docs/developer/RASA.md`), and the Rasa status badge on the AI review dashboard (web + Android) and the `ai-status` route (now returns `{ ok, ollama }`). `routeComicMessage` no longer calls any NLU service, so `intent`/`nlu_confidence` on the user turn stay null. Non-destructive on data: the `engine` CHECK still lists `rasa` and the `intent`/`nlu_confidence` columns remain for historical rows; nothing writes them now (noted in `schema.sql`/`schema.demo.sql`). The training-example export route was kept and de-Rasa-named (`buildTrainingNluYaml`) as a portable dataset for a future model. Reason: Rasa only produced reviewer-side intent labels at ~$25/mo, never generated answers, and never gated auto-publish — low value for the cost. Direction instead: upgrade the self-hosted Ollama model on a GPU host (issue #502), then retrieval + a confidence/safety gate, then fine-tune an open model on the exported, de-identified dataset; a third-party API stays off the table for survivor question text on privacy grounds. Contracts and this inventory updated; the Rasa-based "target architecture" sections below are superseded (see the note at the top of this file).
- 2026-06-13: Made @comic question capture reliable and fixed the asker copy. The Ollama draft was generated **inside** the question-capture DB transaction; a slow Ollama (up to the 30s timeout) held the transaction open, which Neon could abort (idle-in-transaction) and roll back the captured question — so it never reached the admin review queue. `routeComicMessage` now generates the draft (and logs inference) **outside** the transaction, mirroring the existing Rasa call, so the user turn + a `pending` review row always commit fast and reach `/admin/comic` regardless of the AI's speed/availability. Added a defensive human-first fallback when no draft is produced. Asker pending copy changed from "AI Assistant is preparing an answer…" to "Preparing your answer — a teammate is writing a verified response. Answers typically arrive within 72 hours." (sets honest expectations; the owner answers every question). No schema or contract change.
- 2026-06-12: The Android @comic API client (`packages/mobile/src/features/comic/api.ts`) now uses the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing plain fetch calls against hardcoded development URLs. No schema, route, or contract change.
- 2026-06-07: Aligned the **AI review dashboard** (web + Android) to the newer `AIReviewConsole*` /
  `MobileAIReviewConsole*` mockups (design `353f8f3`) on `feat/comic-ai-review-dashboard-align`. No
  backend change — binds only the existing `GET /api/comic/review` and
  `POST /api/comic/review/[turnId]/resolve` endpoints (mutations send `x-ctf-csrf: 1`). Web: added a
  confirm gesture (`window.confirm`) before every publish (approve / approve-corrected) and reject,
  so a misclick cannot silently send or discard an answer. Android: added the dedicated **Confidence
  card** (band label + progress bar + low-confidence safety note) mirroring the web dashboard; rebuilt
  the edit view to the `MobileAIReviewConsoleDetail` layout (read-only Original AI draft beside the
  editable corrected answer, with Reset, a character count, and a safety reminder banner); hid the
  "Approve & send" action for safety-flagged human-first items (no AI draft to send) to match the web
  dashboard; and added a confirm dialog (`Alert.alert`) before every publish/reject. The fabricated
  "Sources" list and hardcoded confidence buckets in the mockups remain intentionally omitted — there
  is no backend for source documents, so only the real `nlu_confidence` and provenance are shown. No
  consent surface was added here; the existing first-use consent affordance already covers
  `AIConsent` / `MobileAIConsent` and is unchanged. List keys are on the `key` prop of the mapped
  `Pressable`/`View` rows (no `key` placed on a bare host element where the RN typings reject it), and
  no new `App.tsx` feature key was added (`comic-review` was already registered).
- 2026-06-01: Delivered the **Android UI** for `@comic` on `feat/comic-mobile-android-parity`
  against the LOCKED design `9a4a1af` (`Mobile*`/`MobileAIConsent`/`MobileAIReviewConsole*`). Added
  `ctf/packages/mobile/src/features/comic/`: `api.ts` (client for `/api/comic/conversation`,
  `/message`, `/answers/[turnId]/rate`, `/review`, `/review/[turnId]/resolve`, all with the
  `x-ctf-csrf: 1` header; `mentionsComic` mirrors `COMIC_MENTION_REGEX`); `comic-cards.tsx`
  (`ComicAnswerCard` cyan answer card with the helpful/not_helpful/flag rating row + `ComicPendingCard`
  "Reviewing for safety"); `ComicComposer.tsx` (single-field `@comic` composer, no toggle, with the
  `@comic` chip + helper and first-use consent gating); `ComicConsentSheet.tsx` (consent bottom
  sheet); and `ComicReviewDashboard.tsx` (owner review dashboard — queue chips + detail with question /
  AI draft / real provenance + Approve / Edit&approve / Reject; "All caught up" empty state;
  admin-gated server-side with an access notice for non-admins). Interleaved the AI cards + composer
  into the mobile feed stream (`features/feed/FeedStream.tsx`) and added the "AI Review" dashboard tile
  to the app shell (`App.tsx`). Reconciled the parity contract by adding `comic` to the existing
  `feed-announcements` `mobileFeatureDirs` (the parity gate requires each contract slug to exist in
  the plugin registry, and `@comic` surfaces inside the Hub/feed, not as its own navigable tile).
  **Interim safety policy honored end-to-end on mobile: every answer routes through human review
  before it reaches the asker; no auto-publish path.** Followed the web build's divergence: the
  review-dashboard mockup's fabricated "Sources" list and hardcoded confidence buckets are not
  reproduced — only real provenance is shown. Mobile typecheck adds no new errors; mobile lint clean;
  web/Android parity check passes. Parity: web+android complete.
- 2026-05-31: Normalized the audit contract to the canonical audit shape (template 203): removed the
  redundant `version: 1.0.0` line that duplicated `commandVersion: 1.0.0` on each of the seven audit
  events. That duplicate had only been added to satisfy the schema-drift gate, which previously did
  not recognize `commandVersion` as a version key; the gate now accepts it, so the workaround is no
  longer needed. Each audit event keeps its `eventId`, `command`, and `commandVersion`. No behaviour,
  schema, route, or API change.
- 2026-05-31: **Stood up the self-hosted Rasa NLU service + wired the backend** on
  `feat/rasa-assistant-service` (infra + a SAFE, label-only backend integration; no UI). Added the
  Rasa 3.x **NLU-only** project under `ctf/ops/rasa/` (`config.yml` WhitespaceTokenizer →
  featurizers → DIETClassifier → FallbackClassifier; `domain.yml` with the 5 comic intents +
  minimal responses; seed `data/nlu.yml`; `credentials.yml` REST channel; `endpoints.yml` with the
  action server + SQL tracker store left commented/deferred) and a `Dockerfile`
  (`rasa/rasa:3.6.21`, trains the model at build time via `rasa train nlu`, serves
  `run --enable-api` on 5005). Added the `ctf-rasa` private `pserv` to `render.yaml` (reached at
  `http://ctf-rasa:5005`; `RASA_BASE_URL` injected on `ctf-web` via Infisical, same pattern as
  `OLLAMA_BASE_URL`), the path-filtered `ctf-rasa` image build in `build-images.yml`, and the
  `ctf/docs/developer/RASA.md` deploy runbook. **Backend (SAFE):** implemented `lib/comic/rasa.ts`
  (`isRasaConfigured()` true iff `RASA_BASE_URL` set; `parseComicIntent(text)` POSTs to
  `/model/parse` with a timeout + try/catch, returning `{ intent, confidence }` — null on any
  failure, mirroring `lib/chatbot/ollama.ts`); `routeComicMessage` now stores the **real** intent +
  `nlu_confidence` on the user turn when Rasa is configured (and the prior null/null, with **no**
  Rasa call, when it is not — byte-for-byte unchanged). **Safety posture unchanged:**
  `policy.forceHumanReview()` now returns `true` **unconditionally** (previously
  `!isRasaConfigured()`, which would have stopped review the moment Rasa was configured) — **every**
  answer still goes to human review; Rasa supplies labels only, never an auto-publish bypass.
  Generation still happens in the app via Ollama (`generateComicDraft`), not via Rasa. **Deferred
  (documented as next steps, not built):** the Rasa custom action → Ollama for generation; the SQL
  tracker store; raising the auto-respond threshold / any confidence-based auto-publish. Web build +
  typecheck pass; schema-drift + no-ai-prompts gates pass. A real `rasa train nlu`/deploy validation
  is required before flipping `RASA_BASE_URL` on in prod (per RASA.md). Backend/infra only — no UI
  (no design gate). Parity: web+android complete (backend/infra).
- 2026-05-31: Built the **web UI** on `feat/comic-ai-assistant` against the LOCKED design `9a4a1af`
  (pointer bumped per rule 128). **Asker surface** in the community/home chat
  (`components/community-shell/`: `shell-chat-panel.tsx`, `use-home-chat.ts`, `comic-cards.tsx`,
  `comic-consent-modal.tsx`, `community-shell.module.css`, `shell-types.ts`): AI Assistant answer
  cards + the `ai_pending` "Reviewing for safety" card interleaved with hub messages; the unified
  composer (no toggle) routes `@comic` mentions to `POST /api/comic/message` and everything else to
  the existing peer-to-peer hub path; `@comic` mention chip + helper copy; helpful/not_helpful/flag
  rating row; first-use consent modal gating `llm_consent_granted`. **Owner Review & Correction
  Dashboard** (`components/comic/comic-review-dashboard.tsx` + `.module.css`) at `/admin/comic`
  (admin-gated), 4 states (queue / empty / loading / detail-edit), wired to `GET /api/comic/review`
  + `POST /api/comic/review/[turnId]/resolve` with editable corrected-text and Approve/Edit&approve/
  Reject. **New backend (unblocked):** `GET /api/comic/conversation` (`comic.conversation.read`,
  asker-scoped read that never surfaces an unreviewed draft) and
  `POST /api/comic/answers/[turnId]/rate` (`comic.answer.rate`) + `rateComicAnswer`/
  `listComicAskerStream`/`isValidComicAnswerRating` in `lib/comic/repository.ts` + the
  `comic_answer_ratings` table (guarded DDL, CASCADE off `comic_turns`) + command/access-policy/audit
  contract entries + deletion-contract update. Asker invariant enforced server-side (message route
  returns only a 202 holding response; conversation read suppresses non-approved answer bodies) and
  reflected in the UI (pending card on submit). Web build + typecheck pass. Android parity deferred
  (parity ticket; Mobile* designs not built — web only).
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
  owner review/correction dashboard.**
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
- [x] Owner review/correction dashboard (web). Done 2026-05-31 against design `9a4a1af`.
  - Backend done 2026-05-31 (`GET /api/comic/review`, `POST /api/comic/review/[turnId]/resolve`;
    approve/edit/reject; corrections persist as `comic_training_examples`). Web UI delivered:
    `components/comic/comic-review-dashboard.tsx` at `/admin/comic`, all 4 states.
- [x] Asker @comic chat surface (web): answer cards, `ai_pending` card, unified composer with the
      `@comic` mention chip + helper, rating row, first-use consent modal. Done 2026-05-31 against
      design `9a4a1af`. Added asker read (`GET /api/comic/conversation`) and answer rating
      (`POST /api/comic/answers/[turnId]/rate` + `comic_answer_ratings`).
- [~] Stand up self-hosted Rasa; tracker store on Neon; custom action → Ollama; consume the
      (fixed) NLU export.
  - **NLU service scaffolded + integrated (2026-05-31):** `ctf/ops/rasa/` Rasa 3.x NLU project
    (DIET + FallbackClassifier), `Dockerfile` (trains at build time), `render.yaml` `ctf-rasa`
    pserv, `build-images.yml` `ctf-rasa` build (path-filtered), `RASA.md` runbook; `lib/comic/rasa.ts`
    `parseComicIntent` (`/model/parse`) wired into `routeComicMessage` to populate the user turn's
    intent + `nlu_confidence` when `RASA_BASE_URL` is set (graceful no-op otherwise). A real
    `rasa train nlu`/deploy validation + prod `RASA_BASE_URL` is still required before enabling.
  - **Still deferred:** the SQL tracker store; the custom action → Ollama for generation (generation
    stays in the app); consuming the (still-double-looping) feed NLU export.
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
- [x] Android parity for `@comic`. Done 2026-06-01 against design `9a4a1af`.
  - Added `ctf/packages/mobile/src/features/comic/` (api client + `comic-cards.tsx` answer/pending
    cards + `ComicComposer.tsx` single-field `@comic` composer + `ComicConsentSheet.tsx` first-use
    consent + `ComicReviewDashboard.tsx` owner dashboard) and interleaved the AI cards + composer into
    the mobile feed stream (`features/feed/FeedStream.tsx`). Wired to `/api/comic/*`
    (conversation/message/rate/review/resolve) with `x-ctf-csrf: 1`. Reconciled the parity contract:
    added `comic` to the existing `feed-announcements` `mobileFeatureDirs` (the parity gate requires
    each contract slug to exist in the registry, and `@comic` surfaces inside the Hub/feed rather
    than as its own navigable app tile). Mention, holding/pending state, consent, and rating all work
    on Android; every answer still routes through human review (no auto-publish).
- [ ] Reconcile feed-inventory overstatements + Hub `@comic` persona section.
  - No hard dependency; coordinate with the feed-plugin agent to avoid a merge conflict.
