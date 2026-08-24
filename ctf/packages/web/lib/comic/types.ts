export type ComicChannel = 'commons' | 'feed';

export type ComicTurnRole = 'user' | 'bot' | 'human';

// 'rasa' is retained as a historical value only (the Rasa NLU integration was removed 2026-06-14);
// no new turn is written with it. New AI drafts use 'ollama'.
export type ComicTurnEngine = 'rasa' | 'ollama' | 'template' | 'human';

export type ComicReviewStatus = 'pending' | 'approved' | 'corrected' | 'rejected';

export type ComicReviewResolution = 'approve' | 'correct' | 'reject';

export type ComicTrainingStatus = 'pending' | 'exported' | 'discarded';

export type ComicMessageInput = {
  body: string;
  channel?: ComicChannel;
  conversationId?: string | null;
  consentGranted: boolean;
};

// Outcome of routing an inbound chat message. `outcome` is always `review_pending` (draft enqueued,
// not surfaced) or `human_first` (safety-flagged, no draft); `not_mentioned` short-circuits before
// any assistant work happens.
export type ComicMessageRouteOutcome = 'review_pending' | 'human_first' | 'not_mentioned';

export type ComicMessageRouteResult = {
  outcome: ComicMessageRouteOutcome;
  conversationId: string;
  userTurnId: string;
  // The bot draft is captured server-side but is NEVER returned to the asker while a human
  // is reviewing; only the holding response is surfaced.
  draftTurnId: string | null;
  reviewId: string | null;
  safetyCategory: string | null;
  holdingResponse: string;
};

export type ComicSafetyEvaluation = {
  flagged: boolean;
  category: string | null;
};

export type ComicReviewItem = {
  reviewId: string;
  turnId: string;
  conversationId: string;
  askedByUserId: string;
  // The asker's @username snapshotted when they asked, or null for older rows asked before this was
  // captured. The dashboard shows @username when present and falls back to the user id otherwise.
  askedByUsername: string | null;
  questionBody: string;
  draftBody: string;
  // Whether a draft turn is attached to this item (`draft_turn_id` is non-null). False means no
  // draft is attached yet — it may still be generating in the background, drafting was unavailable,
  // or the question was safety-held — so the dashboard shows a "write the answer" state instead of
  // presenting the question text as if it were a draft.
  hasDraft: boolean;
  intent: string | null;
  nluConfidence: number | null;
  engine: ComicTurnEngine;
  status: ComicReviewStatus;
  safetyCategory: string | null;
  createdAtIso: string;
};

export type ComicReviewPage = {
  items: ComicReviewItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type ComicReviewResolveInput = {
  resolution: ComicReviewResolution;
  correctedBody?: string | null;
  reason?: string | null;
  // Plugin slugs the reviewer tagged as applicable to this answer. Validated against the visible
  // plugin registry, deduped, and capped server-side before being stored on the published answer
  // turn; unknown/hidden slugs are dropped. Omitted/empty = no plugin links.
  linkedPluginSlugs?: string[];
};

export type ComicReviewResolveResult = {
  reviewId: string;
  turnId: string;
  status: ComicReviewStatus;
  trainingExampleId: string | null;
  decidedAtIso: string;
};

export type ComicTrainingExample = {
  intentLabel: string;
  text: string;
};

// One run of the owner-correction training export: the questions grouped by intent label (what
// goes into the downloaded file) plus the ids of the rows in that file still sitting at 'pending',
// so the caller can record that they have now been downloaded.
export type ComicTrainingExportResult = {
  byIntent: Record<string, string[]>;
  pendingIds: string[];
};

export type ComicAnswerRatingValue = 'helpful' | 'not_helpful' | 'flagged';

// One answered @comic turn paired with its rating, for the de-identified training export. Holds the
// question text, the published answer text, the most-recent rating value, and when it was rated. It
// carries NO user id and no other PII — text + rating + timestamps only.
export type ComicRatedAnswerExample = {
  question: string;
  answer: string;
  rating: ComicAnswerRatingValue;
  ratedAtIso: string;
};

// At-a-glance counts of the accumulated training signal, for the @comic admin dashboard. Best-effort
// read; a failure to compute simply hides the counter.
export type ComicTrainingStats = {
  // Total non-discarded owner-correction training examples.
  trainingExamplesTotal: number;
  // Breakdown of those training examples by status ('pending' | 'exported'); 'discarded' is excluded.
  trainingExamplesByStatus: Record<string, number>;
  // Distinct answered turns that carry at least one rating.
  ratedAnswersTotal: number;
};

export type ComicRateAnswerResult = {
  turnId: string;
  rating: ComicAnswerRatingValue;
  ratedAtIso: string;
};

// One Q&A item in the asker's own @comic stream. Only answers a human has approved/corrected are
// surfaced — a pending item carries no answer text (the asker never sees an unreviewed draft).
export type ComicAskerStreamStatus = 'pending' | 'answered';

// A resolved plugin link shown beneath a published answer: the registry slug + display name. The
// slug builds the `/apps/<slug>` route; the name is the chip label.
export type ComicLinkedPlugin = {
  slug: string;
  name: string;
};

export type ComicAskerStreamItem = {
  // The asker's question turn id (stable key for the stream item).
  questionTurnId: string;
  conversationId: string;
  status: ComicAskerStreamStatus;
  question: string;
  // The approved/corrected answer text + its turn id (for rating). Null while pending.
  answer: string | null;
  answerTurnId: string | null;
  currentUserRating: ComicAnswerRatingValue | null;
  // Applicable plugins the reviewer tagged on the published answer, resolved to slug + display name.
  // Empty array when none (or while pending). Rendered as tappable plugin links under the answer.
  linkedPlugins: ComicLinkedPlugin[];
  askedAtIso: string;
};

export type ComicAskerStreamPage = {
  items: ComicAskerStreamItem[];
};
