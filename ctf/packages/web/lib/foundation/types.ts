export type FoundationQuoteState = 'requested' | 'provider_responded' | 'closed';
export type FoundationCallModality = 'voice' | 'video';

// Foundation instant 1:1 call ring/answer lifecycle (issue #808 task 3). 'none' is the default for the
// older generic (scheduled) call sessions that never ring. The instant-call state machine moves through:
// ringing -> answered | declined | timed_out -> ended. 'answered' is the in-call state (the callee picked
// up); 'ended' is the terminal state once either party hangs up.
export type FoundationCallRingStatus =
  | 'none'
  | 'ringing'
  | 'answered'
  | 'declined'
  | 'timed_out'
  | 'ended';

// One member's view of an instant call. The caller is the member who tapped "Connect now"; the callee is
// the provider being rung. streamCallId is the Stream Video call id the audio room joins. The Stream
// audio-join credentials are NOT carried on this view — they reuse the Direct Line participant-only token
// route, fetched separately, so there is no parallel token path.
export type FoundationInstantCall = {
  id: string;
  threadId: string;
  callerUserId: string;
  calleeUserId: string;
  ringStatus: FoundationCallRingStatus;
  streamCallId: string;
  ringExpiresAtIso: string | null;
  answeredAtIso: string | null;
  endedAtIso: string | null;
  endedByUserId: string | null;
  // Issue #808 task 4 (per-block billing). firstBlockCharged is true once the first block has been paid on
  // answer. rateCreditsLocked / intervalMinutesLocked are the provider's rate + block length SNAPSHOTTED at
  // answer (null until answered), so a provider changing their rate mid-call never affects an in-progress
  // call. authorizedBlocks is the buyer-set cap chosen at ring; the call can never extend past it in v1.
  // blocksCharged is how many blocks have been paid. paidThroughAtIso = answered_at + blocksCharged *
  // interval and drives the display countdown plus the lazy paid-window expiry. lastTransferId is the most
  // recent ServiceCredits transfer id (trace only).
  firstBlockCharged: boolean;
  rateCreditsLocked: number | null;
  intervalMinutesLocked: number | null;
  authorizedBlocks: number | null;
  blocksCharged: number;
  paidThroughAtIso: string | null;
  lastTransferId: string | null;
  // Why the call ended when it was not a plain hang-up: 'caller_insufficient_funds', 'paid_window_elapsed',
  // or 'block_cap_reached'. Null for a normal end/decline/timeout. Lets the UI show "out of credits" etc.
  endedReason: string | null;
  createdAtIso: string;
};

// What the client needs to join the audio room for an answered instant call. Mirrors the Direct Line
// participant-only token shape. Null Stream fields mean the integration is not configured (demo/local).
//
// Two distinct Stream ids travel here and must not be confused (issue #987):
//   - streamCallId is the Stream **Video** call id the audio room joins (mirror of `call.streamCallId`,
//     surfaced flat so a caller never has to reach into `call` to find it).
//   - streamChannelId is the Stream **Chat** channel id for the thread's Direct Line — NOT a call id.
export type FoundationInstantCallJoin = {
  call: FoundationInstantCall;
  role: 'caller' | 'callee';
  streamApiKey: string | null;
  streamUserId: string | null;
  streamToken: string | null;
  streamCallId: string;
  streamChannelId: string;
};

export type FoundationOfferedSkill = {
  id: string;
  name: string;
};

export type FoundationProviderSearchItem = {
  profileId: string;
  providerUserId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  // Provider location, read from their claimed directory profile (plain names; any part may be null).
  city: string | null;
  state: string | null;
  country: string | null;
  score: number;
  // The skills this provider has opted in to be contacted about (their Foundation offer).
  offeredSkills: FoundationOfferedSkill[];
  // Read-only mirror of the provider's instant 1:1 call settings (Foundation "Connect now", issue
  // #808). instantCallEnabled is the provider's opt-in; instantCallRateCredits is whole ServiceCredits
  // per block (only meaningful when enabled); instantCallIntervalMinutes is the block length. The call
  // lifecycle and any charge are later tasks of #808 — these fields only describe availability.
  instantCallEnabled: boolean;
  instantCallRateCredits: number | null;
  instantCallIntervalMinutes: number;
  // The provider's own short blurb (one or two sentences, capped ~200 chars), shown on their
  // Foundation listing before a member requests a quote. null when they haven't set one.
  shortDescription: string | null;
};

export type FoundationThread = {
  id: string;
  survivorUserId: string;
  providerUserId: string;
  providerDirectoryProfileId: string;
  streamChannelId: string;
  status: 'active' | 'closed';
  createdAtIso: string;
};

export type FoundationMessage = {
  id: string;
  threadId: string;
  senderUserId: string;
  senderRole: 'survivor' | 'provider';
  messageText: string;
  streamMessageId: string | null;
  moderationStatus: 'accepted' | 'flagged';
  createdAtIso: string;
};

export type FoundationCallSession = {
  id: string;
  threadId: string;
  modality: FoundationCallModality;
  streamCallId: string;
  requestedDurationMinutes: number;
  status: 'created' | 'active' | 'ended' | 'canceled';
  createdAtIso: string;
};

export type FoundationQuoteRequest = {
  id: string;
  threadId: string;
  survivorUserId: string;
  providerUserId: string;
  serviceType: string;
  lifecycleState: FoundationQuoteState;
  // Priced one-off quote (issue: Foundation priced quotes). When a provider moves the quote to
  // 'provider_responded' they attach a price: quotedAmount in quotedCurrency (a code from the shared
  // currency catalog). Both are null until the provider responds. settledAtIso is stamped on 'closed'
  // when the quote carries a value — that settled value feeds GDP recognition per currency. Recurring
  // engagements are out of scope here (handled by the Recurring Activity plugin).
  quotedAmount: number | null;
  quotedCurrency: string | null;
  settledAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type FoundationNotificationEvent = {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  isAcknowledged: boolean;
  createdAtIso: string;
};

export type FoundationCapacityPolicy = {
  maxActiveThreadsPerUser: number;
  maxMessagesPerMinute: number;
  maxSearchesPerMinute: number;
  maxQuoteTransitionsPerMinute: number;
  maxCallDurationMinutes: number;
  quotaState: 'green' | 'yellow' | 'orange' | 'red';
  updatedAtIso: string;
  // Monotonic version of the policy, incremented once per admin update and recorded in
  // foundation_capacity_policy_events. null when no update has ever been recorded (fresh default policy).
  policyVersion: number | null;
  // When this version became active (the event's activated_at). null for the fresh default policy.
  activatedAtIso: string | null;
};
