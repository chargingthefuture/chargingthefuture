export type ComicChannel = 'hub' | 'feed';

export type ComicTurnRole = 'user' | 'bot' | 'human';

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

// Outcome of routing an inbound chat message. While Rasa is undeployed, `outcome` is always
// `review_pending` (draft enqueued, not surfaced) or `human_first` (safety-flagged, no draft);
// `not_mentioned` short-circuits before any assistant work happens.
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
  questionBody: string;
  draftBody: string;
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
