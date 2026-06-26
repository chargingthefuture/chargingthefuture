import type { TRUST_TRANSPORT_MODES } from './constants';

export type TrustTransportMode = (typeof TRUST_TRANSPORT_MODES)[number];

export type TrustTransportRequestStatus =
  | 'open'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'emergency_frozen';

export type TrustTransportOfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export type TrustTransportTripStatus =
  | 'assigned'
  | 'en_route'
  | 'picked_up'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'emergency_frozen';

export type TrustTransportPayoutStatus = 'requested' | 'approved' | 'rejected' | 'paid';

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

export type TrustTransportTrip = {
  id: string;
  requestId: string;
  offerId: string;
  requesterUserId: string;
  providerUserId: string;
  mode: TrustTransportMode;
  status: TrustTransportTripStatus;
  streamChannelId: string | null;
  cancelledReason: string | null;
  completedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type TrustTransportProofInput = {
  artifactType: 'photo' | 'code' | 'note';
  artifactRedacted: string;
};

export type TrustTransportPayoutRequest = {
  id: string;
  providerUserId: string;
  amount: number;
  currency: string;
  status: TrustTransportPayoutStatus;
  requestedAtIso: string;
  decidedAtIso: string | null;
  decidedByUserId: string | null;
  decisionReason: string | null;
};

export type TrustTransportRatingInput = {
  score: number;
  feedback: string | null;
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
