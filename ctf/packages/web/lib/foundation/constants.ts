export const FOUNDATION_DEFAULT_PAGE = 1;
export const FOUNDATION_DEFAULT_PAGE_SIZE = 20;
export const FOUNDATION_MAX_PAGE_SIZE = 100;

export const FOUNDATION_QUOTE_STATES = ['requested', 'provider_responded', 'closed'] as const;
export const FOUNDATION_CALL_MODALITIES = ['voice', 'video'] as const;

// Foundation instant 1:1 call (issue #808 task 3). Audio-only for v1 (owner decision): the ring is placed
// as a 'voice' call session and the audio room never publishes video.
//
// FOUNDATION_INSTANT_CALL_RING_TIMEOUT_SECONDS: how long an unanswered ring stays live before it
// auto-times-out (~60s per the issue). The server stamps ring_expires_at = now + this on ring; both the
// caller/callee poll and a lazy server-side sweep treat a ringing call past its expiry as timed_out.
export const FOUNDATION_INSTANT_CALL_RING_TIMEOUT_SECONDS = 60;

// Ring rate limit (v1 safety control): how many rings one member may place in the window, to stop a member
// spamming a provider with repeated incoming calls. Enforced via the shared foundation_rate_limit_counters.
export const FOUNDATION_INSTANT_CALL_RING_LIMIT = 5;
export const FOUNDATION_INSTANT_CALL_RING_WINDOW_SECONDS = 60;

// Per-block billing for the metered "Connect now" call (issue #808 task 4). At ring time the buyer
// pre-authorizes a maximum number of blocks; the call can never extend past this cap in v1 (there is no
// mid-session re-authorization). FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS is the default cap and
// FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS is the hard upper bound the buyer may pick, so a single
// call cannot pre-commit an unbounded spend.
export const FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS = 6;
export const FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS = 24;

export const FOUNDATION_ERROR_CODE = {
  invalidPayload: 'FOUNDATION_INVALID_PAYLOAD',
  persistenceUnavailable: 'FOUNDATION_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'FOUNDATION_CSRF_DENIED',
  providerNotFound: 'FOUNDATION_PROVIDER_NOT_FOUND',
  threadNotFound: 'FOUNDATION_THREAD_NOT_FOUND',
  notThreadParticipant: 'FOUNDATION_NOT_THREAD_PARTICIPANT',
  invalidQuoteTransition: 'FOUNDATION_INVALID_QUOTE_TRANSITION',
  quoteNotFound: 'FOUNDATION_QUOTE_NOT_FOUND',
  notificationNotFound: 'FOUNDATION_NOTIFICATION_NOT_FOUND',
  rateLimitExceeded: 'FOUNDATION_RATE_LIMIT_EXCEEDED',
  streamUnavailable: 'FOUNDATION_STREAM_UNAVAILABLE',
  policyDenied: 'FOUNDATION_POLICY_DENIED',
  // Foundation instant 1:1 call lifecycle (issue #808 task 3).
  callNotFound: 'FOUNDATION_CALL_NOT_FOUND',
  callNotRinging: 'FOUNDATION_CALL_NOT_RINGING',
  callNotCallee: 'FOUNDATION_CALL_NOT_CALLEE',
  calleeBusy: 'FOUNDATION_CALLEE_BUSY',
  // Foundation instant 1:1 call per-block billing (issue #808 task 4).
  callNotCaller: 'FOUNDATION_CALL_NOT_CALLER',
  callNotActive: 'FOUNDATION_CALL_NOT_ACTIVE',
  callInsufficientFunds: 'FOUNDATION_CALL_INSUFFICIENT_FUNDS',
  callBlockCapReached: 'FOUNDATION_CALL_BLOCK_CAP_REACHED',
  callBillingMisconfigured: 'FOUNDATION_CALL_BILLING_MISCONFIGURED',
} as const;
