export type LighthouseProfileType = 'seeker' | 'host';
export type LighthouseMatchStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';

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
  availableFromIso: string | null;
  amenities: string[];
  houseRules: string[];
  photos: string[];
  airbnbProfileUrl: string | null;
  isActive: boolean;
  updatedAtIso: string;
};

export type LighthouseMatch = {
  id: string;
  propertyId: string;
  seekerUserId: string;
  hostUserId: string;
  message: string | null;
  proposedMoveInDateIso: string | null;
  hostResponse: string | null;
  status: LighthouseMatchStatus;
  createdAtIso: string;
  updatedAtIso: string;
  streamChannelId: string;
};

export type LighthouseBlock = {
  id: string;
  blockerUserId: string;
  blockedUserId: string;
  reason: string | null;
  createdAtIso: string;
};

export type LighthouseProfileInput = {
  profileType: LighthouseProfileType;
  bio?: string | null;
  phoneNumber?: string | null;
  signalUrl?: string | null;
  isActive?: boolean;
  hasProperty?: boolean;
  housingNeeds?: string | null;
  desiredMoveInDateIso?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  desiredCountry?: string | null;
};

export type LighthousePropertyInput = {
  title: string;
  description: string;
  propertyType?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  monthlyRent?: number | null;
  availableFromIso?: string | null;
  amenities?: unknown;
  houseRules?: unknown;
  photos?: unknown;
  airbnbProfileUrl?: string | null;
  isActive?: boolean;
};

export type LighthouseMatchCreateInput = {
  propertyId: string;
  message?: string | null;
  desiredMoveInDateIso?: string | null;
};

export type LighthouseMatchUpdateInput = {
  status: LighthouseMatchStatus;
  hostResponse?: string | null;
};
