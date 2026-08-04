import type { TRUST_TRANSPORT_MODES } from './constants';

export type TrustTransportMode = (typeof TRUST_TRANSPORT_MODES)[number];

export type TrustTransportRequestStatus =
  | 'open'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'disputed'
  | 'emergency_frozen';

export type TrustTransportOfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

// Recorded (read-only) earnings from completed trips, per settlement currency. NOT a withdrawable
// balance — non-ServiceCredits payment is settled peer-to-peer off-platform; this only records what a
// completed trip was worth. The same figures feed the GDP recognition layer.
export type TrustTransportRecordedEarning = {
  currency: string;
  amount: number;
};

export type TrustTransportTripStatus =
  | 'assigned'
  | 'en_route'
  | 'picked_up'
  | 'delivered'
  | 'completed'
  | 'canceled'
  | 'disputed'
  | 'emergency_frozen';

export type TrustTransportRequestInput = {
  mode: TrustTransportMode;
  title: string;
  details: string;
  pickupCity: string | null;
  dropoffCity: string | null;
  pickupGeoRedacted: string | null;
  dropoffGeoRedacted: string | null;
  // How the requester will settle the ride (issue #420): a value type code ('FREE', 'SC', 'USD',
  // 'BARTER', …) with a positive amount for priced types only; amount-less types carry null.
  priceCurrency: string | null;
  priceAmount: number | null;
};

export type TrustTransportRequest = {
  id: string;
  requesterUserId: string;
  mode: TrustTransportMode;
  title: string;
  details: string;
  pickupCity: string | null;
  dropoffCity: string | null;
  pickupGeoRedacted: string | null;
  dropoffGeoRedacted: string | null;
  status: TrustTransportRequestStatus;
  priceCurrency: string | null;
  priceAmount: number | null;
  createdAtIso: string;
  updatedAtIso: string;
  // The trip id once an offer has been accepted for this request, otherwise null. Chat is keyed by
  // trip id, so the UI needs this to open the right channel (a request id is not a trip id).
  tripId?: string | null;
  // The underlying trip's own lifecycle status (assigned/en_route/.../delivered/completed), present
  // only when a trip exists. Needed because the request's own `status` already reads "completed" once
  // the trip reaches "delivered" (see mapRequestStatusFromTrip) — before mutual completion confirmation
  // and settlement have actually happened. The UI uses this to know whether a completion confirmation is
  // still pending.
  tripStatus?: TrustTransportTripStatus | null;
  // The member who accepted the request, present only once a trip exists. By then the two are already
  // paired and talking on the Direct Line, so this reveals nothing new; it is carried so a finished ride
  // can offer to record the arrangement as a regular one.
  tripProviderUserId?: string | null;
  requesterCompletionConfirmedAtIso?: string | null;
  providerCompletionConfirmedAtIso?: string | null;
};

export type TrustTransportOffer = {
  id: string;
  requestId: string;
  providerUserId: string;
  note: string | null;
  proposedAmount: number | null;
  status: TrustTransportOfferStatus;
  createdAtIso: string;
  updatedAtIso: string;
};

// A trip the caller is fulfilling (they are the provider). Once they accepted, the request location is
// theirs to see (model B reveal), so pickup/drop-off are included here.
export type TrustTransportProviderTrip = {
  tripId: string;
  requestId: string;
  status: TrustTransportTripStatus;
  mode: TrustTransportMode;
  pickupCity: string | null;
  dropoffCity: string | null;
  priceCurrency: string | null;
  priceAmount: number | null;
  createdAtIso: string;
  // Mutual completion confirmation (owner decision): once the trip is "delivered", either party
  // confirming does not alone complete it — both must confirm before it settles.
  requesterCompletionConfirmedAtIso: string | null;
  providerCompletionConfirmedAtIso: string | null;
};

// What a member browsing open requests to help with is allowed to see (discovery model B). Deliberately
// omits the pickup/drop-off text and the title (which embeds the locations) — those are revealed to a
// provider only once the requester accepts their offer.
export type TrustTransportAvailableRequest = {
  id: string;
  mode: TrustTransportMode;
  priceCurrency: string | null;
  priceAmount: number | null;
  createdAtIso: string;
};

export type TrustTransportOfferInput = {
  // Optional free-text note from the provider (e.g. "Can pick up in 20 min"); redacted/normalized.
  note: string | null;
  // Optional settlement amount the provider proposes, as a positive integer; null means "no counter".
  proposedAmount: number | null;
};

export type TrustTransportTrip = {
  id: string;
  requestId: string;
  offerId: string;
  requesterUserId: string;
  providerUserId: string;
  mode: TrustTransportMode;
  status: TrustTransportTripStatus;
  streamChannelId: string | null;
  canceledReason: string | null;
  completedAtIso: string | null;
  // Mutual completion confirmation (owner decision, 2026-07-08): once a trip is "delivered", neither
  // party alone can complete it — completion (and settlement) fires only once both have confirmed.
  requesterCompletionConfirmedAtIso: string | null;
  providerCompletionConfirmedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type TrustTransportProofInput = {
  artifactType: 'photo' | 'code' | 'note';
  artifactRedacted: string;
};

export type TrustTransportMarketConfig = {
  maxConcurrentTrips: number;
  requireProofOnDelivery: boolean;
  emergencyFreezeEnabled: boolean;
};

export type TrustTransportIncident = {
  id: string;
  kind: 'dispute' | 'risk_signal';
  status: 'open' | 'resolved' | 'dismissed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  requestId: string | null;
  tripId: string | null;
  openedByUserId: string;
  createdAtIso: string;
};
