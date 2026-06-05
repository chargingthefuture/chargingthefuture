export type SocketRelayProfile = {
  userId: string;
  bio: string | null;
  relayPreferences: Record<string, unknown>;
  presenceOptIn: boolean;
  serviceDeletedAtIso: string | null;
  updatedAtIso: string;
};

export type SocketRelayProfileInput = {
  bio: string | null;
  relayPreferences: Record<string, unknown>;
  presenceOptIn: boolean;
};

export type SocketRelayRequestStatus = 'open' | 'claimed' | 'closed' | 'cancelled';

export type SocketRelayRequest = {
  id: string;
  ownerUserId: string;
  ownerUsername: string | null;
  title: string;
  details: string;
  category: string;
  city: string | null;
  isPublic: boolean;
  status: SocketRelayRequestStatus;
  reopenedCount: number;
  claimedFulfillmentId: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type SocketRelayRequestInput = {
  title: string;
  details: string;
  category: string;
  city: string | null;
  isPublic: boolean;
};

export type SocketRelayFulfillmentStatus = 'active' | 'closed' | 'cancelled';

export type SocketRelayFulfillment = {
  id: string;
  requestId: string;
  requesterUserId: string;
  fulfillerUserId: string;
  status: SocketRelayFulfillmentStatus;
  closeReason: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type SocketRelayMessage = {
  id: string;
  fulfillmentId: string;
  senderUserId: string;
  messageText: string;
  moderationStatus: 'accepted' | 'flagged';
  createdAtIso: string;
};

export type SocketRelayPublicRequest = {
  id: string;
  ownerUsername: string | null;
  title: string;
  category: string;
  city: string | null;
  status: SocketRelayRequestStatus;
  createdAtIso: string;
};

export type SocketRelayAnnouncementInput = {
  title: string;
  body: string;
  mandatory: boolean;
  priority: number;
  expiresAtIso: string | null;
  isActive: boolean;
};
