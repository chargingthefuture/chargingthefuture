// comic AI Assistant (@comic) client for mobile. Mirrors the web routes under
// ctf/packages/web/app/api/comic/*. Postgres + polling, no third-party LLM egress.
// Interim safety policy: EVERY answer routes through human review before it reaches the asker
// (Rasa is not deployed) — there is no auto-publish path. The asker only ever sees an approved/
// corrected answer or the "Reviewing for safety" pending card.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

const BASE = '/api/comic';

// Mirrors lib/comic/constants COMIC_MENTION_REGEX: a message mentions the assistant when it
// contains @comic on a word boundary (case-insensitive). No @ → peer-to-peer, never the bot.
export const COMIC_MENTION_REGEX = /(^|\s)@comic\b/i;

export function mentionsComic(text: string): boolean {
  return COMIC_MENTION_REGEX.test(text);
}

export type ComicAnswerRating = 'helpful' | 'not_helpful' | 'flagged';

// One Q&A item in the asker's own @comic stream. Mirrors the server ComicAskerStreamItem: a
// pending item carries no answer text (the asker never sees an unreviewed draft).
export type ComicStreamItem = {
  questionTurnId: string;
  conversationId: string;
  status: 'pending' | 'answered';
  question: string;
  answer: string | null;
  answerTurnId: string | null;
  currentUserRating: ComicAnswerRating | null;
  askedAtIso: string;
};

export type ComicConversationResponse = {
  ok: true;
  items: ComicStreamItem[];
};

// The asker-facing read powering the AI cards interleaved in the stream.
export async function fetchComicConversation(): Promise<ComicStreamItem[]> {
  const res = await authedFetch(`${BASE}/conversation`);
  if (!res.ok) {
    throw new Error(`AI Assistant conversation request failed: ${res.status}`);
  }
  const data = (await res.json()) as ComicConversationResponse;
  return data.items ?? [];
}

export type ComicMessageOutcome = 'review_pending' | 'human_first';

export type ComicMessageResult = {
  ok: true;
  routedToAssistant: boolean;
  status?: ComicMessageOutcome;
  conversationId?: string;
  holdingResponse?: string;
};

// Send a chat message. Only messages mentioning @comic reach the assistant; everything else is a
// no-op here (peer-to-peer posting goes through the hub/feed path). The unreviewed draft is never
// returned — only a safe holding response (HTTP 202). `consentGranted` carries the first-use
// LLM-processing consent.
export async function sendComicMessage(
  body: string,
  consentGranted: boolean,
  conversationId?: string | null,
): Promise<ComicMessageResult> {
  const res = await authedFetch(`${BASE}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ body, channel: 'hub', consentGranted, conversationId: conversationId ?? null }),
  });

  if (res.status === 403) {
    // The server distinguishes a consent requirement from other denials via the error code.
    let code = '';
    try {
      const payload = (await res.json()) as { code?: string };
      code = payload.code ?? '';
    } catch {
      code = '';
    }
    if (code === 'COMIC_LLM_CONSENT_REQUIRED') {
      throw new Error('consent_required');
    }
    throw new Error('Sign in to ask the AI Assistant.');
  }

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('You are asking too quickly. Wait a moment and try again.');
    }
    if (res.status === 422) {
      throw new Error('That message was held back by content moderation.');
    }
    throw new Error(`Unable to reach the AI Assistant: ${res.status}`);
  }

  return (await res.json()) as ComicMessageResult;
}

export type ComicRateResult = {
  ok: true;
  turnId: string;
  rating: ComicAnswerRating;
  ratedAt: string;
};

// Rate an answered turn (helpful / not_helpful / flagged). One rating per (user, turn);
// re-rating updates in place. Feeds the training loop.
export async function rateComicAnswer(turnId: string, rating: ComicAnswerRating): Promise<ComicRateResult> {
  const res = await authedFetch(`${BASE}/answers/${turnId}/rate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) {
    throw new Error(`Unable to rate the answer: ${res.status}`);
  }
  return (await res.json()) as ComicRateResult;
}

// --- Owner Review & Correction Console (admin-gated server-side) ---

export type ComicReviewItem = {
  reviewId: string;
  turnId: string;
  conversationId: string;
  askedByUserId: string;
  questionBody: string;
  draftBody: string;
  intent: string | null;
  nluConfidence: number | null;
  engine: 'rasa' | 'ollama' | 'template' | 'human';
  status: 'pending' | 'approved' | 'corrected' | 'rejected';
  safetyCategory: string | null;
  createdAtIso: string;
};

export type ComicReviewResponse = {
  ok: true;
  items: ComicReviewItem[];
  pagination: { page: number; pageSize: number; total: number };
};

// The review queue. Returns 403 for non-admins (the console then shows an access notice).
export async function fetchComicReviewQueue(): Promise<{ items: ComicReviewItem[]; forbidden: boolean }> {
  const res = await authedFetch(`${BASE}/review`);
  if (res.status === 401 || res.status === 403) {
    return { items: [], forbidden: true };
  }
  if (!res.ok) {
    throw new Error(`Unable to load the review queue: ${res.status}`);
  }
  const data = (await res.json()) as ComicReviewResponse;
  return { items: data.items ?? [], forbidden: false };
}

export type ComicReviewResolution = 'approve' | 'correct' | 'reject';

export type ComicReviewResolveResult = {
  ok: true;
  reviewId: string;
  status: 'approved' | 'corrected' | 'rejected';
  trainingExampleId: string | null;
  decidedAt: string;
};

// Resolve a queued draft: approve, correct (edit), or reject. A correction persists a training
// example server-side. The `reviewId` is the dynamic path segment (named turnId on the route).
export async function resolveComicReview(
  reviewId: string,
  resolution: ComicReviewResolution,
  correctedBody?: string | null,
): Promise<ComicReviewResolveResult> {
  const res = await authedFetch(`${BASE}/review/${reviewId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ resolution, correctedBody: correctedBody ?? null }),
  });
  if (!res.ok) {
    if (res.status === 409) {
      throw new Error('That item was already resolved.');
    }
    throw new Error(`Unable to resolve the review item: ${res.status}`);
  }
  return (await res.json()) as ComicReviewResolveResult;
}
