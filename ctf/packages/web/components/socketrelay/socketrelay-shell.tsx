"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Share2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import {
  BG,
  deriveCategories,
  getSocketRelayTokens,
  type SrChatCredentials,
  type SrFulfillment,
  type SrFulfillmentsResponse,
  type SrListResponse,
  type SrRequest,
  type Tab,
} from "./sr-shared";
import { SocketRelayLoading } from "./sr-loading";
import { SocketRelayIconRail } from "./sr-icon-rail";
import { SocketRelaySidebar } from "./sr-sidebar";
import { SocketRelayFeed } from "./sr-feed";
import { SocketRelayPost, type PostDraft } from "./sr-post";
import { SocketRelayChat } from "./sr-chat";
import { SocketRelayRightPanel } from "./sr-right-panel";

const EMPTY_DRAFT: PostDraft = { title: "", details: "", category: "", city: "", isPublic: false };

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// Load all three feed datasets at once, normalizing missing payloads to empties.
// Kept out of the component so the loader stays within the rule-116 complexity limit.
async function loadSocketRelayData(): Promise<{ requests: SrRequest[]; myRequestCount: number; fulfillments: SrFulfillment[] }> {
  const [reqData, myReqData, fulData] = await Promise.all([
    getJson<SrListResponse>("/api/socketrelay/requests"),
    getJson<SrListResponse>("/api/socketrelay/my-requests"),
    getJson<SrFulfillmentsResponse>("/api/socketrelay/my-fulfillments"),
  ]);
  return {
    requests: reqData?.items ?? [],
    myRequestCount: myReqData?.total ?? 0,
    fulfillments: fulData?.items ?? [],
  };
}

type SocketRelayShellProps = {
  userId?: string;
  isAdmin?: boolean;
  role?: string | null;
};

export function SocketRelayShell({ userId }: SocketRelayShellProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<SrRequest[]>([]);
  const [myRequestCount, setMyRequestCount] = useState(0);
  const [fulfillments, setFulfillments] = useState<SrFulfillment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("feed");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<PostDraft>(EMPTY_DRAFT);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);
  const [selectedFulfillment, setSelectedFulfillment] = useState<SrFulfillment | null>(null);
  const [chatCredentials, setChatCredentials] = useState<SrChatCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await loadSocketRelayData();
      setRequests(data.requests);
      setMyRequestCount(data.myRequestCount);
      setFulfillments(data.fulfillments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load SocketRelay.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handlePost() {
    if (!draft.title.trim() || !draft.details.trim() || !draft.category.trim()) {
      setPostError("Title, details, and a tag are required.");
      return;
    }
    setSubmitting(true);
    setPostError(null);
    setPostSuccess(false);
    try {
      const res = await fetch("/api/socketrelay/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          title: draft.title.trim(),
          details: draft.details.trim(),
          category: draft.category.trim(),
          city: draft.city.trim() ? draft.city.trim() : null,
          isPublic: draft.isPublic,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to create request.");
      }
      setDraft(EMPTY_DRAFT);
      setPostSuccess(true);
      await fetchData(false);
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed to create request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaim(requestId: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/socketrelay/requests/${requestId}/fulfill`, {
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

  async function openFulfillmentChat(fulfillment: SrFulfillment) {
    setSelectedFulfillment(fulfillment);
    setChatCredentials(null);
    setChatError(null);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/socketrelay/fulfillments/${fulfillment.id}/chat`, {
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

  if (loading) return <SocketRelayLoading />;
  if (error) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  const openCount = requests.filter((r) => r.status === "open").length;
  const categories = deriveCategories(requests, category);
  const visible = requests.filter((r) => {
    if (category !== "All" && r.category.trim().toLowerCase() !== category.toLowerCase()) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!`${r.title} ${r.details} ${r.city ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const content = (
    <>
      {tab === "feed" && (
        <SocketRelayFeed
          requests={visible}
          currentUserId={userId}
          submitting={submitting}
          onClaim={(id) => void handleClaim(id)}
          onPost={() => setTab("post")}
        />
      )}
      {tab === "post" && (
        <SocketRelayPost
          draft={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          submitting={submitting}
          error={postError}
          success={postSuccess}
          onSubmit={() => void handlePost()}
        />
      )}
      {tab === "chat" && (
        <SocketRelayChat
          fulfillments={fulfillments}
          selected={selectedFulfillment}
          onSelect={(f) => void openFulfillmentChat(f)}
          chatLoading={chatLoading}
          chatError={chatError}
          chatCredentials={chatCredentials}
        />
      )}
    </>
  );

  if (isMobile) {
    const tabs: { key: Tab; label: string }[] = [
      { key: "feed", label: "Feed" },
      { key: "post", label: "Post" },
      { key: "chat", label: "Chat" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Share2 size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TEXT, flex: 1 }}>SocketRelay</span>
            <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>{openCount} open</Badge>
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

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: "flex" }}>
      <SocketRelayIconRail tab={tab} onTab={setTab} />
      <SocketRelaySidebar
        categories={categories}
        category={category}
        onCategory={setCategory}
        search={search}
        onSearch={setSearch}
        openCount={openCount}
        myRequestCount={myRequestCount}
        fulfillmentCount={fulfillments.length}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
          <Share2 size={18} style={{ color: t.ACCENT }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT }}>🔂 SocketRelay — Mutual Aid</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Real-time requests · Privacy-minimized</div>
          </div>
          <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            {openCount} open
          </Badge>
        </header>

        {content}
      </div>

      <SocketRelayRightPanel
        openCount={openCount}
        myRequestCount={myRequestCount}
        fulfillmentCount={fulfillments.length}
        totalCount={requests.length}
        onPost={() => setTab("post")}
      />
    </div>
  );
}
