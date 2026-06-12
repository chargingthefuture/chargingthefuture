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
  tags: string[];
  city: string | null;
  isPublic: boolean;
  status: SocketRelayRequestStatus;
  reopenedCount: number;
  claimedFulfillmentId: string | null;
  // How the request is settled (issue #420): the chosen value type code (e.g. 'FREE', 'SC', 'USD',
  // 'BARTER'), with a positive amount for priced types only. Amount-less types (Free, Barter) carry a
  // null amount; "Free" is never shown as $0.
  priceCurrency: string | null;
  priceAmount: number | null;
  createdAtIso: string;
  updatedAtIso: string;
};

// `tags` carries 1-3 free-text tags. `category` mirrors the first tag so older
// clients that still send/read a single category keep working unchanged.
export type SocketRelayRequestInput = {
  title: string;
  details: string;
  tags: string[];
  city: string | null;
  isPublic: boolean;
  priceCurrency: string | null;
  priceAmount: number | null;
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
  tags: string[];
  city: string | null;
  status: SocketRelayRequestStatus;
  priceCurrency: string | null;
  priceAmount: number | null;
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
