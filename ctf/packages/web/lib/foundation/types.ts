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
  // Issue #808 task 4 seam: true once the first per-block charge has been taken on answer. Always false
  // until the billing task wires it; this field only exposes the seam, it never moves money here.
  firstBlockCharged: boolean;
  createdAtIso: string;
};

// What the client needs to join the audio room for an answered instant call. Mirrors the Direct Line
// participant-only token shape. Null Stream fields mean the integration is not configured (demo/local).
export type FoundationInstantCallJoin = {
  call: FoundationInstantCall;
  role: 'caller' | 'callee';
  streamApiKey: string | null;
  streamUserId: string | null;
  streamToken: string | null;
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
  status: 'created' | 'active' | 'ended' | 'cancelled';
  createdAtIso: string;
};

export type FoundationQuoteRequest = {
  id: string;
  threadId: string;
  survivorUserId: string;
  providerUserId: string;
  serviceType: string;
  lifecycleState: FoundationQuoteState;
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
};
