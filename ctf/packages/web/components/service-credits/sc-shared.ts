// Shared constants, types, and helpers for the ServiceCredits web shell.
// Palette/layout derive from design/.../survivor-hub/ServiceCredits.tsx.
//
// Brand rules (critical): "ServiceCredits" is one word and a utility token —
// it must NEVER be shown at a fiat / dollar equivalent. Balances render as
// "credits" only.

export const COLOR = "#F59E0B";
export const BG = "#0F1117";

export type WalletData = { availableBalance: number; escrowBalance: number };
export type Tab = "wallet" | "earn" | "info";

export const ACCEPTED_APPS = ["LightHouse", "TrustTransport", "Directory", "Foundation", "SocketRelay"];

export function fmtCredits(n: number): string {
  return n.toLocaleString();
}

export function idempotencyKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
