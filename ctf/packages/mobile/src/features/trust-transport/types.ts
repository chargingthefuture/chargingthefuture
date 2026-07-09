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
  // The trip id once an offer has been accepted. Chat is keyed by trip id, not the request id; null
  // until a trip exists.
  tripId: string | null;
  // The underlying trip's own status. Needed because `status` above already reads 'completed' once the
  // trip reaches 'delivered' — before mutual completion confirmation and settlement actually happen.
  tripStatus: TrustTransportTripStatus | null;
  requesterCompletionConfirmedAtIso: string | null;
  providerCompletionConfirmedAtIso: string | null;
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
  // Mutual completion confirmation (owner decision, 2026-07-08): once a trip is 'delivered', neither
  // party alone can complete it — completion (and settlement) fires only once both have confirmed.
  requesterCompletionConfirmedAtIso: string | null;
  providerCompletionConfirmedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type TrustTransportOfferInput = {
  note: string | null;
  proposedAmount: number | null;
};

// Discovery model B: a member browsing open requests sees only mode + settlement + age (no location).
export type TrustTransportAvailableRequest = {
  id: string;
  mode: TrustTransportMode;
  priceCurrency: string | null;
  priceAmount: number | null;
  createdAtIso: string;
};

// A trip the member is fulfilling (provider side), with the now-revealed pickup/drop-off.
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
  requesterCompletionConfirmedAtIso: string | null;
  providerCompletionConfirmedAtIso: string | null;
};

export type TrustTransportPayoutRequest = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  requestedAtIso: string;
};

export type TrustTransportEarningsBalance = {
  currency: string;
  balance: number;
};
