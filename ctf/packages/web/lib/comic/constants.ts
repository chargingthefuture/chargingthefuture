export const COMIC_PLUGIN_ID = 'comic';

export const COMIC_ERROR_CODE = {
  invalidPayload: 'COMIC_INVALID_PAYLOAD',
  notFound: 'COMIC_NOT_FOUND',
  conflict: 'COMIC_CONFLICT',
  persistenceUnavailable: 'COMIC_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'COMIC_CSRF_DENIED',
  rateLimitExceeded: 'COMIC_RATE_LIMIT_EXCEEDED',
  consentRequired: 'COMIC_LLM_CONSENT_REQUIRED',
  llmUnavailable: 'COMIC_LLM_UNAVAILABLE',
  moderationRejected: 'COMIC_CONTENT_POLICY_VIOLATION',
  notMentioned: 'COMIC_MENTION_REQUIRED',
  reviewNotFound: 'COMIC_REVIEW_NOT_FOUND',
  reviewAlreadyResolved: 'COMIC_REVIEW_ALREADY_RESOLVED',
  answerNotFound: 'COMIC_ANSWER_NOT_FOUND',
} as const;

// Invocation is the `@comic` mention. A chat message that does not mention `@comic` is a
// peer-to-peer message and must never reach the assistant. Case-insensitive; a word boundary
// after the handle avoids matching e.g. `@comically`.
export const COMIC_MENTION_REGEX = /(^|\s)@comic\b/i;

export const COMIC_MAX_MESSAGE_LENGTH = 600;
export const COMIC_MAX_CORRECTION_LENGTH = 4000;
export const COMIC_MAX_REASON_LENGTH = 600;

// Retrieval grounding (#504): how many knowledge-base entries are injected into the draft prompt,
// and the per-entry excerpt cap that keeps the grounded prompt bounded.
export const COMIC_GROUNDING_TOP_K = 4;
export const COMIC_GROUNDING_MAX_ENTRY_CHARS = 1200;

export const COMIC_DEFAULT_PAGE = 1;
export const COMIC_DEFAULT_PAGE_SIZE = 20;
export const COMIC_MAX_PAGE_SIZE = 100;

// Rate limit for inbound @comic turns per user (mirrors feed question limits).
export const COMIC_MESSAGE_RATE_LIMIT = 12;
export const COMIC_MESSAGE_RATE_WINDOW_MINUTES = 60;

export const COMIC_CHANNELS = ['hub', 'feed'] as const;
export const COMIC_TURN_ROLES = ['user', 'bot', 'human'] as const;
// 'rasa' is retained as a historical engine value only (the Rasa NLU integration was removed
// 2026-06-14); no new turn is written with it. Mirrors the schema engine CHECK constraint.
export const COMIC_TURN_ENGINES = ['rasa', 'ollama', 'template', 'human'] as const;
export const COMIC_REVIEW_STATUSES = ['pending', 'approved', 'corrected', 'rejected'] as const;
export const COMIC_REVIEW_RESOLUTIONS = ['approve', 'correct', 'reject'] as const;
export const COMIC_TRAINING_STATUSES = ['pending', 'exported', 'discarded'] as const;

// Answer-rating values, identical to the feed quality signal so the CDD flywheel stays consistent.
export const COMIC_ANSWER_RATINGS = ['helpful', 'not_helpful', 'flagged'] as const;

// How many of the asker's own @comic Q&A items the stream surfaces at once.
export const COMIC_ASKER_STREAM_LIMIT = 30;

// Safety-category keyword buckets. A turn whose body matches any bucket is flagged
// human-first. Threshold tuning + the layered ML filter are a deliberate later pass; this
// keyword prefilter is the interim safety net (see the feature inventory "Future Notes").
export const COMIC_SAFETY_CATEGORIES: Record<string, RegExp> = {
  self_harm: /\b(suicide|suicidal|kill myself|end my life|self[-\s]?harm|hurt myself)\b/i,
  violence: /\b(kill (him|her|them|you)|murder|shoot|stab|bomb|weapon)\b/i,
  immediate_danger: /\b(being followed|in danger|threatened|abducted|trafficking|trafficked)\b/i,
  medical_emergency: /\b(overdose|can't breathe|cannot breathe|chest pain|unconscious|bleeding out)\b/i,
};

// Pre-approved, non-speculative holding response shown to the asker while a human reviews the
// draft. Brand-voice review of the final copy is a deliberate later pass (inventory Future Notes).
export const COMIC_HOLDING_RESPONSE =
  'Preparing your answer — a teammate is writing a verified, survivor-safe response. Answers typically arrive within 72 hours.';

export const COMIC_SAFETY_HOLDING_RESPONSE =
  'AI Assistant has flagged this message for a teammate to help with directly. If you are in immediate danger, contact local emergency services right away.';
