// Shared constants, types, and helpers for the SocketRelay web shell.
// Palette derives from design/.../survivor-hub/SocketRelay.tsx.
// Types mirror lib/socket-relay/types.ts (the real backend model). The mockup's
// need/offer/credits/urgency framing is not backed by the data model, so the
// shell renders the real request/claim/fulfillment model instead.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#FDBA74";
export const BG = "#0F1117";
export const TEXT = "#E8EAF0";
export const SUBTLE = "#6B7280";
export const FAINT = "#4B5563";

// Theme-aware chrome tokens for the SocketRelay shell. Default keeps the shipped values (accent
// stays #FDBA74); comic uses the shared comic surface tokens plus the SocketRelay comic-ink accent.
export type SocketRelayTokens = PluginShellTokens;

export function getSocketRelayTokens(theme: ThemeName): SocketRelayTokens {
  const accent = theme === "comic" ? getAppAccent("socket-relay", "comic") : COLOR;
  return getPluginShellTokens(accent, theme);
}

export type Tab = "feed" | "post" | "chat";

export type SrRequestStatus = "open" | "claimed" | "closed" | "canceled";

export type SrRequest = {
  id: string;
  ownerUserId: string;
  ownerUsername: string | null;
  title: string;
  details: string;
  category: string;
  tags: string[];
  city: string | null;
  state: string | null;
  country: string | null;
  isPublic: boolean;
  status: SrRequestStatus;
  reopenedCount: number;
  claimedFulfillmentId: string | null;
  priceCurrency: string | null;
  priceAmount: number | null;
  // Every currency the poster accepts for settling (split settlements), ServiceCredits first.
  // Optional so older cached payloads without the field keep rendering.
  acceptedCurrencies?: string[];
  createdAtIso: string;
  updatedAtIso: string;
  // When the post auto-expires (28 days after posting/re-posting); `isExpired` is true only while it is
  // still open and that moment has passed.
  expiresAtIso: string | null;
  isExpired: boolean;
};

export type SrResolveOutcome = "successful" | "no_longer_needed" | "unsuccessful_reopen" | "unsuccessful_close";

export type SrFulfillment = {
  id: string;
  requestId: string;
  requesterUserId: string;
  fulfillerUserId: string;
  // Participant @usernames captured at claim time (may be null for legacy rows). Returned by
  // /api/socket-relay/my-fulfillments; the chat itself renders names from Stream, so these are optional.
  requesterUsername?: string | null;
  fulfillerUsername?: string | null;
  status: "active" | "closed" | "canceled";
  closeReason: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  // Joined from the request by /api/socket-relay/my-fulfillments so the chat can show context.
  requestTitle?: string;
  requestStatus?: SrRequestStatus;
  // Participants' real names, joined from directory_profiles by the same route. Null for a member
  // with no profile on file; used with the usernames above to name the other person in the header.
  requesterName?: string | null;
  fulfillerName?: string | null;
};

export type SrListResponse = { ok: boolean; items: SrRequest[]; page: number; pageSize: number; total: number };
export type SrFulfillmentsResponse = { ok: boolean; items: SrFulfillment[] };

// One row in the Direct Line list. Either a live conversation (an active fulfillment you can chat on)
// or a pending request you posted that no helper has claimed yet (a placeholder — no chat until it is
// claimed). Modeled as a discriminated union so the list can render both and only the fulfillment
// kind opens a chat.
export type SrDirectLine =
  | { kind: "fulfillment"; key: string; fulfillment: SrFulfillment }
  | { kind: "pending"; key: string; request: SrRequest };

// Build the unified Direct Line list, newest activity first within each group:
//   1. Active fulfillments — live conversations (you posted it and a helper claimed it, or you
//      offered to help).
//   2. Your own still-open, non-expired requests — "waiting for a helper" placeholders.
//   3. Past fulfillments — ones that were closed or canceled.
//
// A claimed request is already represented by its active fulfillment, so it is not also listed as a
// placeholder; that is why group 2 filters to `open`.
//
// Group 3 used to be dropped entirely. That erased the only record a member had of who had offered
// to help: when a claim is canceled the request returns to `open`, the feed shows "no helper yet"
// again, and the conversation vanished from this list — so the person who offered became
// unreachable and effectively anonymous (owner report: two people offered help and there was no way
// left to see who they were). Keeping past lines costs nothing to read: the chat routes gate on
// participation, not on status, so a participant could always open these — the list simply stopped
// pointing at them.
export function buildDirectLines(fulfillments: SrFulfillment[], myRequests: SrRequest[]): SrDirectLine[] {
  const byRecentUpdate = (a: SrFulfillment, b: SrFulfillment) => b.updatedAtIso.localeCompare(a.updatedAtIso);
  const active: SrDirectLine[] = fulfillments
    .filter((f) => f.status === "active")
    .sort(byRecentUpdate)
    .map((f) => ({ kind: "fulfillment", key: f.id, fulfillment: f }));
  const pending: SrDirectLine[] = myRequests
    .filter((r) => r.status === "open" && !r.isExpired)
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
    .map((r) => ({ kind: "pending", key: `pending:${r.id}`, request: r }));
  const past: SrDirectLine[] = fulfillments
    .filter((f) => f.status !== "active")
    .sort(byRecentUpdate)
    .map((f) => ({ kind: "fulfillment", key: f.id, fulfillment: f }));
  return [...active, ...pending, ...past];
}

export type SrChatCredentials = {
  ok?: boolean;
  message?: string;
  streamApiKey?: string;
  streamToken?: string;
  streamUserId?: string;
  streamChannelId?: string;
};

export const MAX_TAGS_PER_POST = 3;
// Mirrors the server's SOCKET_RELAY_MAX_TAG_LENGTH so a too-long tag is caught in the form
// instead of bouncing off the server as an invalid payload.
export const MAX_TAG_LENGTH = 64;
const MAX_FILTER_CHIPS = 10;

// The other participant, as a member reads it: name first, then handle, and neither when the person
// has no profile and no handle on file. Deliberately never falls back to the Clerk id — an id is not
// an identity to a member, and the point of naming them is so a request owner can tell who offered.
export function srCounterpartLabel(f: SrFulfillment, viewerIsRequester: boolean): string | null {
  const name = viewerIsRequester ? f.fulfillerName : f.requesterName;
  const username = viewerIsRequester ? f.fulfillerUsername : f.requesterUsername;
  if (name) return username ? `${name} (@${username})` : name;
  if (username) return `@${username}`;
  return null;
}

export function requestTags(r: Pick<SrRequest, "category" | "tags">): string[] {
  if (r.tags && r.tags.length > 0) return r.tags;
  return r.category.trim() ? [r.category.trim()] : [];
}

// Tags are free text. Filter chips are derived from the tags people actually use, most-used
// first and capped at MAX_FILTER_CHIPS, so the feed never forces a post into an ill-fitting
// bucket and the chip row cannot grow without bound.
export function deriveCategories(requests: SrRequest[], selected: string): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const r of requests) {
    for (const tag of requestTags(r)) {
      const label = tag.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { label, count: 1 });
    }
  }
  const tags = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, MAX_FILTER_CHIPS)
    .map((e) => e.label);
  // Keep the active filter visible even if it fell outside the top chips.
  if (selected !== "All" && !tags.some((t) => t.toLowerCase() === selected.toLowerCase())) {
    tags.push(selected);
  }
  return ["All", ...tags];
}

// Suggestions while typing a tag in the post form: known tags matching the prefix,
// excluding ones already attached to the draft.
export function suggestTags(requests: SrRequest[], prefix: string, exclude: string[]): string[] {
  const q = prefix.trim().toLowerCase();
  const excluded = new Set(exclude.map((t) => t.toLowerCase()));
  return deriveCategories(requests, "All")
    .slice(1)
    .filter((t) => !excluded.has(t.toLowerCase()) && (q === "" || t.toLowerCase().startsWith(q)))
    .slice(0, 6);
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

// Plain label for how a request is settled (issue #420). Honors the ServiceCredits rule (never the bare
// "SC" code, never a fiat equivalent) and renders Free/Barter from their value types. For fiat/crypto it
// shows the amount + code (e.g. "20 USD") — the full catalog formatting lives in the create form.
export function settlementLabel(priceCurrency: string | null, priceAmount: number | null): string {
  if (!priceCurrency || priceCurrency === "FREE") return "Free";
  if (priceCurrency === "BARTER") return "Barter";
  if (priceCurrency === "SC") return priceAmount != null ? `${priceAmount} ServiceCredits` : "ServiceCredits";
  return priceAmount != null ? `${priceAmount} ${priceCurrency}` : priceCurrency;
}
