// Shared constants, types, and helpers for the ServiceCredits web shell.
// Palette/layout derive from design/.../survivor-hub/ServiceCredits.tsx.
//
// Brand rules (critical): "ServiceCredits" is one word and an internal credits unit —
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
export type Tab = "wallet" | "earn" | "economy";

// One row of the member's own wallet history, as returned by GET /api/service-credits/transactions
// (a projection of service_credits_ledger_entries). Bare credit quantities only — never a fiat figure.
export type LedgerEntry = {
  id: string;
  entryType: string;
  amount: number;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

export type LedgerDescription = { label: string; direction: "in" | "out" | "neutral" };

// Reference-keyed labels for the "credit" entry type (default: "Credit grant").
const CREDIT_LABELS_BY_REFERENCE: Record<string, string> = {
  transfer: "Received credits",
  treasury_fee: "Fee received",
  dispute_adjustment: "Dispute resolution credit",
};

// Reference-keyed labels for the "debit" entry type (default: "Credits removed").
const DEBIT_LABELS_BY_REFERENCE: Record<string, string> = {
  treasury_fee: "Treasury fee",
  dispute_adjustment: "Dispute resolution debit",
};

// Fixed descriptions for entry types that do not depend on referenceType.
const FIXED_LEDGER_DESCRIPTIONS: Record<string, LedgerDescription> = {
  escrow_hold: { label: "Held in escrow", direction: "out" },
  escrow_release: { label: "Escrow released", direction: "neutral" },
  escrow_refund: { label: "Escrow refunded", direction: "in" },
  initial_allocation: { label: "Welcome allocation", direction: "in" },
  skills_hunt_award: { label: "SkillsHunt award", direction: "in" },
};

// Plain-language label + direction for a ledger row. Direction drives the +/- sign and color:
// "in" credits the member, "out" debits, "neutral" for escrow moves that net within the member's own
// wallet (held/released) where a signed amount would mislead. Keeps wording newcomer-friendly.
export function describeLedgerEntry(
  entryType: string,
  referenceType: string,
): LedgerDescription {
  if (entryType === "credit") {
    return { label: CREDIT_LABELS_BY_REFERENCE[referenceType] ?? "Credit grant", direction: "in" };
  }
  if (entryType === "debit") {
    return { label: DEBIT_LABELS_BY_REFERENCE[referenceType] ?? "Credits removed", direction: "out" };
  }
  const fixed = FIXED_LEDGER_DESCRIPTIONS[entryType];
  if (fixed) return fixed;
  return { label: entryType.replace(/_/g, " "), direction: "neutral" };
}

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
