import type { FoundationQuoteState } from "@/lib/foundation/types";
import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#F59E0B";
export const FONT = "'Inter', system-ui, sans-serif";

// Theme-aware color tokens for the Foundation shell chrome. The default theme keeps the exact
// values the shell already shipped (accent stays Foundation's shipped #EF4444); comic uses the
// shared comic surface tokens plus the Foundation comic-ink accent from getAppAccent.
export type FoundationTokens = PluginShellTokens;

export function getFoundationTokens(theme: ThemeName): FoundationTokens {
  const accent = theme === "comic" ? getAppAccent("foundation", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

/** One skill a provider has opted in to be contacted about. */
export interface OfferedSkillView {
  id: string;
  name: string;
}

/** Provider view model — only fields the real search API returns. */
export interface ProviderView {
  profileId: string;
  providerUserId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  // Provider location from their claimed directory profile (plain names; any part may be null).
  city: string | null;
  state: string | null;
  country: string | null;
  score: number;
  offeredSkills: OfferedSkillView[];
  // Read-only mirror of the provider's instant 1:1 call availability (Foundation "Connect now",
  // issue #808). Only meaningful when instantCallEnabled is true; the actual call and any charge are
  // later tasks of #808.
  instantCallEnabled: boolean;
  instantCallRateCredits: number | null;
  instantCallIntervalMinutes: number;
}

/** Quote view model — only fields the real quote-history API returns. */
export interface QuoteView {
  id: string;
  threadId: string;
  // The provider on this quote. Compared against the signed-in viewer so only the provider sees the
  // price inputs on a 'requested' quote (the survivor never sets the price).
  providerUserId: string;
  serviceType: string;
  lifecycleState: FoundationQuoteState;
  // Priced one-off quote. quotedAmount/quotedCurrency are set by the provider when they respond;
  // settledAtIso is stamped on close when the quote carried a value. All null until then.
  quotedAmount: number | null;
  quotedCurrency: string | null;
  settledAtIso: string | null;
  createdAtIso: string;
}

export type FoundationTab = "browse" | "quotes" | "offer";

/** Trade filters map to the search `q` param; "All Trades" clears it. */
export const TRADES = [
  "All Trades",
  "Electrician",
  "Plumber",
  "HVAC",
  "Carpenter",
  "Painter",
  "Contractor",
  "Landscaper",
];

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const QUOTE_STATUS: Record<FoundationQuoteState, { label: string; fg: string; bg: string; bd: string }> = {
  requested: { label: "Pending", fg: COLOR, bg: `${COLOR}15`, bd: `${COLOR}30` },
  provider_responded: { label: "Responded", fg: "#22C55E", bg: "#22C55E20", bd: "#22C55E40" },
  closed: { label: "Closed", fg: "#6B7280", bg: "rgba(255,255,255,0.04)", bd: "rgba(255,255,255,0.08)" },
};

export function quoteStatus(state: FoundationQuoteState) {
  return QUOTE_STATUS[state] ?? QUOTE_STATUS.requested;
}

export function formatQuoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
