// Mirror of ctf/packages/web/lib/trusttransport/types.ts — keep in sync.

export type TrustTransportMode = 'ride' | 'package' | 'food';

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

export type TrustTransportRequestInput = {
  mode: TrustTransportMode;
  title: string;
  details: string;
  pickupCity: string | null;
  dropoffCity: string | null;
  pickupGeoRedacted: string | null;
  dropoffGeoRedacted: string | null;
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
