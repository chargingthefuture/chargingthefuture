// Shared constants, types, and helpers for the ServiceCredits web shell.
// Palette/layout derive from design/.../survivor-hub/ServiceCredits.tsx.
//
// Brand rules (critical): "ServiceCredits" is one word and a utility token —
// it must NEVER be shown at a fiat / dollar equivalent. Balances render as
// "credits" only.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#A855F7";
export const BG = "#0F1117";

// Theme-aware chrome tokens for the ServiceCredits shell. Default keeps the shipped values (accent
// stays #A855F7); comic uses the shared comic surface tokens plus the ServiceCredits comic-ink accent.
export type ServiceCreditsTokens = PluginShellTokens;

export function getServiceCreditsTokens(theme: ThemeName): ServiceCreditsTokens {
  const accent = theme === "comic" ? getAppAccent("service-credits", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

export type WalletData = { availableBalance: number; escrowBalance: number };
export type Tab = "wallet" | "earn" | "economy" | "info";

// Public circulation metrics returned by GET /api/service-credits/circulation. Aggregate,
// non-identifying figures only — never a per-member number and never a fiat equivalent.
export type CirculationMetrics = {
  inCirculation: number;
  totalIssued: number;
  totalBurned: number;
  treasuryBalance: number | null;
  outstandingMutualCreditDebt: number;
  transferVolume30d: number;
  velocity: number;
};

export const ACCEPTED_APPS = ["LightHouse", "TrustTransport", "Directory", "Foundation", "SocketRelay"];

export function fmtCredits(n: number): string {
  return n.toLocaleString();
}

export function idempotencyKey(): string {
  // Prefer a cryptographically strong UUID for this money-transfer key; fall back
  // for non-secure contexts where crypto.randomUUID is unavailable.
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
