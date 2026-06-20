// Shared constants and types for the LightHouse web shell.
// Palette and layout derive from design/.../survivor-hub/LightHouse.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#60A5FA";
// App surface background as rendered by the mockup (the mockup's `BG`
// constant is dead code; every rendered surface uses #0F1117).
export const BG = "#0F1117";

// Theme-aware chrome tokens for the LightHouse shell. Default keeps the shipped values (accent
// stays #60A5FA); comic uses the shared comic surface tokens plus the LightHouse comic-ink accent.
export type LighthouseTokens = PluginShellTokens;

export function getLighthouseTokens(theme: ThemeName): LighthouseTokens {
  const accent = theme === "comic" ? getAppAccent("lighthouse", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

export type Tab = "browse" | "matches" | "chat" | "host";

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
  hostUserId: string;
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
