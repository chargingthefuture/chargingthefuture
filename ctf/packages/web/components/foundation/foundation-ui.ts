import type { FoundationQuoteState } from "@/lib/foundation/types";

export const COLOR = "#EF4444";
export const FONT = "'Inter', system-ui, sans-serif";

/** Provider view model — only fields the real search API returns. */
export interface ProviderView {
  profileId: string;
  providerUserId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  score: number;
}

/** Quote view model — only fields the real quote-history API returns. */
export interface QuoteView {
  id: string;
  threadId: string;
  serviceType: string;
  lifecycleState: FoundationQuoteState;
  createdAtIso: string;
}

export type FoundationTab = "browse" | "quotes" | "chat";

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
