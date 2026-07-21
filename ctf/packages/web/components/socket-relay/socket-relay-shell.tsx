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

const EMPTY_DRAFT: PostDraft = { title: "", details: "", tags: [], city: "", state: "", country: "", isPublic: false, priceCurrency: "FREE", priceAmount: "", requiresAmount: false };

type MemberLocation = { city: string; state: string; country: string };
const EMPTY_LOCATION: MemberLocation = { city: "", state: "", country: "" };

// A fresh post draft, seeded with the member's own directory location so a new request defaults to
// where they are (still fully editable / clearable in the form — a request can be for elsewhere).
function freshDraft(loc: MemberLocation): PostDraft {
  return { ...EMPTY_DRAFT, city: loc.city, state: loc.state, country: loc.country };
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// Load all three feed datasets at once, normalizing missing payloads to empties.
// Kept out of the component so the loader stays within the rule-116 complexity limit.
// My-requests is fetched at the max page size so the Direct Line list can show every open request as a
// pending line (a member realistically has far fewer than 100 open at once).
async function loadSocketRelayData(): Promise<{ requests: SrRequest[]; myRequests: SrRequest[]; myRequestCount: number; fulfillments: SrFulfillment[] }> {
  const [reqData, myReqData, fulData] = await Promise.all([
    getJson<SrListResponse>("/api/socket-relay/requests"),
    getJson<SrListResponse>("/api/socket-relay/my-requests?pageSize=100"),
    getJson<SrFulfillmentsResponse>("/api/socket-relay/my-fulfillments"),
  ]);
  return {
    requests: reqData?.items ?? [],
    myRequests: myReqData?.items ?? [],
    myRequestCount: myReqData?.total ?? 0,
    fulfillments: fulData?.items ?? [],
  };
}

type SocketRelayShellProps = {
  userId?: string;
  isAdmin?: boolean;
  role?: string | null;
};

export function SocketRelayShell({ userId, isAdmin }: SocketRelayShellProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<SrRequest[]>([]);
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
  const [chatCredentials, setChatCredentials] = useState<SrChatCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await loadSocketRelayData();
      setRequests(data.requests);
      setMyRequests(data.myRequests);
      setMyRequestCount(data.myRequestCount);
      setFulfillments(data.fulfillments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load SocketRelay.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Best-effort load of the member's own directory location to default a new request's location.
  // A missing profile or a failed fetch simply leaves the default blank — never blocks posting.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/directory/profile", { signal: controller.signal });
        if (!res.ok || controller.signal.aborted) return;
        const data = (await res.json()) as { profile?: { city?: string | null; state?: string | null; country?: string | null } | null };
        const p = data.profile;
        if (!p || controller.signal.aborted) return;
        const loc: MemberLocation = { city: p.city ?? "", state: p.state ?? "", country: p.country ?? "" };
        setMyLocation(loc);
        // Seed the current draft only if it is a pristine, untouched post (no title/details and no
        // location typed). The content guard is what protects an in-progress compose or an open edit
        // (both have a title), so this never clobbers real work regardless of the current tab.
        setDraft((d) =>
          !d.title && !d.details && !d.city && !d.state && !d.country
            ? { ...d, city: loc.city, state: loc.state, country: loc.country }
            : d,
        );
      } catch {
        // Leave the default blank.
      }
    })();
    return () => controller.abort();
  }, []);

  function startEdit(request: SrRequest) {
    setDraft({
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
    });
    setEditingId(request.id);
    setPostError(null);
    setPostSuccess(false);
    setTab("post");
  }

  function cancelEdit() {
    setDraft(freshDraft(myLocation));
    setEditingId(null);
    setPostError(null);
    setPostSuccess(false);
    setTab("feed");
  }

  async function handlePost() {
    // Friendly, field-specific checks so a member is told exactly what to fix — never a raw
    // "invalid payload" from the server.
    if (!draft.title.trim()) {
      setPostError("Add a short title for your request.");
      return;
    }
    if (!draft.details.trim()) {
      setPostError("Add a few details about what you need or can give.");
      return;
    }
    if (draft.tags.length === 0) {
      setPostError("Add at least one tag (for example Food or Transport).");
      return;
    }
    if (draft.requiresAmount && !(Number(draft.priceAmount) > 0)) {
      setPostError("Enter an amount for the payment type you chose, or switch it to Free.");
      return;
    }
    setSubmitting(true);
    setPostError(null);
    setPostSuccess(false);
    try {
      const url = editingId ? `/api/socket-relay/requests/${editingId}` : "/api/socket-relay/requests";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          title: draft.title.trim(),
          details: draft.details.trim(),
          tags: draft.tags,
          city: draft.city.trim() ? draft.city.trim() : null,
          state: draft.state.trim() ? draft.state.trim() : null,
          country: draft.country.trim() ? draft.country.trim() : null,
          isPublic: draft.isPublic,
          // The chosen value type (default 'FREE'); amount only for priced types (the form clears it
          // for Free/Barter, so a blank amount becomes null).
          priceCurrency: draft.priceCurrency || null,
          priceAmount: (() => {
            const n = Number(draft.priceAmount);
            return Number.isFinite(n) && n > 0 ? n : null;
          })(),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to save request.");
      }
      setDraft(freshDraft(myLocation));
      setEditingId(null);
      setPostSuccess(true);
      await fetchData(false);
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed to save request.");
    } finally {
      setSubmitting(false);
    }
  }

  // Re-post an expired (or closed) request: re-opens it and resets the 28-day clock. Owner-only on the
  // server; here it is offered only on the member's own expired posts.
  async function handleRepost(requestId: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/socket-relay/requests/${requestId}/repost`, {
        method: "POST",
        headers: { "x-ctf-csrf": "1" },
      });
      if (res.ok) await fetchData(false);
    } catch {
      // Refresh will reflect the latest state.
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaim(requestId: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/socket-relay/requests/${requestId}/fulfill`, {
        method: "POST",
        headers: { "x-ctf-csrf": "1" },
      });
      if (res.ok) await fetchData(false);
    } catch {
      // Refresh will reflect the latest state.
    } finally {
      setSubmitting(false);
    }
  }

  // Select a Direct Line row. A pending request (no helper yet) has no chat to open — it just shows the
  // "waiting for a helper" pane — so only a fulfillment row fetches chat credentials.
  async function handleSelectLine(line: SrDirectLine) {
    setSelectedLine(line);
    setChatCredentials(null);
    setChatError(null);
    if (line.kind !== "fulfillment") {
      setChatLoading(false);
      return;
    }
    setChatLoading(true);
    try {
      const res = await fetch(`/api/socket-relay/fulfillments/${line.fulfillment.id}/chat`, {
        method: "POST",
        headers: { "x-ctf-csrf": "1" },
      });
      if (!res.ok) throw new Error("Failed to fetch chat credentials");
      const data = (await res.json()) as SrChatCredentials;
      if (!data.ok) throw new Error(data.message ?? "No chat credentials");
      setChatCredentials(data);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      setChatLoading(false);
    }
  }

  // Only the requester (the person who posted) can resolve; the route enforces this too. On success
  // we refresh and clear the selection so the resolved/reopened state is reflected.
  async function handleResolve(fulfillmentId: string, outcome: SrResolveOutcome) {
    setResolving(true);
    setChatError(null);
    try {
      const res = await fetch(`/api/socket-relay/fulfillments/${fulfillmentId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Couldn't resolve this request. Please try again.");
      }
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
  }

  if (loading) return <SocketRelayLoading />;
  if (error) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  // An expired post (open but past its 28-day life) is no longer "active", so it does not count toward
  // the open badge and does not appear in the active feed — only under the member's own "Mine" filter.
  const openCount = requests.filter((r) => r.status === "open" && !r.isExpired).length;
  // "Mine" is a leading filter (only when signed in) so a member can always find their own posts — on a
  // small phone screen especially — to edit or re-post them, instead of hunting through the whole feed.
  const baseCategories = deriveCategories(requests, category === "Mine" ? "All" : category);
  const categories = userId ? ["All", "Mine", ...baseCategories.filter((c) => c !== "All")] : baseCategories;
  const visible = requests.filter((r) => {
    if (category === "Mine") {
      if (r.ownerUserId !== userId) return false;
    } else {
      // Active feed: an expired post drops out for everyone EXCEPT its owner. The owner always sees
      // their own posts — including expired ones (dimmed, with the Expired pill + Re-post) — so a post
      // never silently disappears from the poster's own feed and re-posting is always one click away.
      // This matches the mobile app, which keeps the owner's expired posts in the feed too.
      if (r.isExpired && r.ownerUserId !== userId) return false;
      if (category !== "All" && !requestTags(r).some((tag) => tag.toLowerCase() === category.toLowerCase())) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!`${r.title} ${r.details} ${r.city ?? ""} ${r.state ?? ""} ${r.country ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // The Direct Line list: active conversations plus your own still-open requests as pending
  // placeholders. Cancelled/closed lines drop out — one row per request you're waiting on or talking through.
  const directLines = buildDirectLines(fulfillments, myRequests);

  const content = (
    <>
      {tab === "feed" && (
        <SocketRelayFeed
          requests={visible}
          currentUserId={userId}
          submitting={submitting}
          onClaim={(id) => void handleClaim(id)}
          onPost={() => setTab("post")}
          onEdit={startEdit}
          onRepost={(id) => void handleRepost(id)}
        />
      )}
      {tab === "post" && (
        <SocketRelayPost
          draft={draft}
          editing={editingId !== null}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          submitting={submitting}
          error={postError}
          success={postSuccess}
          onSubmit={() => void handlePost()}
          onCancelEdit={cancelEdit}
          suggest={(prefix, exclude) => suggestTags(requests, prefix, exclude)}
        />
      )}
      {tab === "chat" && (
        <SocketRelayChat
          directLines={directLines}
          selected={selectedLine}
          currentUserId={userId}
          resolving={resolving}
          onSelect={(line) => void handleSelectLine(line)}
          onResolve={(id, outcome) => void handleResolve(id, outcome)}
          chatLoading={chatLoading}
          chatError={chatError}
          chatCredentials={chatCredentials}
        />
      )}
    </>
  );

    const tabs: { key: Tab; label: string }[] = [
      { key: "feed", label: "Feed" },
      { key: "post", label: "Post" },
      { key: "chat", label: "Direct Line" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            <Share2 size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TEXT, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>SocketRelay</span>
            <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>{openCount} open</Badge>
            <PluginAdminButton href="/admin/socket-relay" isAdmin={isAdmin} accent={t.ACCENT} />
            <RefreshButton onRefresh={() => fetchData(false)} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${tab === key ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {tab === "feed" && (
            <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests…" style={{ width: "100%", padding: "8px 10px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.SUBTLE, outline: "none", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {categories.map((c) => (
                  <button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 14, background: category === c ? `${t.ACCENT}14` : "transparent", border: `1px solid ${category === c ? t.ACCENT + "50" : t.BORDER_HI}`, color: category === c ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{c}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        {content}
      </div>
    );
}
