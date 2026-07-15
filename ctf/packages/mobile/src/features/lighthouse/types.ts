export type LighthouseProperty = {
  id: string;
  hostUserId: string;
  title: string;
  description: string;
  propertyType: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  monthlyRent: number | null;
  // Currency the rent is listed in (currencies.code). Null falls back to USD for display.
  rentCurrency: string | null;
  // Currency codes this listing accepts (currencies.code). Independent of rentCurrency.
  acceptedCurrencies: string[];
  availableFromIso: string | null;
  amenities: string[];
  houseRules: string[];
  photos: string[];
  airbnbProfileUrl: string | null;
  isActive: boolean;
  updatedAtIso: string;
};

export type LighthouseProfileType = 'seeker' | 'host';

// The member's LightHouse preference profile (seeker or host). Mirrors LighthouseProfile in
// ctf/packages/web/lib/lighthouse/types.ts.
export type LighthouseProfile = {
  id: string;
  userId: string;
  profileType: LighthouseProfileType;
  bio: string | null;
  phoneNumber: string | null;
  signalUrl: string | null;
  isActive: boolean;
  hasProperty: boolean;
  housingNeeds: string | null;
  desiredMoveInDateIso: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  desiredCountry: string | null;
  updatedAtIso: string;
};

// Body for POST /api/lighthouse/profile — only the seeker fields this screen sets. The route fills
// the rest (profileType defaults to seeker; hasProperty defaults false).
export type SeekerProfileInput = {
  profileType: 'seeker';
  bio: string | null;
  phoneNumber: string | null;
  signalUrl: string | null;
  isActive: boolean;
  housingNeeds: string | null;
  desiredMoveInDateIso: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  desiredCountry: string | null;
};

// Body for POST /api/lighthouse/matches (the "Request to stay" action). Mirrors
// LighthouseMatchCreateInput in ctf/packages/web/lib/lighthouse/types.ts.
export type MatchCreateInput = {
  propertyId: string;
  message: string | null;
  desiredMoveInDateIso: string | null;
};

export type LighthouseMatch = {
  id: string;
  propertyId: string;
  seekerUserId: string;
  hostUserId: string;
  message: string | null;
  proposedMoveInDateIso: string | null;
  hostResponse: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  createdAtIso: string;
  updatedAtIso: string;
  streamChannelId: string;
};

export type PropertiesResponse = {
  ok: boolean;
  items: LighthouseProperty[];
  total: number;
  pagination: { page: number; pageSize: number };
};

export type MatchesResponse = {
  ok: boolean;
  items: LighthouseMatch[];
  total: number;
  pagination: { page: number; pageSize: number };
};

// GET /api/lighthouse/my-properties — the host's own listings plus the composed
// host identity (the Quora link surfaced from the member's Unlock submission).
export type MyPropertiesResponse = {
  ok: boolean;
  items: LighthouseProperty[];
  host?: { quoraProfileUrl?: string | null } | null;
};

// Body for POST /api/lighthouse/properties. Mirrors LighthousePropertyInput in
// ctf/packages/web/lib/lighthouse/types.ts — only fields the route accepts.
export type PropertyCreateInput = {
  title: string;
  description: string;
  propertyType: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  monthlyRent: number | null;
  // Currency the rent is priced in (mirrors the web host form, default 'USD').
  rentCurrency: string | null;
  // Currency codes this listing accepts, e.g. 'SC' for ServiceCredits. Independent of rentCurrency.
  acceptedCurrencies: string[] | null;
  availableFromIso: string | null;
  amenities: string[] | null;
  houseRules: string[] | null;
  airbnbProfileUrl: string | null;
};
