// Shared constants, types, and helpers for the SocketRelay web shell.
// Palette derives from design/.../survivor-hub/SocketRelay.tsx.
// Types mirror lib/socketrelay/types.ts (the real backend model). The mockup's
// need/offer/credits/urgency framing is not backed by the data model, so the
// shell renders the real request/claim/fulfillment model instead.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#FB923C";
export const BG = "#0F1117";
export const TEXT = "#E8EAF0";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

// Theme-aware chrome tokens for the SocketRelay shell. Default keeps the shipped values (accent
// stays #FB923C); comic uses the shared comic surface tokens plus the SocketRelay comic-ink accent.
export type SocketRelayTokens = PluginShellTokens;

export function getSocketRelayTokens(theme: ThemeName): SocketRelayTokens {
  const accent = theme === "comic" ? getAppAccent("socketrelay", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

export type Tab = "feed" | "post" | "chat";

export type SrRequestStatus = "open" | "claimed" | "closed" | "cancelled";

export type SrRequest = {
  id: string;
  ownerUserId: string;
  ownerUsername: string | null;
  title: string;
  details: string;
  category: string;
  city: string | null;
  isPublic: boolean;
  status: SrRequestStatus;
  reopenedCount: number;
  claimedFulfillmentId: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type SrFulfillment = {
  id: string;
  requestId: string;
  requesterUserId: string;
  fulfillerUserId: string;
  status: "active" | "closed" | "cancelled";
  closeReason: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type SrListResponse = { ok: boolean; items: SrRequest[]; page: number; pageSize: number; total: number };
export type SrFulfillmentsResponse = { ok: boolean; items: SrFulfillment[] };

export type SrChatCredentials = {
  ok?: boolean;
  message?: string;
  streamApiKey?: string;
  streamToken?: string;
  streamUserId?: string;
  streamChannelId?: string;
};

// The request `category` is free text. Filter chips are derived from the tags people actually
// use, most-used first, so the feed never forces a post into an ill-fitting bucket.
export function deriveCategories(requests: SrRequest[], selected: string): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const r of requests) {
    const label = r.category.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { label, count: 1 });
  }
  const tags = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((e) => e.label);
  // Keep the active filter visible even if no loaded request carries it anymore.
  if (selected !== "All" && !counts.has(selected.toLowerCase())) tags.push(selected);
  return ["All", ...tags];
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Poster handle: show the chosen @username (owner decision: shown publicly, never "Anonymous").
// When no username was captured, fall back to a neutral short id — mirrors Chyme's chymeHandle.
export function srHandle(username: string | null, id: string): string {
  return username ? `@${username}` : `user-${id.slice(0, 8)}`;
}
