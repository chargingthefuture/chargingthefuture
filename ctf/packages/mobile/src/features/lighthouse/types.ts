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
