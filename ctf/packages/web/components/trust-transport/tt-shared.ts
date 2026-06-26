// Shared constants, types, and helpers for the TrustTransport web shell.
// Palette/layout derive from design/.../survivor-hub/TrustTransport.tsx.
import { Car, Package, Utensils } from "lucide-react";
import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#38BDF8";
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
  createdAt?: string;
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

export type Tab = "book" | "tracking" | "chat";

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
