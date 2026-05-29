// Shared constants and types for the LightHouse web shell.
// Palette and layout derive from design/.../survivor-hub/LightHouse.tsx.

export const COLOR = "#EAB308";
// App surface background as rendered by the mockup (the mockup's `BG`
// constant is dead code; every rendered surface uses #0F1117).
export const BG = "#0F1117";

export type Tab = "browse" | "matches" | "chat";

export interface Profile {
  id: string;
  profileType: string;
  bio?: string;
  phoneNumber?: string;
  signalUrl?: string;
  isActive?: boolean;
  hasProperty?: boolean;
  housingNeeds?: string;
  desiredMoveInDateIso?: string;
  budgetMin?: number;
  budgetMax?: number;
  desiredCountry?: string;
  updatedAtIso?: string;
}

export interface Property {
  id: string;
  img?: string;
  title: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  credits?: boolean;
  availableFromIso?: string;
  description?: string;
}

export interface Match {
  id: string;
  status: string;
  propertyId: string;
  seekerUserId: string;
  hostUserId: string;
  proposedMoveInDateIso?: string;
  message?: string;
}

export interface ChatCredentials {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId?: string;
}
