"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Share2 } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { useTheme } from "@/hooks/useTheme";
import {
  BG,
  buildDirectLines,
  deriveCategories,
  getSocketRelayTokens,
  requestTags,
  suggestTags,
  type SocketRelayTokens,
  type SrChatCredentials,
  type SrDirectLine,
  type SrFulfillment,
  type SrFulfillmentsResponse,
  type SrListResponse,
  type SrRequest,
  type SrResolveOutcome,
  type Tab,
} from "./sr-shared";
import { SocketRelayLoading } from "./sr-loading";
import { SocketRelayFeed } from "./sr-feed";
import { SocketRelayPost, type PostDraft } from "./sr-post";
import { SocketRelayChat } from "./sr-chat";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

const EMPTY_DRAFT: PostDraft = { title: "", details: "", tags: [], city: "", state: "", country: "", isPublic: false, priceCurrency: "FREE", priceAmount: "", requiresAmount: false, acceptedCurrencies: [] };

type MemberLocation = { city: string; state: string; country: string };
const EMPTY_LOCATION: MemberLocation = { city: "", state: "", country: "" };

// A fresh post draft, seeded with the member's own directory location so a new request defaults to
// where they are (still fully editable / clearable in the form — a request can be for elsewhere).
function freshDraft(loc: MemberLocation): PostDraft {
  return { ...EMPTY_DRAFT, city: loc.city, state: loc.state, country: loc.country };
}

// Build an edit draft from an existing request (Edit re-opens the post in the Post tab).
function draftFromRequest(request: SrRequest): PostDraft {
  return {
    title: request.title,
    details: request.details,
    tags: requestTags(request),
    city: request.city ?? "",
    state: request.state ?? "",
    country: request.country ?? "",
    isPublic: request.isPublic,
    priceCurrency: request.priceCurrency ?? "FREE",
    priceAmount: request.priceAmount != null ? String(request.priceAmount) : "",
    requiresAmount: request.priceAmount != null,
    acceptedCurrencies: request.acceptedCurrencies ?? [],
  };
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// Read the items/total off a possibly-null list response, normalizing to empties. Kept as tiny
// helpers so the loader below stays well within the rule-116 complexity limit.
function itemsOf<T>(res: { items?: T[] } | null): T[] {
  return res?.items ?? [];
}
function totalOf(res: { total?: number } | null): number {
  return res?.total ?? 0;
}

// Page size for the main feed. The server scopes the feed to open (claimable) requests; "Load more"
// pulls the next page and appends it, so resolved/claimed posts never crowd open ones off page one.
const FEED_PAGE_SIZE = 20;

// Load all three feed datasets at once, normalizing missing payloads to empties.
// Kept out of the component so the loader stays within the rule-116 complexity limit.
// The main feed asks for open requests only (server-side ?status=open) — the first page. My-requests is
// fetched at the max page size (all statuses) so the "Mine" filter and the Direct Line list can show a
// member's own posts regardless of status (a member realistically has far fewer than 100 at once).
async function loadSocketRelayData(): Promise<{
  requests: SrRequest[];
  requestsTotal: number;
  myRequests: SrRequest[];
  myRequestCount: number;
  fulfillments: SrFulfillment[];
}> {
  const [reqData, myReqData, fulData] = await Promise.all([
    getJson<SrListResponse>(`/api/socket-relay/requests?status=open&page=1&pageSize=${FEED_PAGE_SIZE}`),
    getJson<SrListResponse>("/api/socket-relay/my-requests?pageSize=100"),
    getJson<SrFulfillmentsResponse>("/api/socket-relay/my-fulfillments"),
  ]);
  return {
    requests: itemsOf(reqData),
    requestsTotal: totalOf(reqData),
    myRequests: itemsOf(myReqData),
    myRequestCount: totalOf(myReqData),
    fulfillments: itemsOf(fulData),
  };
}

// Best-effort load of the member's own directory location. A missing profile or a failed fetch resolves
// to null so the caller can leave the default blank — it never blocks posting.
async function fetchMemberLocation(signal: AbortSignal): Promise<MemberLocation | null> {
  try {
    const res = await fetch("/api/directory/profile", { signal });
    if (!res.ok || signal.aborted) return null;
    const data = (await res.json()) as { profile?: { city?: string | null; state?: string | null; country?: string | null } | null };
    const p = data.profile;
    if (!p || signal.aborted) return null;
    return { city: p.city ?? "", state: p.state ?? "", country: p.country ?? "" };
  } catch {
    return null;
  }
}

// Friendly, field-specific checks so a member is told exactly what to fix — never a raw
// "invalid payload" from the server. Returns the error message, or null when the draft is postable.
function validatePostDraft(draft: PostDraft): string | null {
  if (!draft.title.trim()) return "Add a short title for your request.";
  if (!draft.details.trim()) return "Add a few details about what you need or can give.";
  if (draft.tags.length === 0) return "Add at least one tag (for example Food or Transport).";
  if (draft.requiresAmount && !(Number(draft.priceAmount) > 0)) return "Enter an amount for the payment type you chose, or switch it to Free.";
  return null;
}

// Normalize a trimmed text field to its value or null (a blank optional field is stored as null).
function trimmedOrNull(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

// Amount only for priced types (the form clears it for Free/Barter, so a blank amount becomes null).
function parsePriceAmount(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildRequestBody(draft: PostDraft) {
  return {
    title: draft.title.trim(),
    details: draft.details.trim(),
    tags: draft.tags,
    city: trimmedOrNull(draft.city),
    state: trimmedOrNull(draft.state),
    country: trimmedOrNull(draft.country),
    isPublic: draft.isPublic,
    // The chosen value type (default 'FREE'); amount only for priced types.
    priceCurrency: draft.priceCurrency || null,
    priceAmount: parsePriceAmount(draft.priceAmount),
    // Split settlements: every currency the poster accepts, independent of the single price above.
    acceptedCurrencies: draft.acceptedCurrencies,
  };
}

// Create (POST) or update (PUT) a request. Throws with a friendly message on a non-OK response.
async function saveDraft(draft: PostDraft, editingId: string | null): Promise<void> {
  const url = editingId ? `/api/socket-relay/requests/${editingId}` : "/api/socket-relay/requests";
  const res = await fetch(url, {
    method: editingId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
    body: JSON.stringify(buildRequestBody(draft)),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Failed to save request.");
  }
}

// POST with the CSRF header and no body; returns whether the server accepted it. Used by the re-post
// and claim buttons, which only need to know success to trigger a refresh. A network failure returns
// false so the caller simply skips the refresh (the next refresh reflects the latest state).
async function postCsrf(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "x-ctf-csrf": "1" } });
    return res.ok;
  } catch {
    return false;
  }
}

// Fetch Stream chat credentials for a fulfillment's Direct Line. Throws with a message on any non-OK
// response (or a payload without credentials) so the caller can surface it.
async function fetchChatCredentials(fulfillmentId: string): Promise<SrChatCredentials> {
  const res = await fetch(`/api/socket-relay/fulfillments/${fulfillmentId}/chat`, {
    method: "POST",
    headers: { "x-ctf-csrf": "1" },
  });
  if (!res.ok) throw new Error("Failed to fetch chat credentials");
  const data = (await res.json()) as SrChatCredentials;
  if (!data.ok) throw new Error(data.message ?? "No chat credentials");
  return data;
}

// Resolve (close / reopen) a fulfillment with the chosen outcome. Throws with a friendly message on a
// non-OK response.
async function closeFulfillment(fulfillmentId: string, outcome: SrResolveOutcome): Promise<void> {
  const res = await fetch(`/api/socket-relay/fulfillments/${fulfillmentId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
    body: JSON.stringify({ outcome }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Couldn't resolve this request. Please try again.");
  }
}

// Whether a request row matches the active search term across its title/details/location.
function matchesSearch(r: SrRequest, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return `${r.title} ${r.details} ${r.city ?? ""} ${r.state ?? ""} ${r.country ?? ""}`.toLowerCase().includes(q);
}

// Whether a request row passes the current category/owner/search filter for the feed list.
function matchesRequestFilter(r: SrRequest, category: string, userId: string | undefined, search: string): boolean {
  if (category === "Mine") {
    // Every row in myRequests is already the member's own; keep all statuses so they can always find,
    // edit, and re-post their own posts.
    if (r.ownerUserId !== userId) return false;
  } else {
    // Active feed: an expired post drops out for everyone EXCEPT its owner. The owner always sees
    // their own posts — including expired ones (dimmed, with the Expired pill + Re-post) — so a post
    // never silently disappears from the poster's own feed and re-posting is always one click away.
    if (r.isExpired && r.ownerUserId !== userId) return false;
    if (category !== "All" && !requestTags(r).some((tag) => tag.toLowerCase() === category.toLowerCase())) return false;
  }
  return matchesSearch(r, search);
}

type SocketRelayShellProps = {
  userId?: string;
  isAdmin?: boolean;
  role?: string | null;
};

// All SocketRelay state, effects, and action handlers. Split out of the component so both the hook and
// the component stay within the rule-116 line/complexity limits. Hook order is fixed and unconditional.
function useSocketRelay() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<SrRequest[]>([]);
  // Server-side total of open (claimable) requests, and how many feed pages have been pulled in. Drive
  // the "N open" badge and the "Load more" button so a full board isn't capped at the first 20.
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestsPage, setRequestsPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myRequests, setMyRequests] = useState<SrRequest[]>([]);
  const [, setMyRequestCount] = useState(0);
  const [fulfillments, setFulfillments] = useState<SrFulfillment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("feed");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<PostDraft>(EMPTY_DRAFT);
  // The member's own location from their directory profile, used to default a new request's location.
  const [myLocation, setMyLocation] = useState<MemberLocation>(EMPTY_LOCATION);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);
  const [selectedLine, setSelectedLine] = useState<SrDirectLine | null>(null);
  // Whether the ?fulfillment=<id> deep link (from the "someone offered to help" notification) has been
  // resolved to an open Direct Line yet. Guards the one-shot deep-link effect below.
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [chatCredentials, setChatCredentials] = useState<SrChatCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await loadSocketRelayData();
      setRequests(data.requests);
      setRequestsTotal(data.requestsTotal);
      setRequestsPage(1);
      setMyRequests(data.myRequests);
      setMyRequestCount(data.myRequestCount);
      setFulfillments(data.fulfillments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load SocketRelay.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // "Load more": pull the next page of open requests and append it, de-duping by id so a post that
  // shifted across the page boundary (e.g. a new post arrived) is never shown twice.
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const next = requestsPage + 1;
      const data = await getJson<SrListResponse>(
        `/api/socket-relay/requests?status=open&page=${next}&pageSize=${FEED_PAGE_SIZE}`,
      );
      if (data) {
        setRequests((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...data.items.filter((item) => !seen.has(item.id))];
        });
        setRequestsTotal(data.total);
        setRequestsPage(next);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [requestsPage]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Best-effort load of the member's own directory location to default a new request's location.
  // A missing profile or a failed fetch simply leaves the default blank — never blocks posting.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const loc = await fetchMemberLocation(controller.signal);
      if (!loc || controller.signal.aborted) return;
      setMyLocation(loc);
      // Seed the current draft only if it is a pristine, untouched post (no title/details and no
      // location typed). The content guard is what protects an in-progress compose or an open edit
      // (both have a title), so this never clobbers real work regardless of the current tab.
      setDraft((d) =>
        !d.title && !d.details && !d.city && !d.state && !d.country
          ? { ...d, city: loc.city, state: loc.state, country: loc.country }
          : d,
      );
    })();
    return () => controller.abort();
  }, []);

  const startEdit = useCallback((request: SrRequest) => {
    setDraft(draftFromRequest(request));
    setEditingId(request.id);
    setPostError(null);
    setPostSuccess(false);
    setTab("post");
  }, []);

  const cancelEdit = useCallback(() => {
    setDraft(freshDraft(myLocation));
    setEditingId(null);
    setPostError(null);
    setPostSuccess(false);
    setTab("feed");
  }, [myLocation]);

  const handlePost = useCallback(async () => {
    const validationError = validatePostDraft(draft);
    if (validationError) {
      setPostError(validationError);
      return;
    }
    setSubmitting(true);
    setPostError(null);
    setPostSuccess(false);
    try {
      await saveDraft(draft, editingId);
      setDraft(freshDraft(myLocation));
      setEditingId(null);
      setPostSuccess(true);
      await fetchData(false);
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed to save request.");
    } finally {
      setSubmitting(false);
    }
  }, [draft, editingId, myLocation, fetchData]);

  // Re-post an expired (or closed) request: re-opens it and resets the 28-day clock. Owner-only on the
  // server; here it is offered only on the member's own expired posts.
  const handleRepost = useCallback(async (requestId: string) => {
    setSubmitting(true);
    try {
      if (await postCsrf(`/api/socket-relay/requests/${requestId}/repost`)) await fetchData(false);
    } finally {
      setSubmitting(false);
    }
  }, [fetchData]);

  const handleClaim = useCallback(async (requestId: string) => {
    setSubmitting(true);
    try {
      if (await postCsrf(`/api/socket-relay/requests/${requestId}/fulfill`)) await fetchData(false);
    } finally {
      setSubmitting(false);
    }
  }, [fetchData]);

  // Select a Direct Line row. A pending request (no helper yet) has no chat to open — it just shows the
  // "waiting for a helper" pane — so only a fulfillment row fetches chat credentials.
  const handleSelectLine = useCallback(async (line: SrDirectLine) => {
    setSelectedLine(line);
    setChatCredentials(null);
    setChatError(null);
    if (line.kind !== "fulfillment") {
      setChatLoading(false);
      return;
    }
    setChatLoading(true);
    try {
      setChatCredentials(await fetchChatCredentials(line.fulfillment.id));
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      setChatLoading(false);
    }
  }, []);

  // Deep link: the "Someone offered to help" notification links to /apps/socket-relay?fulfillment=<id>.
  // Once the data has loaded, open the Direct Line tab and select that conversation, instead of dropping
  // the member on the feed. Runs once. If the fulfillment is no longer active (already resolved), it
  // still lands on the Direct Line tab so the member sees their conversations rather than the feed.
  useEffect(() => {
    if (deepLinkHandled || loading) return;
    const fulfillmentId = new URLSearchParams(window.location.search).get("fulfillment");
    if (!fulfillmentId) {
      setDeepLinkHandled(true);
      return;
    }
    const match = buildDirectLines(fulfillments, myRequests).find(
      (l) => l.kind === "fulfillment" && l.fulfillment.id === fulfillmentId,
    );
    setTab("chat");
    if (match) void handleSelectLine(match);
    // Strip ?fulfillment=<id> from the URL so a later refresh doesn't yank the member back to the
    // Direct Line tab after they've moved to Feed/Post. One-time handoff, not a persistent view.
    window.history.replaceState(null, "", window.location.pathname);
    setDeepLinkHandled(true);
  }, [deepLinkHandled, loading, fulfillments, myRequests, handleSelectLine]);

  // Only the requester (the person who posted) can resolve; the route enforces this too. On success
  // we refresh and clear the selection so the resolved/reopened state is reflected.
  const handleResolve = useCallback(async (fulfillmentId: string, outcome: SrResolveOutcome) => {
    setResolving(true);
    setChatError(null);
    try {
      await closeFulfillment(fulfillmentId, outcome);
      setSelectedLine(null);
      setChatCredentials(null);
      await fetchData(false);
    } catch (e) {
      // Surface the failure and still refresh so the chat doesn't sit on stale state.
      setChatError(e instanceof Error ? e.message : "Couldn't resolve this request. Please try again.");
      await fetchData(false);
    } finally {
      setResolving(false);
    }
  }, [fetchData]);

  const updateDraft = useCallback((patch: Partial<PostDraft>) => setDraft((d) => ({ ...d, ...patch })), []);
  const clearSelection = useCallback(() => {
    setSelectedLine(null);
    setChatCredentials(null);
    setChatError(null);
  }, []);

  return {
    loading, error, requests, requestsTotal, loadingMore, myRequests, fulfillments,
    submitting, tab, category, search, draft, editingId, postError, postSuccess,
    selectedLine, chatCredentials, chatLoading, chatError, resolving,
    setTab, setCategory, setSearch,
    fetchData, loadMore, startEdit, cancelEdit, handlePost, handleRepost, handleClaim,
    handleSelectLine, handleResolve, updateDraft, clearSelection,
  };
}

type SocketRelayHeaderProps = {
  t: SocketRelayTokens;
  openCount: number;
  isAdmin?: boolean;
  tab: Tab;
  tabs: { key: Tab; label: string }[];
  onTab: (tab: Tab) => void;
  search: string;
  onSearch: (value: string) => void;
  categories: string[];
  category: string;
  onCategory: (category: string) => void;
  onRefresh: () => void;
};

// Sticky header: title bar, tab switcher, and (on the feed tab) the search box + category chips.
function SocketRelayHeader({ t, openCount, isAdmin, tab, tabs, onTab, search, onSearch, categories, category, onCategory, onRefresh }: SocketRelayHeaderProps) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
      {/* flexWrap: the row carries back + share + title + open-count + Admin + refresh + the three
          global actions, which together need ~436px and do not fit a 390px phone. Without wrapping
          the last item (the account avatar) was clipped off the right edge and the title collapsed to
          nothing (owner report). Wrapping moves the global actions to a second line instead of
          cutting them off, and gives the title its width back. Nothing is removed, and on a wider
          viewport the row still renders as one line exactly as before. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 6, gap: 10, padding: "10px 14px" }}>
        <BackChevronButton accent={t.ACCENT} />
        <Share2 size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: t.TEXT, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>SocketRelay</span>
        <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>{openCount} open</Badge>
        <PluginAdminButton href="/admin/socket-relay" isAdmin={isAdmin} accent={t.ACCENT} />
        <RefreshButton onRefresh={onRefresh} title="Refresh" />
        <MobileTopActions />
      </div>
      <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => onTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${tab === key ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {tab === "feed" && (
        <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search requests…" style={{ width: "100%", padding: "8px 10px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.SUBTLE, outline: "none", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {categories.map((c) => (
              <button key={c} onClick={() => onCategory(c)} style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 14, background: category === c ? `${t.ACCENT}14` : "transparent", border: `1px solid ${category === c ? t.ACCENT + "50" : t.BORDER_HI}`, color: category === c ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{c}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type SocketRelayTabContentProps = {
  tab: Tab;
  requests: SrRequest[];
  allRequests: SrRequest[];
  userId?: string;
  // Request ids the member cannot claim again (their earlier claim was canceled by the poster).
  reclaimBlockedIds: Set<string>;
  submitting: boolean;
  search: string;
  category: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onClaim: (id: string) => void;
  onPost: () => void;
  onEdit: (request: SrRequest) => void;
  onRepost: (id: string) => void;
  draft: PostDraft;
  editing: boolean;
  onChange: (patch: Partial<PostDraft>) => void;
  postError: string | null;
  postSuccess: boolean;
  onSubmit: () => void;
  onCancelEdit: () => void;
  directLines: SrDirectLine[];
  selectedLine: SrDirectLine | null;
  resolving: boolean;
  onSelect: (line: SrDirectLine) => void;
  onBack: () => void;
  onResolve: (id: string, outcome: SrResolveOutcome) => void;
  chatLoading: boolean;
  chatError: string | null;
  chatCredentials: SrChatCredentials | null;
};

// The body under the header: whichever tab is active. `requests` is the filtered feed list; suggestions
// pull from `allRequests` (the full loaded set) so tag autocomplete is not limited to the visible rows.
function SocketRelayTabContent(props: SocketRelayTabContentProps) {
  const { tab, requests, allRequests, userId, reclaimBlockedIds, submitting, search, category } = props;
  const { hasMore, loadingMore, onLoadMore, onClaim, onPost, onEdit, onRepost } = props;
  const { draft, editing, onChange, postError, postSuccess, onSubmit, onCancelEdit } = props;
  const { directLines, selectedLine, resolving, onSelect, onBack, onResolve, chatLoading, chatError, chatCredentials } = props;
  const filterActive = Boolean(search.trim()) || category !== "All";
  return (
    <>
      {tab === "feed" && (
        <SocketRelayFeed
          requests={requests}
          currentUserId={userId}
          reclaimBlockedIds={reclaimBlockedIds}
          submitting={submitting}
          filterActive={filterActive}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={onLoadMore}
          onClaim={onClaim}
          onPost={onPost}
          onEdit={onEdit}
          onRepost={onRepost}
        />
      )}
      {tab === "post" && (
        <SocketRelayPost
          draft={draft}
          editing={editing}
          onChange={onChange}
          submitting={submitting}
          error={postError}
          success={postSuccess}
          onSubmit={onSubmit}
          onCancelEdit={onCancelEdit}
          suggest={(prefix, exclude) => suggestTags(allRequests, prefix, exclude)}
        />
      )}
      {tab === "chat" && (
        <SocketRelayChat
          directLines={directLines}
          selected={selectedLine}
          currentUserId={userId}
          resolving={resolving}
          onSelect={onSelect}
          onBack={onBack}
          onResolve={onResolve}
          chatLoading={chatLoading}
          chatError={chatError}
          chatCredentials={chatCredentials}
        />
      )}
    </>
  );
}

export function SocketRelayShell({ userId, isAdmin }: SocketRelayShellProps) {
  const sr = useSocketRelay();
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);

  if (sr.loading) return <SocketRelayLoading />;
  if (sr.error) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {sr.error}
      </div>
    );
  }

  // The "N open" badge uses the server-side total of open requests (not just the loaded page), so it
  // stays honest when the board has more than one page. It counts every open post; a small number may
  // be expired-open (hidden from non-owners in the feed), which is close enough for a header badge.
  const openCount = sr.requestsTotal;
  // Only the default "All" feed paginates the board; "Mine" is already the member's own full set.
  const hasMore = sr.category !== "Mine" && sr.requests.length < sr.requestsTotal;
  // "Mine" is a leading filter (only when signed in) so a member can always find their own posts — on a
  // small phone screen especially — to edit or re-post them, instead of hunting through the whole feed.
  const baseCategories = deriveCategories(sr.requests, sr.category === "Mine" ? "All" : sr.category);
  const categories = userId ? ["All", "Mine", ...baseCategories.filter((c) => c !== "All")] : baseCategories;
  // "Mine" sources from `myRequests` (owner-scoped server-side, fetched at pageSize=100), NOT the global
  // feed `requests` (only the 20 newest). Reading the global feed meant a member's own post fell out of
  // "Mine" as soon as 20 newer posts existed board-wide — hiding their own posts and blocking Edit/Re-post.
  const source = sr.category === "Mine" ? sr.myRequests : sr.requests;
  const visible = source.filter((r) => matchesRequestFilter(r, sr.category, userId, sr.search));
  // The Direct Line list: active conversations plus your own still-open requests as pending
  // placeholders. Canceled/closed lines drop out — one row per request you're waiting on or talking through.
  const directLines = buildDirectLines(sr.fulfillments, sr.myRequests);
  // Requests this member was canceled off as the helper (the poster chose "didn't work — reopen for
  // others"). The server refuses a re-claim on these, so the feed replaces the "I can help" button
  // with a plain note instead of offering an action that would fail.
  const reclaimBlockedIds = new Set(
    sr.fulfillments
      .filter((f) => f.status === "canceled" && f.fulfillerUserId === userId)
      .map((f) => f.requestId),
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "feed", label: "Feed" },
    { key: "post", label: "Post" },
    { key: "chat", label: "Direct Line" },
  ];
  return (
    <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
      <SocketRelayHeader
        t={t}
        openCount={openCount}
        isAdmin={isAdmin}
        tab={sr.tab}
        tabs={tabs}
        onTab={sr.setTab}
        search={sr.search}
        onSearch={sr.setSearch}
        categories={categories}
        category={sr.category}
        onCategory={sr.setCategory}
        onRefresh={() => sr.fetchData(false)}
      />
      <SocketRelayTabContent
        tab={sr.tab}
        requests={visible}
        allRequests={sr.requests}
        userId={userId}
        reclaimBlockedIds={reclaimBlockedIds}
        submitting={sr.submitting}
        search={sr.search}
        category={sr.category}
        hasMore={hasMore}
        loadingMore={sr.loadingMore}
        onLoadMore={() => void sr.loadMore()}
        onClaim={(id) => void sr.handleClaim(id)}
        onPost={() => sr.setTab("post")}
        onEdit={sr.startEdit}
        onRepost={(id) => void sr.handleRepost(id)}
        draft={sr.draft}
        editing={sr.editingId !== null}
        onChange={sr.updateDraft}
        postError={sr.postError}
        postSuccess={sr.postSuccess}
        onSubmit={() => void sr.handlePost()}
        onCancelEdit={sr.cancelEdit}
        directLines={directLines}
        selectedLine={sr.selectedLine}
        resolving={sr.resolving}
        onSelect={(line) => void sr.handleSelectLine(line)}
        onBack={sr.clearSelection}
        onResolve={(id, outcome) => void sr.handleResolve(id, outcome)}
        chatLoading={sr.chatLoading}
        chatError={sr.chatError}
        chatCredentials={sr.chatCredentials}
      />
    </div>
  );
}
