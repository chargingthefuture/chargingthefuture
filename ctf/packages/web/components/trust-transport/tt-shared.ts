// Shared constants, types, and helpers for the TrustTransport web shell.
// Palette/layout derive from design/.../survivor-hub/TrustTransport.tsx.
import { Car, Package, Utensils } from "lucide-react";
import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#67E8F9";
export const BG = "#0F1117";

// Theme-aware chrome tokens for the TrustTransport shell. The shell paints its accent both as
// the solid #F97316 and as rgba(249,115,22,…) tints; the default theme returns those exact
// strings so it renders identically when the comic toggle is off. Comic uses the shared comic
// surface tokens plus the TrustTransport comic-ink accent (as solid + matching alpha tints).
export type TrustTransportTokens = PluginShellTokens & {
  ACCENT_TINT_BG: string; // link/tab background tint (default 0.12)
  ACCENT_TINT_BORDER: string; // link icon border tint (default 0.3)
  ACCENT_TAB_BORDER: string; // active tab border tint (default 0.4)
};

export function getTrustTransportTokens(theme: ThemeName): TrustTransportTokens {
  if (theme === "comic") {
    const accent = getAppAccent("trust-transport", "comic");
    return {
      ...getPluginShellTokens(accent, theme),
      ACCENT_TINT_BG: `${accent}1F`,
      ACCENT_TINT_BORDER: `${accent}4D`,
      ACCENT_TAB_BORDER: `${accent}66`,
    };
  }
  return {
    ...getPluginShellTokens(COLOR, theme),
    ACCENT_TINT_BG: "rgba(249,115,22,0.12)",
    ACCENT_TINT_BORDER: "rgba(249,115,22,0.3)",
    ACCENT_TAB_BORDER: "rgba(249,115,22,0.4)",
  };
}

export interface Mode {
  id: string;
  name: string;
}

export interface TripRequest {
  id: string;
  mode?: string;
  title?: string;
  // The API returns pickup/dropoff cities and a title — not fromLocation/toLocation. Keep the older
  // optional names too so nothing breaks, but the UI should read pickupCity/dropoffCity (or title).
  pickupCity?: string | null;
  dropoffCity?: string | null;
  fromLocation?: string;
  toLocation?: string;
  status?: string;
  priceCurrency?: string | null;
  priceAmount?: number | null;
  // Every currency the requester accepts (split settlements), ServiceCredits first.
  acceptedCurrencies?: string[];
  createdAt?: string;
  // The trip id once an offer has been accepted. Chat is keyed by trip id, so opening chat needs this
  // (a request id is not a trip id). Null/absent until a trip exists.
  tripId?: string | null;
  // The underlying trip's own status. Needed because `status` above already reads "completed" once the
  // trip reaches "delivered" — before mutual completion confirmation (and settlement) actually happens.
  tripStatus?: string | null;
  // The member who drove/delivered, once a trip exists. Used to offer recording a regular ride.
  tripProviderUserId?: string | null;
  requesterCompletionConfirmedAtIso?: string | null;
  providerCompletionConfirmedAtIso?: string | null;
}

// Plain label for how a ride is settled (issue #420). Honors the ServiceCredits rule (never the bare
// "SC" code, never a fiat equivalent) and renders Free/Barter from their value types.
export function ttSettlementLabel(priceCurrency: string | null | undefined, priceAmount: number | null | undefined): string {
  if (!priceCurrency || priceCurrency === "FREE") return "Free";
  if (priceCurrency === "BARTER") return "Barter";
  if (priceCurrency === "SC") return priceAmount != null ? `${priceAmount} ServiceCredits` : "ServiceCredits";
  return priceAmount != null ? `${priceAmount} ${priceCurrency}` : priceCurrency;
}

export interface ChatCreds {
  ok: boolean;
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId?: string;
  message?: string;
}

export type Tab = "book" | "tracking" | "chat" | "help" | "earnings";

// An offer shown to the requester on their own request's Tracking card, so they can accept one.
export interface TtOffer {
  id: string;
  requestId?: string;
  providerUserId?: string;
  note?: string | null;
  proposedAmount?: number | null;
  status?: string;
  createdAtIso?: string;
}

// A trip the member is fulfilling (provider side), shown on the "Help out" tab so they can advance it.
// Pickup/drop-off are present because they accepted (model B reveal).
export interface ProviderTrip {
  tripId: string;
  requestId?: string;
  status?: string;
  mode?: string;
  pickupCity?: string | null;
  dropoffCity?: string | null;
  priceCurrency?: string | null;
  priceAmount?: number | null;
  createdAtIso?: string;
  // Mutual completion confirmation (owner decision, 2026-07-08): once "delivered", neither party alone
  // can complete the trip — both must confirm.
  requesterCompletionConfirmedAtIso?: string | null;
  providerCompletionConfirmedAtIso?: string | null;
}

// A request shown on the "Help out" tab (discovery model B): mode + settlement + age only. The pickup
// and drop-off are deliberately absent — they're shared with a provider only after the requester accepts.
export interface AvailableRequest {
  id: string;
  mode?: string;
  priceCurrency?: string | null;
  priceAmount?: number | null;
  // Accepted settlement currencies, so a driver sees a split offer (e.g. ServiceCredits + USD) whole.
  acceptedCurrencies?: string[];
  createdAtIso?: string;
}

export interface RideType {
  id: string;
  name: string;
  icon: React.ElementType;
  desc: string;
  color: string;
}

export const STATIC_RIDE_TYPES: RideType[] = [
  { id: "ride", name: "Ride", icon: Car, desc: "Safe passenger transport", color: COLOR },
  { id: "package", name: "Package", icon: Package, desc: "Item delivery", color: "#3B82F6" },
  { id: "food", name: "Food", icon: Utensils, desc: "Meal delivery", color: "#22C55E" },
];

// Map server-provided modes onto the design's ride-type cards, falling back to
// a generic card for modes the design doesn't enumerate.
export function deriveRideTypes(modes: Mode[]): RideType[] {
  // Defensive: tolerate a non-array or modes missing id/name so a response-shape
  // change can never throw during render (that crashed the whole page before).
  if (!Array.isArray(modes) || modes.length === 0) return STATIC_RIDE_TYPES;
  return modes.map((m) => {
    const id = m?.id ?? "";
    const name = m?.name ?? id;
    const match = STATIC_RIDE_TYPES.find((rt) => rt.id === id || rt.name.toLowerCase() === name.toLowerCase());
    return match ?? { id, name, icon: Car, desc: name, color: COLOR };
  });
}

export function rideTypeName(rideTypes: RideType[], id: string): string {
  return rideTypes.find((r) => r.id === id)?.name ?? "Ride";
}
