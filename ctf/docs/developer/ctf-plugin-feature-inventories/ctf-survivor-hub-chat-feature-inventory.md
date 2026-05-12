# Survivor Hub Chat Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Feature type: **non-plugin, app-shell level capability**
- Surface: App shell (`community-shell`) home page entry point
- Plugin context: Chat capability is framed as **Chyme chat** when it refers to the GetStream-backed social
  audio/text surface — not as a generic standalone chat product.

---

## Intent and Outcome

Survivor Hub Chat is the primary navigation and query interface on the CTF home screen. It allows survivors
to ask natural-language questions ("I need a place to stay for 3 months") and receive routing guidance to the
correct mini-app/plugin ("Use LightHouse → Rentals").

The feature is delivered in phased stages:

1. **Phase 0 (current)**: Static/demo UI — pre-seeded conversations showing representative routing examples. No
   backend integration. No GetStream wiring. Human-operators answer queries manually out-of-band.
2. **Phase 1 (planned)**: Human-in-the-loop backend — GetStream channel wires operator responses to users in
   real time. Transcripts are logged to Postgres for intent labeling and training data collection.
3. **Phase 2 (planned)**: Hybrid automation — intent classifier trained on collected examples auto-responds for
   high-confidence intents; ambiguous or high-risk messages fall back to human operators.
4. **Phase 3 (planned)**: LLM-augmented routing — retrieval-augmented generation (RAG) over plugin documentation
   and service metadata, with third-party LLM inference for natural-language response generation.

---

## Research Background

Architecture decision: **hybrid approach** (confirmed by product owner, 2026-03-23):

- Third-party runtime (target: GetStream for messaging; LLM inference provider TBD) for scalable infra,
  safety primitives, monitoring, and SLOs.
- In-house router and business logic layer for canonical intent → plugin/action mappings, authorization
  checks, and proprietary data control.
- In-house retrieval layer (vector store + plugin metadata/help content) once intent→action dataset is mature
  enough to justify the investment.
- Human-first pilot to generate labeled training data before any automation is deployed.

Stack decision (confirmed by product owner, 2026-03-23):

- **GetStream**: messaging channel (UI real-time), typing indicators, read receipts.
- **Postgres**: transcripts, normalized intent/entity labels, user profiles, action logs, audit trail.
- **Routing service** (in-house): receives messages from GetStream, routes to operator or bot, enforces authz,
  records metadata.
- **Agent interface**: minimal operator dashboard built on GetStream for agents to respond, tag intents, mark
  outcomes.
- **Logging/analytics**: centralized logs + dashboards for top utterances, response times, deflection rate.
- **Transcription/ETL pipeline**: background job to normalize transcripts and extract structured fields.
- **Optional (Phase 2+)**: NLU tooling for training (Rasa, Snips, or managed classifier).
- **Optional (Phase 3+)**: Secure vector store (Postgres full-text or Pinecone/Weaviate).

---

## 1) Phase 0 — Static/Demo UI (Implemented)

### 1.1 Shell Design

1. Four-column Discord-style layout: icon rail, left sidebar nav, main content panel, right rail.
2. Section toggle: **Chat** tab and **Apps** tab.
3. Chat tab shows pre-seeded representative conversations between the user and the Survivor Hub assistant.
4. Apps tab shows the full plugin grid (driven by live plugin registry data).
5. Right rail shows active auth-provider user info (first name / username or equivalent), live GDP stats, and active plugin list.
6. GDP stats (member count, GDP value) are pulled from `gdp_metric_snapshots` via the GDP repository.
   They display as zero/absent if no data has been published rather than using hardcoded values.

### 1.2 Chat Tab (Static Placeholder)

1. Pre-seeded chat messages serve as onboarding examples of the intended routing behavior.
2. User can type into the input field; messages append to local state only (no backend).
3. Suggestion chips pre-fill the input with common query examples.
4. Action buttons in hub responses link to the appropriate plugin route.
5. Input and send button are fully rendered but wired to local state only — no GetStream channel.
6. Footer note: "Human-assisted · GetStream powered (coming soon)."

### 1.3 Channels Sidebar (Static Placeholders)

1. **Phase 0 (current)**: Single channel (#general) renders in chat mode for all users (signed-in and non-signed-in).
   - #general links to `/apps/chyme` (community support).
   - No GetStream channel IDs or live unread counts — display-only stub.
2. **Phase 1+ (planned)**: Multiple channels will become available for authenticated users:
   - Additional channels (#housing-help, #skills-trade, #mutual-aid) will be provisioned per user role/context.
   - Each channel links to its corresponding plugin route.
   - Unread counts and live GetStream integration coming in Phase 1+.
3. DM list shows placeholder names — no real DM routing (Phase 1+).

---

## 2) Phase 1 — Human-in-the-Loop (Planned, not designed)

> Specs not yet finalized. Design and contract work required before implementation.

### 2.1 Backend Requirements (Planned)

1. GetStream channel provisioned for each authenticated user upon first chat interaction.
2. Operator dashboard (built on GetStream) for agents to view queued chats, respond, and tag intents.
3. Postgres `chat_transcripts` table: stores message ID, user ID (hashed), operator ID, timestamp, user
   utterance, operator response, tagged intent, tagged entity values, routed plugin, outcome.
4. Postgres `intent_labels` table: canonical intent→plugin→action mappings maintained by operators.
5. Background ETL job: extract structured fields from transcripts, populate `intent_labels`.
6. Auth: authenticated access through the provider-neutral auth boundary; unauthenticated users cannot initiate chat.
7. Policy: operator identity is logged; no PII outside approved retention fields.

### 2.2 User-Facing Changes (Planned)

1. Chat input wired to GetStream channel — messages appear in real time.
2. Operator typing indicator shows.
3. Operator responses appear as "Survivor Hub" avatar messages (identical visual to static demo).

---

## 3) Phase 2 — Hybrid Automation (Planned, not designed)

> Timeline: Month 2–3 after Phase 1 launch, contingent on labeled example volume.

1. Intent classifier trained on Phase 1 collected examples.
2. Auto-responds for high-confidence intents (≥ threshold TBD); falls back to human for ambiguous/risk cases.
3. Slot-filler extracts entities (location, dates, service type) to enrich routing decisions.
4. Routing service returns structured action (plugin slug + optional params) for display.
5. Human fallback queue monitored with SLA; alerting on queue depth.

---

## 4) Phase 3 — LLM-Augmented Routing (Planned, not designed)

> Timeline: Month 3+ after Phase 2, contingent on cost/privacy evaluation.

1. Retrieval-augmented generation (RAG) over plugin documentation, canonical help content, and service flows.
2. Third-party LLM inference (provider TBD) generates natural-language responses from retrieved context
   and strict prompt templates.
3. All LLM requests go through in-house prompt layer; no raw user input is forwarded to third-party APIs
   without sanitization and data classification review.
4. Privacy audit required before Phase 3 deployment: confirm no PII/PHI leaves the in-house boundary.

---

## 5) Non-Scope (Explicit Exclusions)

1. Generic standalone chat product — the chat surface is always framed in plugin context (Chyme chat) or
   as the Survivor Hub routing assistant, not as a general messaging platform.
2. Admin moderation tools for chat are out of scope unless approved by separate artifact.
3. Push notifications for chat messages are out of scope for Phase 0–1.
4. AI-generated responses that bypass the in-house routing layer are prohibited.
5. No LLM inference in Phase 0 or Phase 1.

---

## 6) Rule Alignment

1. `.github/instructions/index.mdc` — CTF rewrite scope, plugin-first flows.
2. `.github/instructions/107-integration-stack-rules.mdc` — GetStream as the backed streaming channel.
3. `.github/instructions/116-file-size-and-modularity-rules.mdc` — Shell chat panel split into modular
   sub-components; each file ≤ 200 lines per primary function.
4. `.github/instructions/113-platform-coding-rules.mdc` — provider-neutral session auth; no PII in client bundles.
5. `.github/instructions/103-web-nextjs-structure-rules.mdc` — Server components fetch GDP stats; client
   components handle local chat state only.
6. CTF Contract — chat functionality referred to as "Survivor Hub assistant" or "Chyme chat context," not as
   a standalone generic product.

---

## 7) Change Log

- 2026-03-23: Initial inventory created. Phase 0 (static UI) confirmed for immediate implementation.
  Phases 1–3 planned, specs deferred. Decisions: hybrid architecture confirmed; GetStream + Postgres stack
  confirmed; human-first pilot confirmed; no AI/LLM in Phase 0 or 1. GDP stats pulled live (no hardcoding).
   Provider-neutral auth user data used for right rail display. No roles beyond admin/user.
