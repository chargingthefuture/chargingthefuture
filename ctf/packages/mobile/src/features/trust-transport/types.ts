// Mirror of ctf/packages/web/lib/trust-transport/types.ts — keep in sync.

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

// Plain label for how a ride is settled (issue #420). Mirrors web tt-shared.ttSettlementLabel: never the
// bare "SC" code, never a fiat equivalent; Free/Barter render from their value types.
export function ttSettlementLabel(priceCurrency: string | null, priceAmount: number | null): string {
  if (!priceCurrency || priceCurrency === 'FREE') return 'Free';
  if (priceCurrency === 'BARTER') return 'Barter';
  if (priceCurrency === 'SC') return priceAmount != null ? `${priceAmount} ServiceCredits` : 'ServiceCredits';
  return priceAmount != null ? `${priceAmount} ${priceCurrency}` : priceCurrency;
}

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
