// Shared constants and types for the LightHouse web shell.
// Palette and layout derive from design/.../survivor-hub/LightHouse.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import type { Currency } from "@/lib/currency/types";
import { SERVICE_CREDITS_LABEL } from "@/lib/currency/types";
import { formatPrice, sortPreferred } from "@/lib/currency/format";

// The kinds of place a member can list on LightHouse (owner: houses, rooms in a house, apartments,
// and campers). Stored verbatim on `property_type`; also the option set for the host form picker.
export const LIGHTHOUSE_PROPERTY_TYPES = ["House", "Room in a house", "Apartment", "Camper"] as const;

export const COLOR = "#3B82F6";
// App surface background as rendered by the mockup (the mockup's `BG`
// constant is dead code; every rendered surface uses #0F1117).
export const BG = "#0F1117";

// Theme-aware chrome tokens for the LightHouse shell. Default keeps the shipped values (accent
// stays #3B82F6); comic uses the shared comic surface tokens plus the LightHouse comic-ink accent.
export type LighthouseTokens = PluginShellTokens;

export function getLighthouseTokens(theme: ThemeName): LighthouseTokens {
  const accent = theme === "comic" ? getAppAccent("lighthouse", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

export type Tab = "browse" | "wanted" | "matches" | "chat" | "host" | "profile";

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
  budgetCurrency?: string | null;
  desiredCountry?: string;
  desiredCity?: string;
  isWantedPublic?: boolean;
  updatedAtIso?: string;
}

/**
 * A housing need a member chose to publish, as the Wanted tab receives it from
 * `GET /api/lighthouse/wanted`. It carries no member id and no contact details — reading it tells
 * you someone is looking, not who they are or how to reach them.
 */
export interface WantedPosting {
  id: string;
  housingNeeds?: string | null;
  bio?: string | null;
  desiredCity?: string | null;
  desiredCountry?: string | null;
  desiredMoveInDateIso?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  budgetCurrency?: string | null;
  updatedAtIso?: string;
}

/**
 * A published budget range, formatted in the currency the member named. Null when they gave no
 * budget at all.
 *
 * Every rule the rent display follows applies here: a ServiceCredits budget reads as
 * "20 ServiceCredits", never with a "$" and never at a fiat equivalent; a barter or amount-less
 * currency renders its label alone, because a range of it means nothing. A budget saved before the
 * currency picker existed carries no currency, so it falls back to the bare number it has always
 * been — the one case where the figure genuinely names no currency, and inventing one for it would
 * be the display asserting something the member never said.
 */
/** True for a currency that carries no figure at all (barter, or any kind that needs no amount). */
function isAmountLess(currency: Currency): boolean {
  return currency.kind === "barter" || !currency.requiresAmount;
}

/** Assembles the two ends of a range, given whatever renders one end of it. */
function joinRange(min: number | null, max: number | null, render: (value: number) => string): string | null {
  if (min !== null && max !== null) return min === max ? render(min) : `${render(min)}–${render(max)}`;
  if (min !== null) return `${render(min)} or more`;
  if (max !== null) return `up to ${render(max)}`;
  return null;
}

export function formatBudgetRange(posting: WantedPosting, currencies: CurrencyMap): string | null {
  const min = typeof posting.budgetMin === "number" ? posting.budgetMin : null;
  const max = typeof posting.budgetMax === "number" ? posting.budgetMax : null;
  if (min === null && max === null) return null;

  const currency = posting.budgetCurrency ? currencies[posting.budgetCurrency] : undefined;
  if (currency && isAmountLess(currency)) {
    return currency.isServiceCredits ? SERVICE_CREDITS_LABEL : currency.label;
  }

  return joinRange(min, max, (value) =>
    currency ? formatPrice(value, currency) : value.toLocaleString("en-US"),
  );
}

export interface Property {
  id: string;
  hostUserId: string;
  img?: string;
  title: string;
  // What kind of place this is (e.g. "House", "Apartment", "Camper"). Free-form on older rows.
  propertyType?: string | null;
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

/**
 * A rent split into a large primary part and a small unit label, so a long currency name like
 * "ServiceCredits" renders small next to the number instead of at the giant price font size (which
 * overflowed the card). `perMonth` is false for "Free" and amount-less currencies (no "/mo").
 *   fiat        → { primary: "$1,200", unit: null,             perMonth: true  }
 *   credits     → { primary: "20",     unit: "ServiceCredits", perMonth: true  }
 *   free / zero → { primary: "Free",   unit: null,             perMonth: false }
 */
export interface RentParts {
  primary: string;
  unit: string | null;
  perMonth: boolean;
}

export function formatRentParts(property: Property, currencies: CurrencyMap): RentParts | null {
  const amount = property.monthlyRent;
  if (!Number.isFinite(amount)) return null;
  if (amount === 0) return { primary: "Free", unit: null, perMonth: false };
  const code = property.rentCurrency ?? "USD";
  const currency = currencies[code];
  if (!currency) return { primary: `$${amount}`, unit: null, perMonth: true };
  if (currency.kind === "barter" || !currency.requiresAmount) {
    return { primary: currency.isServiceCredits ? SERVICE_CREDITS_LABEL : currency.label, unit: null, perMonth: false };
  }
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  });
  if (currency.isServiceCredits) return { primary: formatted, unit: SERVICE_CREDITS_LABEL, perMonth: true };
  if (currency.symbol) return { primary: `${currency.symbol}${formatted}`, unit: null, perMonth: true };
  return { primary: formatted, unit: currency.code, perMonth: true };
}

/** Accepted-currency labels for a listing, ServiceCredits first, resolved via the currency catalog. */
export function acceptedCurrencyLabels(property: Property, currencies: CurrencyMap): string[] {
  const resolved = (property.acceptedCurrencies ?? [])
    .map((code) => currencies[code])
    .filter((c): c is Currency => Boolean(c));
  return sortPreferred(resolved).map((c) => (c.isServiceCredits ? SERVICE_CREDITS_LABEL : c.label));
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
