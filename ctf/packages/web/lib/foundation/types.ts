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
  killSwitchEnabled: boolean;
  updatedAtIso: string;
};
