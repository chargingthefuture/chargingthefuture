import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { callOllamaChat, isOllamaConfigured, OLLAMA_MODEL, SURVIVOR_SYSTEM_PROMPT } from 'lib/chatbot/ollama';
import {
  COMIC_DEFAULT_PAGE,
  COMIC_DEFAULT_PAGE_SIZE,
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
  forceHumanReview,
  mentionsComic,
  passesComicModeration,
  stripComicMention,
} from './policy';
import type {
  ComicChannel,
  ComicMessageInput,
  ComicMessageRouteResult,
  ComicReviewItem,
  ComicReviewPage,
  ComicReviewResolution,
  ComicReviewResolveInput,
  ComicReviewResolveResult,
  ComicReviewStatus,
  ComicTrainingExample,
  ComicTurnEngine,
} from './types';

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
  question_body: string;
  draft_body: string;
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

function normalizeChannel(value: unknown): ComicChannel {
  return value === 'feed' ? 'feed' : 'hub';
}

function toNumberOrNull(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// `general` is the safe default intent bucket; the safety category (when present) is the most
// useful coarse training label, otherwise everything goes to `general` until Rasa supplies real
// intents.
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
      await client.query(
        'UPDATE comic_conversations SET updated_at = NOW() WHERE id = $1::uuid',
        [conversationId],
      );
      return existing.rows[0].id;
    }
  }

  const created = await client.query<{ id: string }>(
    `
      INSERT INTO comic_conversations (user_id, channel, status)
      VALUES ($1, $2, 'open')
      RETURNING id
    `,
    [userId, channel],
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
  },
): Promise<string> {
  const inserted = await client.query<{ id: string }>(
    `
      INSERT INTO comic_turns (conversation_id, role, body, intent, nlu_confidence, engine)
      VALUES ($1::uuid, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [input.conversationId, input.role, input.body, input.intent, input.nluConfidence, input.engine],
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
};

// Draft an answer via Ollama, reusing the survivor system prompt. The draft is captured but,
// under the interim policy, NEVER returned to the asker — it is enqueued for human review.
async function generateComicDraft(questionBody: string): Promise<OllamaDraft> {
  const startedAt = Date.now();

  if (isOllamaConfigured()) {
    try {
      const result = await callOllamaChat([
        { role: 'system', content: SURVIVOR_SYSTEM_PROMPT },
        { role: 'user', content: questionBody },
      ]);

      return {
        body: result.content,
        engine: 'ollama',
        modelId: `ollama/${OLLAMA_MODEL}`,
        latencyMs: result.latencyMs,
        // token counts are length-based estimates for logging only, not billing
        promptTokenCount: Math.max(24, Math.ceil(questionBody.length / 4)),
        completionTokenCount: Math.max(48, Math.ceil(result.content.length / 4)),
      };
    } catch (err) {
      console.error('[comic/repository] Ollama draft failed, using template fallback', err);
    }
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
      status: 'completed',
    }),
  );
}

// Route an inbound chat message. If it mentions @comic: capture the user turn, run consent +
// moderation + safety checks, generate a draft (unless safety-flagged), enqueue to review, and
// return only a holding response — never the unreviewed draft. No mention → no-op.
export async function routeComicMessage(
  actorId: string,
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

  return withDbTransaction(async (client) => {
    const allowed = await evaluateComicRateLimit(client, actorId);
    if (!allowed) {
      throw new Error('rate_limit_exceeded');
    }

    const conversationId = await resolveConversation(client, actorId, channel, input.conversationId ?? null);

    const userTurnId = await insertTurn(client, {
      conversationId,
      role: 'user',
      body: questionBody,
      intent: null,
      nluConfidence: null,
      engine: 'human',
    });

    // Safety-flagged → human-first: no draft generated, queue the user turn for a human.
    if (safety.flagged) {
      const reviewId = await enqueueReview(client, userTurnId, `safety:${safety.category}`);
      return {
        outcome: 'human_first',
        conversationId,
        userTurnId,
        draftTurnId: null,
        reviewId,
        safetyCategory: safety.category,
        holdingResponse: COMIC_SAFETY_HOLDING_RESPONSE,
      };
    }

    // Not safety-flagged: draft via Ollama, capture as a bot turn, enqueue for review. While
    // Rasa is undeployed `forceHumanReview()` is always true, so nothing is auto-published.
    const draft = await generateComicDraft(questionBody);
    const draftTurnId = await insertTurn(client, {
      conversationId,
      role: 'bot',
      body: draft.body,
      intent: null,
      nluConfidence: null,
      engine: draft.engine,
    });

    await logComicInference({ actorId, draft });

    const mustReview = forceHumanReview();
    const reviewId = mustReview ? await enqueueReview(client, draftTurnId, 'interim_human_review') : null;

    return {
      outcome: 'review_pending',
      conversationId,
      userTurnId,
      draftTurnId,
      reviewId,
      safetyCategory: null,
      holdingResponse: COMIC_HOLDING_RESPONSE,
    };
  });
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
    questionBody: row.question_body,
    draftBody: row.draft_body,
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

  const result = await queryDb<ReviewRow>(
    `
      SELECT
        q.id AS review_id,
        q.turn_id AS turn_id,
        t.conversation_id AS conversation_id,
        c.user_id AS asked_by_user_id,
        COALESCE(
          (
            SELECT ut.body
            FROM comic_turns ut
            WHERE ut.conversation_id = t.conversation_id
              AND ut.role = 'user'
              AND ut.created_at <= t.created_at
            ORDER BY ut.created_at DESC
            LIMIT 1
          ),
          t.body
        ) AS question_body,
        t.body AS draft_body,
        t.intent AS intent,
        t.nlu_confidence::text AS nlu_confidence,
        t.engine AS engine,
        q.status AS status,
        q.reason AS reason,
        q.created_at AS created_at
      FROM comic_review_queue q
      JOIN comic_turns t ON t.id = q.turn_id
      JOIN comic_conversations c ON c.id = t.conversation_id
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
      status: ComicReviewStatus;
      reason: string | null;
    }>(
      `
        SELECT id, turn_id, status, reason
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

    const newStatus: ComicReviewStatus =
      resolution === 'approve' ? 'approved' : resolution === 'correct' ? 'corrected' : 'rejected';

    const updated = await client.query<{ decided_at: Date }>(
      `
        UPDATE comic_review_queue
        SET status = $2,
            reviewer_user_id = $3,
            corrected_body = $4,
            reason = COALESCE($5, reason),
            decided_at = NOW()
        WHERE id = $1::uuid
        RETURNING decided_at
      `,
      [reviewId, newStatus, reviewerUserId, correctedBody, reason],
    );

    // The reviewed turn (the draft for review_pending; the user turn for human_first). Fetch its
    // body + conversation so corrections become training data tied to the source turn.
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

    // The asker's question for this turn (the most recent preceding user turn).
    const questionResult = await client.query<{ body: string }>(
      `
        SELECT body
        FROM comic_turns
        WHERE conversation_id = $1::uuid
          AND role = 'user'
          AND created_at <= $2::timestamptz
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [turn.conversation_id, turn.created_at.toISOString()],
    );
    const questionBody = questionResult.rows[0]?.body ?? turn.body;

    let trainingExampleId: string | null = null;

    // A correction is a supervised training signal: persist the asker's question text under a
    // coarse intent label so the export feeds Rasa NLU. (Approvals/rejections are not training
    // examples — only owner-authored corrections are.)
    if (resolution === 'correct' && correctedBody) {
      const safetyCategory = extractSafetyCategory(review.reason);
      const intentLabel = deriveIntentLabel(safetyCategory);

      const trainingInsert = await client.query<{ id: string }>(
        `
          INSERT INTO comic_training_examples (source_turn_id, intent_label, text, status)
          VALUES ($1::uuid, $2, $3, 'pending')
          RETURNING id
        `,
        [review.turn_id, intentLabel, questionBody],
      );
      trainingExampleId = trainingInsert.rows[0].id;

      // Record the corrected answer as a human turn so the conversation reflects the approved
      // text and future exports can pair question → corrected answer.
      await insertTurn(client, {
        conversationId: turn.conversation_id,
        role: 'human',
        body: correctedBody,
        intent: intentLabel,
        nluConfidence: null,
        engine: 'human',
      });
    }

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
export async function exportComicTrainingExamples(): Promise<Record<string, string[]>> {
  const result = await queryDb<TrainingExportRow>(
    `
      SELECT intent_label, text
      FROM comic_training_examples
      WHERE status <> 'discarded'
      ORDER BY intent_label ASC, created_at ASC
    `,
  );

  const grouped: Record<string, string[]> = {};
  for (const row of result.rows) {
    const label = row.intent_label || 'general';
    const text = row.text.replace(/\n/g, ' ').trim();
    if (text.length === 0) {
      continue;
    }
    if (!grouped[label]) {
      grouped[label] = [];
    }
    grouped[label].push(text);
  }

  return grouped;
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
