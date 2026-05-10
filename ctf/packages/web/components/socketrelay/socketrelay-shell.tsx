"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StreamChatPanel } from "../shared/stream-chat-panel";
import {
  Share2, Send, Plus, Search, Bell, Settings, MessageSquare,
  AlertCircle, Heart, Shield,
} from "lucide-react";

const COLOR = "#F43F5E";

interface Request {
  id: string;
  type: "need" | "offer";
  description: string;
  category: string;
  location?: string;
  credits?: number;
  urgency?: "urgent" | "normal";
  createdAt: string;
  fulfilledAt?: string | null;
  isAnonymous?: boolean;
}

interface Fulfillment {
  id: string;
  requestId?: string;
}

type Tab = "feed" | "post" | "chat";

const TABS: { icon: React.ElementType; key: Tab }[] = [
  { icon: Share2, key: "feed" },
  { icon: Plus, key: "post" },
  { icon: MessageSquare, key: "chat" },
];

const CATEGORIES = ["All", "Food", "Transport", "Legal", "Employment", "Childcare", "Housing", "Mental Health"];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SocketRelayShell(_props: { userId?: string; isAdmin?: boolean; role?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRequests, setOpenRequests] = useState<Request[]>([]);
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("feed");
  const [category, setCategory] = useState("All");
  const [postType, setPostType] = useState<"need" | "offer">("need");
  const [postDescription, setPostDescription] = useState("");
  const [postCategory, setPostCategory] = useState("");
  const [postLocation, setPostLocation] = useState("");
  const [postCredits, setPostCredits] = useState("");
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);
  const [selectedFulfillment, setSelectedFulfillment] = useState<Fulfillment | null>(null);
  const [chatCredentials, setChatCredentials] = useState<Record<string, unknown> | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  async function fetchData(options?: { showLoading?: boolean }) {
    if (options?.showLoading !== false) setLoading(true);
    setError(null);
    try {
      const [openReqRes, fulfillmentsRes] = await Promise.all([
        fetch("/api/socketrelay/requests"),
        fetch("/api/socketrelay/my-fulfillments"),
      ]);
      if (openReqRes.ok) setOpenRequests(await openReqRes.json() as Request[]);
      if (fulfillmentsRes.ok) setFulfillments(await fulfillmentsRes.json() as Fulfillment[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load SocketRelay.");
    } finally {
      if (options?.showLoading !== false) setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  async function handleCreateRequest() {
    if (!postDescription.trim()) { setPostError("Please describe what you need or offer."); return; }
    setSubmitting(true);
    setPostError(null);
    setPostSuccess(false);
    try {
      const res = await fetch("/api/socketrelay/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: postType,
          description: postDescription,
          category: postCategory || "General",
          location: postLocation,
          credits: postCredits ? Number(postCredits) : 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to create request");
      setPostDescription("");
      setPostCategory("");
      setPostLocation("");
      setPostCredits("");
      setPostSuccess(true);
      void fetchData({ showLoading: false });
    } catch (e: unknown) {
      setPostError(e instanceof Error ? e.message : "Failed to create request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaimFulfillment(id: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/socketrelay/requests/${id}/fulfill`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to claim");
      void fetchData({ showLoading: false });
    } catch {
      // Silent — refresh will show updated state
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchChatCredentials(fulfillment: Fulfillment) {
    setSelectedFulfillment(fulfillment);
    setChatCredentials(null);
    setChatError(null);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/socketrelay/fulfillments/${fulfillment.id}/chat`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to fetch chat credentials");
      const data = await res.json() as Record<string, unknown>;
      if (!data.ok) throw new Error(String(data.message ?? "No chat credentials"));
      setChatCredentials(data);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      setChatLoading(false);
    }
  }

  const filtered = openRequests.filter(
    (r) => category === "All" || r.category === category
  );

  const needs = openRequests.filter((r) => r.type === "need").length;
  const offers = openRequests.filter((r) => r.type === "offer").length;

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#6B7280" }}>
        Loading SocketRelay…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Share2 size={20} style={{ color: COLOR }} />
        </div>
        {TABS.map(({ icon: Icon, key }) => (
          <button key={key} onClick={() => setTab(key)} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
          <Bell size={18} />
        </button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
          <Settings size={18} />
        </button>
        <Avatar style={{ width: 36, height: 36 }}>
          <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
        </Avatar>
      </aside>

      {/* Sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>SocketRelay</div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
            <input placeholder="Search requests…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "0 8px 16px" }}>
            {CATEGORIES.map((c) => (
              <div key={c} onClick={() => setCategory(c)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: category === c ? `${COLOR}18` : "transparent", borderLeft: category === c ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: category === c ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{c}</span>
              </div>
            ))}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Live Stats</div>
            {[
              { l: "Open Needs", v: String(needs) },
              { l: "Open Offers", v: String(offers) },
              { l: "My Fulfillments", v: String(fulfillments.length) },
            ].map(({ l, v }) => (
              <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>
                {l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Share2 size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>SocketRelay — Mutual Aid</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Real-time needs ↔ offers · Privacy-minimized</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            {openRequests.length} open
          </Badge>
        </header>

        {tab === "feed" && (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {["All", "Needs 🆘", "Offers 🤝"].map((f) => (
                  <button key={f} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: f === "All" ? `${COLOR}20` : "rgba(255,255,255,0.04)", border: `1px solid ${f === "All" ? COLOR + "40" : "rgba(255,255,255,0.06)"}`, color: f === "All" ? COLOR : "#6B7280", cursor: "pointer" }}>
                    {f}
                  </button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(244,63,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Share2 size={20} style={{ color: "rgba(244,63,94,0.4)" }} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No requests yet</div>
                  <div style={{ fontSize: 13, color: "#4B5563" }}>Be the first to post a need or offer.</div>
                  <button onClick={() => setTab("post")} style={{ padding: "10px 20px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Post Now
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filtered.map((r) => {
                    const fulfilled = !!r.fulfilledAt;
                    return (
                      <div key={r.id} style={{ padding: "18px 20px", borderRadius: 14, background: fulfilled ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)", border: `1px solid ${r.type === "need" ? COLOR + (r.urgency === "urgent" ? "50" : "20") : "#22C55E30"}`, opacity: fulfilled ? 0.5 : 1 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: r.type === "need" ? `${COLOR}20` : "#22C55E20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {r.type === "need" ? <AlertCircle size={18} style={{ color: COLOR }} /> : <Heart size={18} style={{ color: "#22C55E" }} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <Badge style={{ background: r.type === "need" ? `${COLOR}20` : "#22C55E20", color: r.type === "need" ? COLOR : "#22C55E", border: `1px solid ${r.type === "need" ? COLOR + "40" : "#22C55E40"}`, fontSize: 11 }}>
                                {r.type === "need" ? "Need 🆘" : "Offer 🤝"}
                              </Badge>
                              {r.category && (
                                <Badge style={{ background: "rgba(255,255,255,0.04)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11 }}>{r.category}</Badge>
                              )}
                              {r.urgency === "urgent" && (
                                <Badge style={{ background: "#EF444420", color: "#EF4444", border: "1px solid #EF444440", fontSize: 11 }}>⚠ Urgent</Badge>
                              )}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#F9FAFB", marginBottom: 6, lineHeight: 1.4 }}>{r.description}</div>
                            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6B7280", flexWrap: "wrap" }}>
                              {r.isAnonymous === false ? null : <span>Anonymous</span>}
                              {r.location && <span>· {r.location}</span>}
                              <span>· {timeAgo(r.createdAt)}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                            {(r.credits ?? 0) > 0 && (
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B" }}>{r.credits} credits</div>
                            )}
                            {!fulfilled && (
                              <button
                                onClick={() => { void handleClaimFulfillment(r.id); }}
                                disabled={submitting}
                                style={{ padding: "8px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              >
                                {r.type === "need" ? "I can Help" : "Connect"}
                              </button>
                            )}
                            {fulfilled && (
                              <div style={{ fontSize: 12, color: "#22C55E", fontWeight: 600 }}>✓ Fulfilled</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {tab === "post" && (
          <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 20 }}>Post a Request or Offer</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {(["need", "offer"] as const).map((t) => (
                <button key={t} onClick={() => setPostType(t)} style={{ flex: 1, padding: "14px", borderRadius: 12, background: postType === t ? (t === "need" ? `${COLOR}20` : "#22C55E20") : "rgba(255,255,255,0.03)", border: `2px solid ${postType === t ? (t === "need" ? COLOR : "#22C55E") : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{t === "need" ? "🆘" : "🤝"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: postType === t ? (t === "need" ? COLOR : "#22C55E") : "#6B7280" }}>{t === "need" ? "I Need Help" : "I Can Help"}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>What do you need / offer?</div>
                <textarea
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  placeholder="Be specific about what help you need or can give…"
                  rows={3}
                  style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", resize: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Category</div>
                <input value={postCategory} onChange={(e) => setPostCategory(e.target.value)} placeholder="Food, Transport, Legal, Employment…" style={{ width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Location (privacy-protected)</div>
                <input value={postLocation} onChange={(e) => setPostLocation(e.target.value)} placeholder="Neighborhood or city only — never exact address" style={{ width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Service Credits offered/requested</div>
                <input value={postCredits} onChange={(e) => setPostCredits(e.target.value)} type="number" min="0" placeholder="0 if free" style={{ width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
              </div>
              {postError && <div style={{ fontSize: 13, color: "#EF4444" }}>{postError}</div>}
              {postSuccess && <div style={{ fontSize: 13, color: "#22C55E" }}>Posted successfully! View it in the feed.</div>}
              <button
                onClick={() => { void handleCreateRequest(); }}
                disabled={submitting}
                style={{ padding: "14px", borderRadius: 12, background: submitting ? "rgba(244,63,94,0.4)" : (postType === "need" ? COLOR : "#22C55E"), border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                {submitting ? "Posting…" : postType === "need" ? "Post My Need" : "Post My Offer"}
              </button>
            </div>
          </div>
        )}

        {tab === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {fulfillments.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(244,63,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageSquare size={20} style={{ color: "rgba(244,63,94,0.4)" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No active fulfillments</div>
                <div style={{ fontSize: 13, color: "#4B5563", textAlign: "center" }}>When you help someone or receive help, chat channels appear here.</div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
                <div style={{ width: 220, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", overflowY: "auto" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>My Fulfillments</div>
                  {fulfillments.map((f) => (
                    <div key={f.id} onClick={() => { void fetchChatCredentials(f); }} style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: selectedFulfillment?.id === f.id ? `${COLOR}18` : "transparent", border: selectedFulfillment?.id === f.id ? `1px solid ${COLOR}30` : "1px solid transparent", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>Fulfillment {f.id.slice(0, 8)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  {!selectedFulfillment && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4B5563", fontSize: 14 }}>
                      Select a fulfillment to chat
                    </div>
                  )}
                  {selectedFulfillment && chatLoading && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontSize: 14 }}>Loading chat…</div>
                  )}
                  {selectedFulfillment && chatError && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14 }}>{chatError}</div>
                  )}
                  {selectedFulfillment && chatCredentials && (
                    <StreamChatPanel
                      streamApiKey={chatCredentials.streamApiKey as string}
                      streamToken={chatCredentials.streamToken as string}
                      streamUserId={chatCredentials.streamUserId as string}
                      streamChannelId={(chatCredentials.streamChannelId as string) || selectedFulfillment.id}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Impact</div>
        {[
          { l: "Open Needs", v: String(needs), c: COLOR },
          { l: "Open Offers", v: String(offers), c: "#22C55E" },
          { l: "My Fulfillments", v: String(fulfillments.length), c: "#A855F7" },
          { l: "Total Requests", v: String(openRequests.length), c: "#F59E0B" },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ padding: "14px 16px", borderRadius: 12, background: `${c}08`, border: `1px solid ${c}20`, marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{l}</div>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Shield size={12} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Privacy Minimized</span>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Public requests never include identifying information. All connections via encrypted channels.</div>
        </div>
        <button onClick={() => setTab("post")} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Post a Need or Offer
        </button>
      </aside>
    </div>
  );
}
