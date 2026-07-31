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

export type SocketRelayRequestStatus = 'open' | 'claimed' | 'closed' | 'canceled';

export type SocketRelayRequest = {
  id: string;
  ownerUserId: string;
  ownerUsername: string | null;
  title: string;
  details: string;
  category: string;
  tags: string[];
  // Per-request location. Defaults from the member's directory profile in the create form, but is
  // overridable per request (a request can be for a different place than where the member lives).
  city: string | null;
  state: string | null;
  country: string | null;
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
  // When this post auto-expires (28 days after it was posted or last re-posted). `isExpired` is the
  // derived state: true only while the post is still open and that moment has passed.
  expiresAtIso: string | null;
  isExpired: boolean;
};

// `tags` carries 1-3 free-text tags. `category` mirrors the first tag so older
// clients that still send/read a single category keep working unchanged.
export type SocketRelayRequestInput = {
  title: string;
  details: string;
  tags: string[];
  city: string | null;
  state: string | null;
  country: string | null;
  isPublic: boolean;
  priceCurrency: string | null;
  priceAmount: number | null;
};

export type SocketRelayFulfillmentStatus = 'active' | 'closed' | 'canceled';

// How the requester (the person who posted the request) resolves a claimed request. Only the
// requester (or an admin) may resolve — a helper can chat but cannot close someone else's request.
//   successful          -> the help happened; close the request.
//   no_longer_needed     -> requester no longer needs it; close the request.
//   unsuccessful_reopen  -> it didn't work out; cancel this helper and put the request back to open
//                           so others can offer.
//   unsuccessful_close   -> it didn't work out and the requester is done; close the request.
export type SocketRelayResolveOutcome =
  | 'successful'
  | 'no_longer_needed'
  | 'unsuccessful_reopen'
  | 'unsuccessful_close';

export type SocketRelayFulfillment = {
  id: string;
  requestId: string;
  requesterUserId: string;
  fulfillerUserId: string;
  // The two participants' @usernames, captured on the fulfillment at claim time so the Direct Line chat
  // can render real names instead of a raw user id. Null for legacy rows / members with no handle.
  requesterUsername: string | null;
  fulfillerUsername: string | null;
  status: SocketRelayFulfillmentStatus;
  closeReason: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  // Populated by listMyFulfillments (joined from the request) so the chat can show what the
  // conversation is actually about instead of a bare "Fulfillment <uuid>". Optional because the
  // single-fulfillment fetch does not join the request.
  requestTitle?: string;
  requestStatus?: SocketRelayRequestStatus;
};

export type SocketRelayMessage = {
  id: string;
  fulfillmentId: string;
  senderUserId: string;
  messageText: string;
  moderationStatus: 'accepted' | 'flagged';
  createdAtIso: string;
};
