// Shared constants and types for the LightHouse web shell.
// Palette and layout derive from design/.../survivor-hub/LightHouse.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import type { Currency } from "@/lib/currency/types";
import { formatPrice } from "@/lib/currency/format";

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
  // Currency the rent is listed in (currencies.code). Null/undefined falls back to USD for display.
  rentCurrency?: string | null;
  // Currencies this listing accepts (currencies.code). Independent of rentCurrency.
  acceptedCurrencies?: string[];
  // Computed server-side: listing accepts ServiceCredits. Drives the "Accepts ServiceCredits" badge.
  acceptsServiceCredits?: boolean;
  // Legacy alias kept for older call sites; prefer acceptsServiceCredits.
  credits?: boolean;
  availableFromIso?: string;
  description?: string;
}

/** True when a listing accepts ServiceCredits, tolerant of the legacy `credits` field. */
export function listingAcceptsCredits(property: Property): boolean {
  return Boolean(property.acceptsServiceCredits ?? property.credits);
}

/** Lookup from currency code to Currency, built once from GET /api/currencies. */
export type CurrencyMap = Record<string, Currency>;

/**
 * Format a listing's monthly rent in its own currency. Returns null when no rent is set (caller
 * renders nothing). 0 renders as "Free". A fiat rent uses its symbol (e.g. "$1,200"); a
 * ServiceCredits rent renders as "1,200 ServiceCredits" — never a "$" and never a fiat equivalent.
 * Falls back to a plain "$" prefix only when the catalog has not loaded yet, matching the prior UI.
 */
export function formatRent(property: Property, currencies: CurrencyMap): string | null {
  const amount = property.monthlyRent;
  if (!Number.isFinite(amount)) return null;
  if (amount === 0) return "Free";
  const code = property.rentCurrency ?? "USD";
  const currency = currencies[code];
  if (currency) return formatPrice(amount, currency);
  return `$${amount}`;
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
