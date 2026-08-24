import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { callOllamaChat, describeOllamaFailure, isOllamaConfigured, OLLAMA_MODEL, SURVIVOR_SYSTEM_PROMPT } from 'lib/chatbot/ollama';
import {
  COMIC_ANSWER_RATINGS,
  COMIC_ASKER_STREAM_LIMIT,
  COMIC_DEFAULT_PAGE,
  COMIC_DEFAULT_PAGE_SIZE,
  COMIC_GROUNDING_MAX_ENTRY_CHARS,
  COMIC_GROUNDING_TOP_K,
  COMIC_HOLDING_RESPONSE,
  COMIC_MAX_CORRECTION_LENGTH,
  COMIC_MAX_MESSAGE_LENGTH,
  COMIC_MAX_PAGE_SIZE,
  COMIC_MAX_REASON_LENGTH,
  COMIC_MESSAGE_RATE_LIMIT,
  COMIC_MESSAGE_RATE_WINDOW_MINUTES,
  COMIC_SAFETY_HOLDING_RESPONSE,
} from './constants';
import {
  evaluateComicSafety,
  mentionsComic,
  passesComicModeration,
  stripComicMention,
} from './policy';
import { listPluginRegistry } from 'lib/plugins/repository';
import type {
  ComicAnswerRatingValue,
  ComicAskerStreamItem,
  ComicAskerStreamPage,
  ComicAskerStreamStatus,
  ComicChannel,
  ComicLinkedPlugin,
  ComicMessageInput,
  ComicMessageRouteResult,
  ComicRateAnswerResult,
  ComicRatedAnswerExample,
  ComicReviewItem,
  ComicReviewPage,
  ComicReviewResolution,
  ComicReviewResolveInput,
  ComicReviewResolveResult,
  ComicReviewStatus,
  ComicTrainingExample,
  ComicTrainingExportResult,
  ComicTrainingStats,
  ComicTurnEngine,
} from './types';

// Cap on how many plugin links a reviewer can tag on one answer, so a published answer never grows
// an unbounded row of chips.
const COMIC_MAX_LINKED_PLUGINS = 5;

// Validate reviewer-supplied plugin slugs against the visible plugin registry: trim, dedupe, drop
// anything that is not a real visible plugin, and cap the count. Returns the surviving slugs in the
// order the reviewer supplied them. An empty/invalid input yields an empty array.
async function validateLinkedPluginSlugs(input: string[] | undefined): Promise<string[]> {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }

  const registry = await listPluginRegistry();
  const allowed = new Set(registry.map((plugin) => plugin.slug));

  const seen = new Set<string>();
  const validated: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') {
      continue;
    }
    const slug = raw.trim();
    if (slug.length === 0 || seen.has(slug) || !allowed.has(slug)) {
      continue;
    }
    seen.add(slug);
    validated.push(slug);
    if (validated.length >= COMIC_MAX_LINKED_PLUGINS) {
      break;
    }
  }

  return validated;
}

// Resolve stored slugs to { slug, name } for rendering, in the stored order, dropping any slug that
// is no longer a visible plugin. `nameBySlug` is passed in so the asker-stream read resolves a whole
// page against one registry fetch.
function resolveLinkedPlugins(slugs: unknown, nameBySlug: Map<string, string>): ComicLinkedPlugin[] {
  if (!Array.isArray(slugs)) {
    return [];
  }
  const resolved: ComicLinkedPlugin[] = [];
  for (const raw of slugs) {
    if (typeof raw !== 'string') {
      continue;
    }
    const name = nameBySlug.get(raw);
    if (name === undefined) {
      continue;
    }
    resolved.push({ slug: raw, name });
  }
  return resolved;
}

type CountRow = { total: string };

type ConversationRow = {
  id: string;
  user_id: string;
  channel: string;
  status: string;
  created_at: Date;
};

type TurnRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'bot' | 'human';
  body: string;
  intent: string | null;
  nlu_confidence: string | null;
  engine: ComicTurnEngine;
  created_at: Date;
};

type ReviewRow = {
  review_id: string;
  turn_id: string;
  conversation_id: string;
  asked_by_user_id: string;
  asked_by_username: string | null;
  question_body: string;
  draft_body: string;
  has_draft: boolean;
  intent: string | null;
  nlu_confidence: string | null;
  engine: ComicTurnEngine;
  status: ComicReviewStatus;
  reason: string | null;
  created_at: Date;
};

type TrainingExportRow = {
  intent_label: string;
  text: string;
};

// The export also reads the row id and status so it can report which rows it just put in the file.
type TrainingExportStatusRow = TrainingExportRow & {
  id: string;
  status: string;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

// Anything that is not the feed channel is the Commons. This also folds the legacy 'hub' value —
// what this channel was called before the 2026-08-09 rename — into 'commons' on read, so a row
// written before the migration renders the same as one written after.
function normalizeChannel(value: unknown): ComicChannel {
  return value === 'feed' ? 'feed' : 'commons';
}

function toNumberOrNull(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// `general` is the safe default intent bucket; the safety category (when present) is the most
// useful coarse training label, otherwise everything goes to `general`.
function deriveIntentLabel(safetyCategory: string | null): string {
  return safetyCategory ?? 'general';
}

export function validateComicMessageInput(input: ComicMessageInput): boolean {
  const body = normalizeText(input.body ?? '');
  return body.length > 0
    && body.length <= COMIC_MAX_MESSAGE_LENGTH
    && typeof input.consentGranted === 'boolean';
}

async function evaluateComicRateLimit(
  client: PoolClient,
  userId: string,
): Promise<boolean> {
  const result = await client.query<CountRow>(
    `
      SELECT COUNT(*)::text AS total
      FROM comic_turns t
      JOIN comic_conversations c ON c.id = t.conversation_id
      WHERE c.user_id = $1
        AND t.role = 'user'
        AND t.created_at >= NOW() - ($2::text || ' minutes')::interval
    `,
    [userId, String(COMIC_MESSAGE_RATE_WINDOW_MINUTES)],
  );

  const total = Number.parseInt(result.rows[0]?.total ?? '0', 10);
  return total < COMIC_MESSAGE_RATE_LIMIT;
}

async function resolveConversation(
  client: PoolClient,
  userId: string,
  username: string | null,
  channel: ComicChannel,
  conversationId: string | null,
): Promise<string> {
  if (conversationId) {
    const existing = await client.query<ConversationRow>(
      `
        SELECT id, user_id, channel, status, created_at
        FROM comic_conversations
        WHERE id = $1::uuid AND user_id = $2
        LIMIT 1
      `,
      [conversationId, userId],
    );

    if (existing.rows.length > 0) {
      // Touch updated_at, and backfill the asker's @username if it was missing (older row) or has
      // since changed — COALESCE keeps a stored value when the current request has none.
      await client.query(
        'UPDATE comic_conversations SET updated_at = NOW(), asker_username = COALESCE($2, asker_username) WHERE id = $1::uuid',
        [conversationId, username],
      );
      return existing.rows[0].id;
    }
  }

  const created = await client.query<{ id: string }>(
    `
      INSERT INTO comic_conversations (user_id, asker_username, channel, status)
      VALUES ($1, $2, $3, 'open')
      RETURNING id
    `,
    [userId, username, channel],
  );

  return created.rows[0].id;
}

async function insertTurn(
  client: PoolClient,
  input: {
    conversationId: string;
    role: 'user' | 'bot' | 'human';
    body: string;
    intent: string | null;
    nluConfidence: number | null;
    engine: ComicTurnEngine;
    // comic_knowledge_entries ids injected as grounding when this bot draft was generated (#504).
    // Omitted (empty) for user/human turns and ungrounded drafts.
    groundingEntryIds?: string[];
  },
): Promise<string> {
  const inserted = await client.query<{ id: string }>(
    `
      INSERT INTO comic_turns (conversation_id, role, body, intent, nlu_confidence, engine, grounding_entry_ids)
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id
    `,
    [
      input.conversationId,
      input.role,
      input.body,
      input.intent,
      input.nluConfidence,
      input.engine,
      JSON.stringify(input.groundingEntryIds ?? []),
    ],
  );

  return inserted.rows[0].id;
}

type OllamaDraft = {
  body: string;
  engine: ComicTurnEngine;
  modelId: string;
  latencyMs: number;
  promptTokenCount: number;
  completionTokenCount: number;
  // Why the model draft failed, when it fell back to the `template` engine (timeout, model-not-found,
  // auth, network, or not configured). Null on a real draft. Surfaced by the admin "Generate draft"
  // action so the reviewer sees the real cause instead of a blanket "unreachable".
  failureReason: string | null;
  // comic_knowledge_entries ids injected as grounding for this draft (#504 retrieval step).
  // Empty when retrieval found nothing (or failed) — the draft ran ungrounded.
  groundingEntryIds: string[];
};

type ComicGroundingEntry = {
  id: string;
  title: string | null;
  question: string | null;
  content: string;
};

// Fetch the top-ranked knowledge-base entries for an asker question via Postgres full-text search
// (#504 retrieval step). websearch_to_tsquery accepts free text safely, so the asker's words go in
// unmodified. Never throws: retrieval is best-effort and an empty result simply means the draft
// runs ungrounded, exactly as before this feature.
async function retrieveComicGrounding(questionBody: string): Promise<ComicGroundingEntry[]> {
  try {
    const result = await queryDb<ComicGroundingEntry>(
      `
        SELECT id, title, question, content
        FROM comic_knowledge_entries
        WHERE active
          AND to_tsvector('english', COALESCE(question, '') || ' ' || COALESCE(title, '') || ' ' || content)
              @@ websearch_to_tsquery('english', $1)
        ORDER BY ts_rank(
          to_tsvector('english', COALESCE(question, '') || ' ' || COALESCE(title, '') || ' ' || content),
          websearch_to_tsquery('english', $1)
        ) DESC
        LIMIT $2
      `,
      [questionBody, COMIC_GROUNDING_TOP_K],
    );
    return result.rows;
  } catch (err) {
    console.error('[comic/repository] knowledge retrieval failed, drafting ungrounded', err);
    return [];
  }
}

// Render retrieved entries as a grounding block appended to the model instructions: verified excerpts
// of the community's own published answers, in the owner's voice, for the model to draw on.
function buildGroundingPrompt(entries: ComicGroundingEntry[]): string {
  const excerpts = entries
    .map((entry, index) => {
      const heading = entry.question || entry.title || `Excerpt ${index + 1}`;
      const body = entry.content.slice(0, COMIC_GROUNDING_MAX_ENTRY_CHARS);
      return `[${index + 1}] ${heading}\n${body}`;
    })
    .join('\n\n');
  return (
    '\n\nGround your answer in the following verified excerpts from this community\'s own ' +
    'published answers and documentation. Prefer their guidance, facts, and tone over your ' +
    'general knowledge. Do not invent details that contradict them. Do not mention the excerpts ' +
    'or their numbering in your answer.\n\n' +
    excerpts
  );
}

// Draft an answer via Ollama, reusing the shared survivor guidance. The draft is captured but,
// under the interim policy, NEVER returned to the asker — it is enqueued for human review.
async function generateComicDraft(questionBody: string): Promise<OllamaDraft> {
  const startedAt = Date.now();

  // Captured on failure so the caller can report WHY drafting fell back to the template (timeout,
  // model-not-found, auth, network) rather than a blanket "unreachable".
  let failureReason: string | null = null;
  if (isOllamaConfigured()) {
    try {
      // Retrieval grounding (#504): look up the owner's past answers / knowledge entries relevant
      // to this question and inject them into the model instructions, so the draft is grounded in our
      // data instead of the base model's generic training. Best-effort — an empty result means the
      // draft simply runs ungrounded.
      const grounding = await retrieveComicGrounding(questionBody);
      const systemPrompt =
        grounding.length > 0 ? SURVIVOR_SYSTEM_PROMPT + buildGroundingPrompt(grounding) : SURVIVOR_SYSTEM_PROMPT;

      const result = await callOllamaChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: questionBody },
      ]);

      return {
        body: result.content,
        engine: 'ollama',
        modelId: `ollama/${OLLAMA_MODEL}`,
        latencyMs: result.latencyMs,
        // token counts are length-based estimates for logging only, not billing
        promptTokenCount: Math.max(24, Math.ceil((questionBody.length + systemPrompt.length) / 4)),
        completionTokenCount: Math.max(48, Math.ceil(result.content.length / 4)),
        failureReason: null,
        groundingEntryIds: grounding.map((entry) => entry.id),
      };
    } catch (err) {
      console.error('[comic/repository] Ollama draft failed, using template fallback', err);
      failureReason = describeOllamaFailure(err);
    }
  } else {
    failureReason = describeOllamaFailure(new Error('ollama_not_configured'));
  }

  // Deterministic template fallback when Ollama is unavailable. This is a holding draft for the
  // reviewer to replace — it is never auto-published either.
  const body = `Draft pending review. The asker requested: "${questionBody}". A teammate will provide a verified, survivor-safe answer.`;
  return {
    body,
    engine: 'template',
    modelId: 'ctf-comic-template-v1',
    latencyMs: Math.max(1, Date.now() - startedAt),
    promptTokenCount: Math.max(24, Math.ceil(questionBody.length / 4)),
    completionTokenCount: Math.max(24, Math.ceil(body.length / 4)),
    failureReason,
    groundingEntryIds: [],
  };
}

async function enqueueReview(client: PoolClient, turnId: string, reason: string | null): Promise<string> {
  const inserted = await client.query<{ id: string }>(
    `
      INSERT INTO comic_review_queue (turn_id, status, reason)
      VALUES ($1::uuid, 'pending', $2)
      RETURNING id
    `,
    [turnId, reason],
  );

  return inserted.rows[0].id;
}

async function logComicInference(
  input: {
    actorId: string;
    draft: OllamaDraft;
  },
): Promise<void> {
  // `llm_inference_log` requires non-null question_id/answer_id FKs into the feed tables, so the
  // comic generation audit is recorded on the comic turns themselves (request/response payloads)
  // and not forced into the feed-shaped log. We keep a structured console audit for parity with
  // the feed inference trail without violating the feed FK constraints.
  console.info(
    '[comic.inference]',
    JSON.stringify({
      actorId: input.actorId,
      modelId: input.draft.modelId,
      engine: input.draft.engine,
      latencyMs: input.draft.latencyMs,
      promptTokenCount: input.draft.promptTokenCount,
      completionTokenCount: input.draft.completionTokenCount,
      totalTokenCount: input.draft.promptTokenCount + input.draft.completionTokenCount,
      groundingEntryCount: input.draft.groundingEntryIds.length,
      status: 'completed',
    }),
  );
}

// The review-queue reason recorded for a captured question: safety-flagged questions carry their
// category; everything else is the interim human-review marker. Extracted from routeComicMessage to
// keep that function within the complexity budget.
function deriveReviewReason(safety: ReturnType<typeof evaluateComicSafety>): string {
  return safety.flagged ? `safety:${safety.category}` : 'interim_human_review';
}

// Build the caller-facing route result for a captured @comic question. Safety-flagged questions are
// handled human-first (no draft, safety holding response); everything else returns the standard
// review-pending holding response. Extracted from routeComicMessage to keep that function within the
// complexity budget.
function buildRoutedResult(
  safety: ReturnType<typeof evaluateComicSafety>,
  ids: { conversationId: string; userTurnId: string; reviewId: string },
): ComicMessageRouteResult {
  return {
    outcome: safety.flagged ? 'human_first' : 'review_pending',
    conversationId: ids.conversationId,
    userTurnId: ids.userTurnId,
    draftTurnId: null,
    reviewId: ids.reviewId,
    safetyCategory: safety.flagged ? safety.category : null,
    holdingResponse: safety.flagged ? COMIC_SAFETY_HOLDING_RESPONSE : COMIC_HOLDING_RESPONSE,
  };
}

// Route an inbound chat message. If it mentions @comic: capture the user turn, run consent +
// moderation + safety checks, generate a draft (unless safety-flagged), enqueue to review, and
// return only a holding response — never the unreviewed draft. No mention → no-op.
export async function routeComicMessage(
  actorId: string,
  actorUsername: string | null,
  input: ComicMessageInput,
): Promise<ComicMessageRouteResult> {
  const rawBody = normalizeText(input.body);

  if (!mentionsComic(rawBody)) {
    return {
      outcome: 'not_mentioned',
      conversationId: '',
      userTurnId: '',
      draftTurnId: null,
      reviewId: null,
      safetyCategory: null,
      holdingResponse: '',
    };
  }

  const questionBody = stripComicMention(rawBody);
  if (!passesComicModeration(questionBody)) {
    throw new Error('content_policy_violation');
  }

  if (!input.consentGranted) {
    throw new Error('llm_consent_required');
  }

  const channel = normalizeChannel(input.channel);
  const safety = evaluateComicSafety(questionBody);

  // Gate on the rate limit FIRST (its own short, read-only transaction). The check is just a COUNT
  // of recent turns, so running it separately from the insert below is safe — the tiny concurrency
  // window is acceptable for a soft throttle.
  const allowed = await withDbTransaction((client) => evaluateComicRateLimit(client, actorId));
  if (!allowed) {
    throw new Error('rate_limit_exceeded');
  }

  // Capture the question and enqueue it for human review IMMEDIATELY — before any AI draft work, in
  // one short transaction. This guarantees every question reaches the review queue and lets the
  // asker's submit return without waiting on the model. A slow model call (a serverless GPU cold
  // start can take tens of seconds) no longer blocks the request. No NLU label is attached; the
  // intent/confidence columns stay null (kept for historical data only). Every answer still goes to
  // human review — see #504 for the future confidence-gated auto-publish.
  const reason = deriveReviewReason(safety);
  const { conversationId, userTurnId, reviewId } = await withDbTransaction(async (client) => {
    const resolvedConversationId = await resolveConversation(client, actorId, actorUsername, channel, input.conversationId ?? null);
    const insertedUserTurnId = await insertTurn(client, {
      conversationId: resolvedConversationId,
      role: 'user',
      body: questionBody,
      intent: null,
      nluConfidence: null,
      engine: 'human',
    });
    const insertedReviewId = await enqueueReview(client, insertedUserTurnId, reason);
    return { conversationId: resolvedConversationId, userTurnId: insertedUserTurnId, reviewId: insertedReviewId };
  });

  // For non-safety-flagged questions, generate the AI draft in the BACKGROUND and attach it to the
  // review row just created. Detached on purpose (`void`): the asker's submit must not wait on the
  // model. On the persistent Node server this promise runs after the response is sent; if it never
  // finishes (process restart, model down) the question simply stays a human-answered review, so the
  // human-review guarantee is unaffected. Safety-flagged questions skip the draft (human-first).
  if (!safety.flagged && isOllamaConfigured()) {
    void generateAndAttachDraft({ actorId, conversationId, reviewId, questionBody });
  }

  return buildRoutedResult(safety, { conversationId, userTurnId, reviewId });
}

// Background draft generation. Called detached (not awaited) from routeComicMessage after the
// question is already queued for review. Generates the AI draft, then — only if the reviewer has
// not already resolved the question — inserts it as a bot turn and records it on the review row's
// `draft_turn_id`. The review's `turn_id` is NEVER repointed: it stays the asker's question turn so
// the question is inferred stably even if the asker sends another message before the draft lands.
// Never throws: any failure leaves the question as a human-first review for a person to answer.
async function generateAndAttachDraft(input: {
  actorId: string;
  conversationId: string;
  reviewId: string;
  questionBody: string;
}): Promise<void> {
  try {
    const draft = await generateComicDraft(input.questionBody);
    // A `template` engine means Ollama was unavailable and generateComicDraft fell back to the
    // placeholder. That is a failed generation, not a real draft — leave the item as a human-first
    // review rather than flipping it into draft-review mode with a useless placeholder.
    if (draft.engine === 'template') {
      return;
    }
    await logComicInference({ actorId: input.actorId, draft });
    await withDbTransaction(async (client) => {
      const pending = await client.query<{ id: string }>(
        `SELECT id FROM comic_review_queue WHERE id = $1::uuid AND status = 'pending' FOR UPDATE`,
        [input.reviewId],
      );
      if (pending.rows.length === 0) {
        // Resolved by a reviewer (or removed) while the draft was generating — leave it alone.
        return;
      }
      const draftTurnId = await insertTurn(client, {
        conversationId: input.conversationId,
        role: 'bot',
        body: draft.body,
        intent: null,
        nluConfidence: null,
        engine: draft.engine,
        groundingEntryIds: draft.groundingEntryIds,
      });
      await client.query(
        `UPDATE comic_review_queue SET draft_turn_id = $2::uuid WHERE id = $1::uuid AND status = 'pending'`,
        [input.reviewId, draftTurnId],
      );
    });
  } catch (err) {
    console.error('[comic/repository] background draft generation/attach failed', err);
  }
}

// Admin "Regenerate draft": re-run the model for a still-pending review and (re)attach its draft.
// Unlike the background draft at ask time, this is synchronous so the dashboard learns the outcome.
// Returns whether a real draft was attached; when drafting fails (template fallback), nothing is
// attached and { attached: false, reason } is returned — `reason` names the real cause (timeout,
// model-not-found, auth, network) so the UI can say WHY instead of a blanket "unreachable". Used to
// clear a backlog of draftless questions once the engine (e.g. the RunPod endpoint) is healthy.
export async function regenerateComicDraft(
  actorId: string,
  reviewId: string,
): Promise<{ attached: boolean; reason: string | null }> {
  const reviewRes = await queryDb<{ id: string; turn_id: string; status: string }>(
    `SELECT id, turn_id, status FROM comic_review_queue WHERE id = $1::uuid LIMIT 1`,
    [reviewId],
  );
  const review = reviewRes.rows[0];
  if (!review) {
    throw new Error('review_not_found');
  }
  if (review.status !== 'pending') {
    throw new Error('review_already_resolved');
  }

  const turnRes = await queryDb<{ conversation_id: string; body: string }>(
    `SELECT conversation_id, body FROM comic_turns WHERE id = $1::uuid LIMIT 1`,
    [review.turn_id],
  );
  const turn = turnRes.rows[0];
  if (!turn) {
    throw new Error('review_not_found');
  }

  const draft = await generateComicDraft(turn.body);
  // Drafting failed -> template fallback. Leave the item human-first rather than attaching a
  // placeholder, exactly as the background path does, but pass back the real reason it failed.
  if (draft.engine === 'template') {
    return { attached: false, reason: draft.failureReason };
  }

  await logComicInference({ actorId, draft });
  await withDbTransaction(async (client) => {
    const pending = await client.query<{ id: string }>(
      `SELECT id FROM comic_review_queue WHERE id = $1::uuid AND status = 'pending' FOR UPDATE`,
      [reviewId],
    );
    if (pending.rows.length === 0) {
      // Resolved or removed between the check and now — leave it alone.
      return;
    }
    const draftTurnId = await insertTurn(client, {
      conversationId: turn.conversation_id,
      role: 'bot',
      body: draft.body,
      intent: null,
      nluConfidence: null,
      engine: draft.engine,
      groundingEntryIds: draft.groundingEntryIds,
    });
    await client.query(
      `UPDATE comic_review_queue SET draft_turn_id = $2::uuid WHERE id = $1::uuid AND status = 'pending'`,
      [reviewId, draftTurnId],
    );
  });
  return { attached: true, reason: null };
}

function clampPage(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value < 1) {
    return COMIC_DEFAULT_PAGE;
  }
  return Math.floor(value);
}

function clampPageSize(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value < 1) {
    return COMIC_DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(value), COMIC_MAX_PAGE_SIZE);
}

function extractSafetyCategory(reason: string | null): string | null {
  if (reason && reason.startsWith('safety:')) {
    return reason.slice('safety:'.length);
  }
  return null;
}

function mapReviewRow(row: ReviewRow): ComicReviewItem {
  return {
    reviewId: row.review_id,
    turnId: row.turn_id,
    conversationId: row.conversation_id,
    askedByUserId: row.asked_by_user_id,
    askedByUsername: row.asked_by_username,
    questionBody: row.question_body,
    draftBody: row.draft_body,
    hasDraft: row.has_draft,
    intent: row.intent,
    nluConfidence: toNumberOrNull(row.nlu_confidence),
    engine: row.engine,
    status: row.status,
    safetyCategory: extractSafetyCategory(row.reason),
    createdAtIso: toIso(row.created_at),
  };
}

// Admin list of pending review items. Joins each queued turn back to its conversation and the
// most recent preceding user turn so the reviewer sees the asker's question alongside the draft.
export async function listPendingComicReviews(
  page?: number,
  pageSize?: number,
): Promise<ComicReviewPage> {
  const resolvedPage = clampPage(page);
  const resolvedPageSize = clampPageSize(pageSize);
  const offset = (resolvedPage - 1) * resolvedPageSize;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*)::text AS total FROM comic_review_queue WHERE status = 'pending'`,
  );
  const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

  // q.turn_id is always the asker's question turn (never repointed), so the question is t.body
  // directly. The AI draft, when one was generated in the background, is the turn referenced by
  // q.draft_turn_id; LEFT JOIN it and fall back to the question body for human-first items (no
  // draft), matching the prior dashboard behavior. engine likewise prefers the draft turn's engine.
  const result = await queryDb<ReviewRow>(
    `
      SELECT
        q.id AS review_id,
        q.turn_id AS turn_id,
        t.conversation_id AS conversation_id,
        c.user_id AS asked_by_user_id,
        c.asker_username AS asked_by_username,
        t.body AS question_body,
        COALESCE(d.body, t.body) AS draft_body,
        (q.draft_turn_id IS NOT NULL) AS has_draft,
        t.intent AS intent,
        t.nlu_confidence::text AS nlu_confidence,
        COALESCE(d.engine, t.engine) AS engine,
        q.status AS status,
        q.reason AS reason,
        q.created_at AS created_at
      FROM comic_review_queue q
      JOIN comic_turns t ON t.id = q.turn_id
      JOIN comic_conversations c ON c.id = t.conversation_id
      LEFT JOIN comic_turns d ON d.id = q.draft_turn_id
      WHERE q.status = 'pending'
      ORDER BY q.created_at ASC
      LIMIT $1 OFFSET $2
    `,
    [resolvedPageSize, offset],
  );

  return {
    items: result.rows.map(mapReviewRow),
    pagination: {
      page: resolvedPage,
      pageSize: resolvedPageSize,
      total,
    },
  };
}

function normalizeResolution(value: unknown): ComicReviewResolution | null {
  if (value === 'approve' || value === 'correct' || value === 'reject') {
    return value;
  }
  return null;
}

// Map a resolution to the review-queue status it produces. Extracted from resolveComicReview to keep
// that transaction callback within the complexity budget.
function computeReviewStatus(resolution: ComicReviewResolution): ComicReviewStatus {
  if (resolution === 'approve') {
    return 'approved';
  }
  if (resolution === 'correct') {
    return 'corrected';
  }
  return 'rejected';
}

// Create the published answer turn (and, for a correction, the supervised training example) for a
// resolved review, returning both new ids:
//   - correct → a new `human` turn with the corrected body, plus a training example;
//   - approve with an AI draft → the draft turn itself;
//   - approve of a human-first review → a new `human` turn with the reviewer's content;
//   - reject → neither.
// Extracted from resolveComicReview to keep that transaction callback within the complexity budget.
async function createComicAnswerArtifacts(
  client: PoolClient,
  input: {
    resolution: ComicReviewResolution;
    correctedBody: string | null;
    hasDraft: boolean;
    draftTurnId: string | null;
    conversationId: string;
    questionTurnId: string;
    questionBody: string;
    intentLabel: string;
  },
): Promise<{ answerTurnId: string | null; trainingExampleId: string | null }> {
  let trainingExampleId: string | null = null;
  let answerTurnId: string | null = null;

  if (input.resolution === 'correct' && input.correctedBody) {
    // A correction is a supervised training signal: persist the asker's question text under a
    // coarse intent label for the training export. (Approvals/rejections are not training
    // examples — only owner-authored corrections are.)
    const trainingInsert = await client.query<{ id: string }>(
      `
        INSERT INTO comic_training_examples (source_turn_id, intent_label, text, status)
        VALUES ($1::uuid, $2, $3, 'pending')
        RETURNING id
      `,
      [input.questionTurnId, input.intentLabel, input.questionBody],
    );
    trainingExampleId = trainingInsert.rows[0].id;

    // Record the corrected answer as a human turn so the conversation reflects the approved
    // text and future exports can pair question → corrected answer.
    answerTurnId = await insertTurn(client, {
      conversationId: input.conversationId,
      role: 'human',
      body: input.correctedBody,
      intent: input.intentLabel,
      nluConfidence: null,
      engine: 'human',
    });
  } else if (input.resolution === 'approve') {
    if (input.hasDraft) {
      // Approving publishes the AI draft turn as-is.
      answerTurnId = input.draftTurnId;
    } else if (input.correctedBody) {
      // Approving a human-first review publishes the reviewer's authored content as a human turn.
      answerTurnId = await insertTurn(client, {
        conversationId: input.conversationId,
        role: 'human',
        body: input.correctedBody,
        intent: input.intentLabel,
        nluConfidence: null,
        engine: 'human',
      });
    }
  }

  return { answerTurnId, trainingExampleId };
}

// Resolve a review: approve (publish the draft as-is), correct (reviewer edits the draft), or
// reject. A corrected resolution persists the corrected text as a comic_training_example so the
// CDD flywheel accumulates supervised data. Returns the new training example id when one is made.
export async function resolveComicReview(
  reviewerUserId: string,
  reviewId: string,
  input: ComicReviewResolveInput,
): Promise<ComicReviewResolveResult> {
  const resolution = normalizeResolution(input.resolution);
  if (!resolution) {
    throw new Error('invalid_resolution');
  }

  const correctedBody = normalizeNullableText(input.correctedBody);
  const reason = normalizeNullableText(input.reason);
  // Validate the reviewer-chosen plugin slugs against the visible registry up front (outside the
  // transaction): drop unknown/hidden slugs, dedupe, cap. The deduped, validated list is stored on
  // the published answer turn below for approve and correct alike; reject stores nothing.
  const linkedPluginSlugs = await validateLinkedPluginSlugs(input.linkedPluginSlugs);

  if (resolution === 'correct') {
    if (!correctedBody) {
      throw new Error('correction_required');
    }
    if (correctedBody.length > COMIC_MAX_CORRECTION_LENGTH) {
      throw new Error('correction_too_long');
    }
  }

  if (reason && reason.length > COMIC_MAX_REASON_LENGTH) {
    throw new Error('reason_too_long');
  }

  return withDbTransaction(async (client) => {
    const queued = await client.query<{
      id: string;
      turn_id: string;
      draft_turn_id: string | null;
      status: ComicReviewStatus;
      reason: string | null;
    }>(
      `
        SELECT id, turn_id, draft_turn_id, status, reason
        FROM comic_review_queue
        WHERE id = $1::uuid
        LIMIT 1
        FOR UPDATE
      `,
      [reviewId],
    );

    if (queued.rows.length === 0) {
      throw new Error('review_not_found');
    }

    const review = queued.rows[0];
    if (review.status !== 'pending') {
      throw new Error('review_already_resolved');
    }

    // turn_id is always the asker's question turn. Fetch it for its conversation + body (used to
    // place reviewer-authored turns and as the training-example question text).
    const turnResult = await client.query<TurnRow>(
      `
        SELECT id, conversation_id, role, body, intent, nlu_confidence::text, engine, created_at
        FROM comic_turns
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [review.turn_id],
    );
    const turn = turnResult.rows[0];

    // A background AI draft (draft_turn_id) is publishable as-is. Without one this is a human-first
    // review (the asker's question), so approval REQUIRES reviewer-authored content (correctedBody).
    const hasDraft = review.draft_turn_id !== null;
    if (resolution === 'approve' && !hasDraft && !correctedBody) {
      throw new Error('approve_requires_content');
    }

    const newStatus: ComicReviewStatus = computeReviewStatus(resolution);

    // The question turn is the queued turn itself (turn_id is never repointed off it).
    const questionBody = turn.body;

    const safetyCategory = extractSafetyCategory(review.reason);
    const intentLabel = deriveIntentLabel(safetyCategory);

    // The turn that becomes the asker's visible, rateable answer. Linked on the review row so the
    // asker stream and rating both resolve to the exact published text:
    //   - correct → a new `human` turn with the corrected body;
    //   - approve with an AI draft → the draft turn itself;
    //   - approve of a human-first review → a new `human` turn with the reviewer's content;
    //   - reject → none.
    const { answerTurnId, trainingExampleId } = await createComicAnswerArtifacts(client, {
      resolution,
      correctedBody,
      hasDraft,
      draftTurnId: review.draft_turn_id,
      conversationId: turn.conversation_id,
      questionTurnId: review.turn_id,
      questionBody,
      intentLabel,
    });

    // Tag the published answer turn with the reviewer's applicable plugins. Applies to whichever
    // turn became the answer: the reused AI draft (approve), or a freshly inserted human turn
    // (correct / approved human-first). Reject has no answer turn, so nothing is tagged.
    if (answerTurnId) {
      await client.query(
        `UPDATE comic_turns SET linked_plugin_slugs = $2::jsonb WHERE id = $1::uuid`,
        [answerTurnId, JSON.stringify(linkedPluginSlugs)],
      );
    }

    const updated = await client.query<{ decided_at: Date }>(
      `
        UPDATE comic_review_queue
        SET status = $2,
            reviewer_user_id = $3,
            corrected_body = $4,
            reason = COALESCE($5, reason),
            answer_turn_id = $6::uuid,
            decided_at = NOW()
        WHERE id = $1::uuid
        RETURNING decided_at
      `,
      [reviewId, newStatus, reviewerUserId, correctedBody, reason, answerTurnId],
    );

    return {
      reviewId,
      turnId: review.turn_id,
      status: newStatus,
      trainingExampleId,
      decidedAtIso: toIso(updated.rows[0].decided_at),
    };
  });
}

// Export accumulated training examples (asker questions + the intent labels assigned during
// owner correction) grouped by intent. Supersedes the feed category-only export by sourcing real
// turns + corrections. A single loop — no double counting.
//
// Every non-discarded row is included on every call — the export is the whole dataset, not a
// take-once queue — but the ids of the rows still sitting at 'pending' come back alongside it so
// the caller can mark them exported (markComicTrainingExamplesExported). Rows whose text is blank
// after trimming are left out of both the grouped map and the id list, so nothing is marked as
// exported that did not actually reach the file.
export async function exportComicTrainingExamples(): Promise<ComicTrainingExportResult> {
  const result = await queryDb<TrainingExportStatusRow>(
    `
      SELECT id, status, intent_label, text
      FROM comic_training_examples
      WHERE status <> 'discarded'
      ORDER BY intent_label ASC, created_at ASC
    `,
  );

  const byIntent: Record<string, string[]> = {};
  const pendingIds: string[] = [];
  for (const row of result.rows) {
    const label = row.intent_label || 'general';
    const text = row.text.replace(/\n/g, ' ').trim();
    if (text.length === 0) {
      continue;
    }
    if (!byIntent[label]) {
      byIntent[label] = [];
    }
    byIntent[label].push(text);
    if (row.status === 'pending') {
      pendingIds.push(row.id);
    }
  }

  return { byIntent, pendingIds };
}

// Record that the given training examples have been downloaded: flip 'pending' -> 'exported' and
// stamp exported_at. Called with the ids exportComicTrainingExamples just returned, so a row added
// while the file was being built stays 'pending' and is picked up by the next download. Only
// 'pending' rows are touched, which makes a repeated download a no-op rather than a re-stamp.
// Returns how many rows changed so the caller can report it.
export async function markComicTrainingExamplesExported(ids: readonly string[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const result = await queryDb<{ id: string }>(
    `
      UPDATE comic_training_examples
      SET status = 'exported', exported_at = NOW()
      WHERE id = ANY($1::uuid[]) AND status = 'pending'
      RETURNING id
    `,
    [ids],
  );

  return result.rows.length;
}

// Flat list helper (intent + text) for callers that want raw rows rather than the grouped map.
export async function listComicTrainingExamples(): Promise<ComicTrainingExample[]> {
  const result = await queryDb<TrainingExportRow>(
    `
      SELECT intent_label, text
      FROM comic_training_examples
      WHERE status <> 'discarded'
      ORDER BY intent_label ASC, created_at ASC
    `,
  );

  return result.rows.map((row) => ({ intentLabel: row.intent_label || 'general', text: row.text }));
}

type RatedAnswerExportRow = {
  question_body: string;
  answer_body: string;
  rating: ComicAnswerRatingValue;
  rated_at: Date;
};

// Export every answered @comic turn that carries a rating, paired with the asker's question text,
// the published answer text, and the most-recent rating value + when it was rated. This is the human
// feedback signal half of the training dataset (the other half is owner corrections, exported by
// exportComicTrainingExamples). DE-IDENTIFIED ON PURPOSE: no user id and no other PII leaves this
// query — only question/answer text + the rating value + timestamps. Each answer turn appears once;
// when several askers rated the same answer the most-recent rating wins (DISTINCT ON, newest first).
export async function exportComicRatedAnswers(): Promise<ComicRatedAnswerExample[]> {
  const result = await queryDb<RatedAnswerExportRow>(
    `
      SELECT
        uq.body AS question_body,
        ans.body AS answer_body,
        r.rating AS rating,
        r.updated_at AS rated_at
      FROM (
        -- Most-recent rating per answered turn (collapse multiple askers to one signal).
        SELECT DISTINCT ON (turn_id) turn_id, rating, updated_at
        FROM comic_answer_ratings
        ORDER BY turn_id, updated_at DESC
      ) r
      JOIN comic_turns ans ON ans.id = r.turn_id
      -- The review that published this answer turn, and its asker question turn (never repointed).
      JOIN comic_review_queue q ON q.answer_turn_id = ans.id AND q.status IN ('approved', 'corrected')
      JOIN comic_turns qt ON qt.id = q.turn_id
      -- The asker's question = the most recent user turn at/before the queued turn.
      JOIN LATERAL (
        SELECT ut.body
        FROM comic_turns ut
        WHERE ut.conversation_id = qt.conversation_id
          AND ut.role = 'user'
          AND ut.created_at <= qt.created_at
        ORDER BY ut.created_at DESC
        LIMIT 1
      ) uq ON TRUE
      ORDER BY r.updated_at DESC
    `,
  );

  const examples: ComicRatedAnswerExample[] = [];
  for (const row of result.rows) {
    const question = row.question_body.replace(/\n/g, ' ').trim();
    const answer = row.answer_body.replace(/\n/g, ' ').trim();
    if (question.length === 0 || answer.length === 0) {
      continue;
    }
    examples.push({ question, answer, rating: row.rating, ratedAtIso: toIso(row.rated_at) });
  }

  return examples;
}

type TrainingExamplesCountRow = { status: string; total: string };

// At-a-glance counts of the accumulated training signal for the @comic admin dashboard: the total
// non-discarded owner-correction examples (with a per-status breakdown) and the number of distinct
// answered turns that carry at least one rating. Read-only, used to show "how much data so far".
export async function getComicTrainingStats(): Promise<ComicTrainingStats> {
  const examplesResult = await queryDb<TrainingExamplesCountRow>(
    `
      SELECT status, COUNT(*)::text AS total
      FROM comic_training_examples
      WHERE status <> 'discarded'
      GROUP BY status
    `,
  );

  const trainingExamplesByStatus: Record<string, number> = {};
  let trainingExamplesTotal = 0;
  for (const row of examplesResult.rows) {
    const count = Number.parseInt(row.total ?? '0', 10);
    const safeCount = Number.isFinite(count) ? count : 0;
    trainingExamplesByStatus[row.status] = safeCount;
    trainingExamplesTotal += safeCount;
  }

  const ratedResult = await queryDb<CountRow>(
    `SELECT COUNT(DISTINCT turn_id)::text AS total FROM comic_answer_ratings`,
  );
  const ratedAnswersTotal = Number.parseInt(ratedResult.rows[0]?.total ?? '0', 10);

  return {
    trainingExamplesTotal,
    trainingExamplesByStatus,
    ratedAnswersTotal: Number.isFinite(ratedAnswersTotal) ? ratedAnswersTotal : 0,
  };
}

export function isValidComicAnswerRating(value: string): value is ComicAnswerRatingValue {
  return COMIC_ANSWER_RATINGS.includes(value as ComicAnswerRatingValue);
}

type AskerStreamRow = {
  question_turn_id: string;
  conversation_id: string;
  question_body: string;
  asked_at: Date;
  review_status: ComicReviewStatus;
  corrected_body: string | null;
  answer_turn_id: string | null;
  answer_body: string | null;
  answer_linked_plugin_slugs: unknown;
  rating: ComicAnswerRatingValue | null;
};

function mapAskerStreamRow(row: AskerStreamRow, nameBySlug: Map<string, string>): ComicAskerStreamItem {
  // Only approved/corrected reviews with a linked, published answer turn surface answer text;
  // everything else is still pending and the asker must never see the unreviewed draft. The linked
  // answer turn already holds the published text (the corrected human turn for corrections, the bot
  // draft for an approved draft, the reviewer's human turn for an approved human-first turn), so its
  // body is authoritative — fall back to corrected_body only if the link is somehow missing.
  const isAnswered =
    (row.review_status === 'approved' || row.review_status === 'corrected') && row.answer_turn_id !== null;
  const status: ComicAskerStreamStatus = isAnswered ? 'answered' : 'pending';
  const answer = isAnswered ? (row.answer_body ?? row.corrected_body) : null;

  return {
    questionTurnId: row.question_turn_id,
    conversationId: row.conversation_id,
    status,
    question: row.question_body,
    answer: status === 'answered' ? (answer ?? null) : null,
    answerTurnId: status === 'answered' ? row.answer_turn_id : null,
    currentUserRating: row.rating,
    // Plugin links live on the published answer turn — surface them only for answered items.
    linkedPlugins: status === 'answered' ? resolveLinkedPlugins(row.answer_linked_plugin_slugs, nameBySlug) : [],
    askedAtIso: toIso(row.asked_at),
  };
}

// The asker's own @comic Q&A history for the unified stream. Drives both the answered AI cards and
// the "Reviewing for safety" pending cards from real data. CRITICAL: this NEVER returns an
// unreviewed draft — answer text is surfaced only for approved/corrected reviews; pending and
// rejected items carry no answer body. Scoped to the requesting user's conversations only.
export async function listComicAskerStream(
  askerUserId: string,
  limit: number = COMIC_ASKER_STREAM_LIMIT,
): Promise<ComicAskerStreamPage> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), COMIC_ASKER_STREAM_LIMIT);

  const result = await queryDb<AskerStreamRow>(
    `
      SELECT
        uq.id AS question_turn_id,
        uq.conversation_id AS conversation_id,
        uq.body AS question_body,
        uq.created_at AS asked_at,
        q.status AS review_status,
        q.corrected_body AS corrected_body,
        ans.id AS answer_turn_id,
        ans.body AS answer_body,
        ans.linked_plugin_slugs AS answer_linked_plugin_slugs,
        r.rating AS rating
      FROM comic_review_queue q
      JOIN comic_turns qt ON qt.id = q.turn_id
      JOIN comic_conversations c ON c.id = qt.conversation_id
      -- The asker's question = the most recent user turn at/before the queued turn.
      JOIN LATERAL (
        SELECT ut.id, ut.conversation_id, ut.body, ut.created_at
        FROM comic_turns ut
        WHERE ut.conversation_id = qt.conversation_id
          AND ut.role = 'user'
          AND ut.created_at <= qt.created_at
        ORDER BY ut.created_at DESC
        LIMIT 1
      ) uq ON TRUE
      -- The published answer turn (linked when the review is approved/corrected): an approved bot
      -- draft, or the reviewer's human turn for a correction / approved human-first turn. Null
      -- while pending/rejected, so an unreviewed draft is never exposed.
      LEFT JOIN comic_turns ans ON ans.id = q.answer_turn_id
      LEFT JOIN comic_answer_ratings r ON r.turn_id = q.answer_turn_id AND r.user_id = $1
      WHERE c.user_id = $1
      ORDER BY uq.created_at DESC
      LIMIT $2
    `,
    [askerUserId, safeLimit],
  );

  // Resolve plugin slugs to display names once for the whole page (one registry fetch). Unknown or
  // now-hidden slugs are dropped when each row is mapped.
  const registry = await listPluginRegistry();
  const nameBySlug = new Map(registry.map((plugin) => [plugin.slug, plugin.name]));

  return { items: result.rows.map((row) => mapAskerStreamRow(row, nameBySlug)) };
}

// Rate an answered @comic turn (helpful / not_helpful / flagged). The turn must be an answer the
// asker is allowed to rate: it must belong to one of their conversations AND its review must be
// resolved as approved/corrected (an unreviewed draft is never ratable because it is never shown).
// One rating per (user, turn); re-rating updates in place. Feeds the CDD training flywheel.
export async function rateComicAnswer(
  actorId: string,
  turnId: string,
  rating: ComicAnswerRatingValue,
): Promise<ComicRateAnswerResult> {
  return withDbTransaction(async (client) => {
    const ratable = await client.query<{ id: string }>(
      `
        SELECT t.id
        FROM comic_turns t
        JOIN comic_conversations c ON c.id = t.conversation_id
        JOIN comic_review_queue q ON q.answer_turn_id = t.id
        WHERE t.id = $1::uuid
          AND c.user_id = $2
          AND q.status IN ('approved', 'corrected')
        LIMIT 1
      `,
      [turnId, actorId],
    );

    if (ratable.rows.length === 0) {
      throw new Error('answer_not_found');
    }

    const result = await client.query<{ updated_at: Date }>(
      `
        INSERT INTO comic_answer_ratings (user_id, turn_id, rating)
        VALUES ($1, $2::uuid, $3)
        ON CONFLICT (user_id, turn_id)
        DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()
        RETURNING updated_at
      `,
      [actorId, turnId, rating],
    );

    return {
      turnId,
      rating,
      ratedAtIso: toIso(result.rows[0].updated_at),
    };
  });
}
