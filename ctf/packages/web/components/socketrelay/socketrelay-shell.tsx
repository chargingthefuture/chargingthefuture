"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Share2 } from "lucide-react";
import {
  BG,
  COLOR,
  SUBTLE,
  TEXT,
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

  const fetchData = useCallback(async (options?: { showLoading?: boolean }) => {
    if (options?.showLoading !== false) setLoading(true);
    setError(null);
    try {
      const [reqData, myReqData, fulData] = await Promise.all([
        getJson<SrListResponse>("/api/socketrelay/requests"),
        getJson<SrListResponse>("/api/socketrelay/my-requests"),
        getJson<SrFulfillmentsResponse>("/api/socketrelay/my-fulfillments"),
      ]);
      setRequests(reqData?.items ?? []);
      setMyRequestCount(myReqData?.total ?? 0);
      setFulfillments(fulData?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load SocketRelay.");
    } finally {
      if (options?.showLoading !== false) setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handlePost() {
    if (!draft.title.trim() || !draft.details.trim() || !draft.category.trim()) {
      setPostError("Title, details, and category are required.");
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
      await fetchData({ showLoading: false });
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
      if (res.ok) await fetchData({ showLoading: false });
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
  const visible = requests.filter((r) => {
    if (category !== "All" && r.category !== category) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!`${r.title} ${r.details} ${r.city ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, display: "flex" }}>
      <SocketRelayIconRail tab={tab} onTab={setTab} />
      <SocketRelaySidebar
        category={category}
        onCategory={setCategory}
        search={search}
        onSearch={setSearch}
        openCount={openCount}
        myRequestCount={myRequestCount}
        fulfillmentCount={fulfillments.length}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Share2 size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>🔂 SocketRelay — Mutual Aid</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Real-time requests · Privacy-minimized</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            {openCount} open
          </Badge>
        </header>

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
