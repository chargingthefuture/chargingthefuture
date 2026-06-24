export type FoundationQuoteState = 'requested' | 'provider_responded' | 'closed';
export type FoundationCallModality = 'voice' | 'video';

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
