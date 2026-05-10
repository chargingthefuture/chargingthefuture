"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StreamChatPanel } from "../shared/stream-chat-panel";
import {
  Car, Shield, Bell, Settings, MessageSquare, Navigation,
  CheckCircle, Phone, Zap, AlertCircle, ArrowUpRight, Package, Utensils,
} from "lucide-react";

const COLOR = "#F97316";

interface Mode {
  id: string;
  name: string;
}

interface TripRequest {
  id: string;
  mode?: string;
  fromLocation?: string;
  toLocation?: string;
  status?: string;
  createdAt?: string;
}

interface ChatCreds {
  ok: boolean;
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId?: string;
  message?: string;
}

type Tab = "book" | "tracking" | "chat";

const STATIC_RIDE_TYPES = [
  { id: "ride", name: "Ride", icon: Car, desc: "Safe passenger transport", color: COLOR },
  { id: "package", name: "Package", icon: Package, desc: "Item delivery", color: "#3B82F6" },
  { id: "food", name: "Food", icon: Utensils, desc: "Meal delivery", color: "#22C55E" },
];

const TABS: { icon: React.ElementType; key: Tab }[] = [
  { icon: Car, key: "book" },
  { icon: Navigation, key: "tracking" },
  { icon: MessageSquare, key: "chat" },
];

export function TrustTransportShell(_props: { userId?: string; isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modes, setModes] = useState<Mode[]>([]);
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("book");
  const [rideType, setRideType] = useState("ride");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TripRequest | null>(null);
  const [chatCredentials, setChatCredentials] = useState<ChatCreds | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  async function fetchRequests() {
    const res = await fetch("/api/trusttransport/requests");
    if (res.ok) setRequests(await res.json() as TripRequest[]);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [modesRes] = await Promise.all([
          fetch("/api/trusttransport/modes"),
          fetchRequests(),
        ]);
        if (modesRes.ok) setModes(await modesRes.json() as Mode[]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load TrustTransport.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, []);

  async function handleBook() {
    if (!from.trim() || !to.trim()) { setBookingError("Please enter pickup and destination."); return; }
    setSubmitting(true);
    setBookingError(null);
    try {
      const res = await fetch("/api/trusttransport/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: rideType, fromLocation: from, toLocation: to }),
      });
      if (!res.ok) throw new Error("Failed to create request");
      setBooked(true);
      await fetchRequests();
    } catch (e: unknown) {
      setBookingError(e instanceof Error ? e.message : "Failed to book.");
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchChatForRequest(req: TripRequest) {
    setSelectedRequest(req);
    setChatCredentials(null);
    setChatError(null);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/trusttransport/trips/${req.id}/chat`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to fetch chat credentials");
      const data = await res.json() as ChatCreds;
      if (!data.ok) throw new Error(data.message ?? "No chat credentials");
      setChatCredentials(data);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      setChatLoading(false);
    }
  }

  const rideTypes = modes.length > 0
    ? modes.map((m) => {
        const match = STATIC_RIDE_TYPES.find((rt) => rt.id === m.id || rt.name.toLowerCase() === m.name.toLowerCase());
        return match ?? { id: m.id, name: m.name, icon: Car, desc: m.name, color: COLOR };
      })
    : STATIC_RIDE_TYPES;

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#6B7280" }}>
        Loading TrustTransport…
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
          <Car size={20} style={{ color: COLOR }} />
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>TrustTransport</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {rideTypes.map((rt) => {
              const Icon = rt.icon;
              return (
                <button key={rt.id} onClick={() => setRideType(rt.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, background: rideType === rt.id ? `${rt.color}20` : "rgba(255,255,255,0.04)", border: `1px solid ${rideType === rt.id ? rt.color + "50" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "center" }}>
                  <Icon size={16} style={{ color: rideType === rt.id ? rt.color : "#6B7280", margin: "0 auto 2px" }} />
                  <div style={{ fontSize: 10, color: rideType === rt.id ? rt.color : "#6B7280", fontWeight: 600 }}>{rt.name}</div>
                </button>
              );
            })}
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: "12px 8px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 8, padding: "0 10px" }}>My Trips</div>
            {requests.length === 0 ? (
              <div style={{ padding: "10px", fontSize: 12, color: "#4B5563", textAlign: "center" }}>No trips yet</div>
            ) : (
              requests.slice(0, 3).map((r) => (
                <div key={r.id} style={{ padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "#E8EAF0", fontWeight: 600, marginBottom: 2 }}>
                    {r.fromLocation ?? "—"} → {r.toLocation ?? "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "#4B5563" }}>{r.status ?? "Pending"}</div>
                </div>
              ))
            )}
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Quick Stats</div>
            {[{ l: "My Requests", v: String(requests.length) }, { l: "Safety Rating", v: "4.9 ⭐" }].map(({ l, v }) => (
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
          <Car size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>TrustTransport</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Rides · Packages · Food · Safety-first</div>
          </div>
          <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            Safety-First
          </Badge>
          <Badge style={{ background: "rgba(14,165,233,0.12)", color: "#38BDF8", border: "1px solid rgba(14,165,233,0.2)", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            GetStream ⚡
          </Badge>
        </header>

        {tab === "book" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
              <div style={{ padding: "20px 24px", borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>
                  Book a {rideTypes.find((r) => r.id === rideType)?.name ?? "Ride"}
                </div>
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>All drivers background-checked · Trauma-informed · Service Credits accepted</div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {rideTypes.map((rt) => {
                  const Icon = rt.icon;
                  return (
                    <button key={rt.id} onClick={() => setRideType(rt.id)} style={{ flex: 1, padding: "16px 12px", borderRadius: 14, background: rideType === rt.id ? `${rt.color}15` : "rgba(255,255,255,0.02)", border: `2px solid ${rideType === rt.id ? rt.color : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "center" }}>
                      <Icon size={24} style={{ color: rideType === rt.id ? rt.color : "#6B7280", marginBottom: 8 }} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: rideType === rt.id ? rt.color : "#6B7280" }}>{rt.name}</div>
                      <div style={{ fontSize: 11, color: "#4B5563" }}>{rt.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
                  <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Pickup location (privacy-protected)" style={{ width: "100%", padding: "14px 16px 14px 36px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: COLOR }} />
                  <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Where to?" style={{ width: "100%", padding: "14px 16px 14px 36px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              {bookingError && <div style={{ fontSize: 13, color: "#EF4444" }}>{bookingError}</div>}

              {booked ? (
                <div style={{ padding: "20px 24px", borderRadius: 16, background: "#22C55E10", border: "1px solid #22C55E30" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircle size={20} style={{ color: "#22C55E" }} />
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#22C55E" }}>Request submitted!</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6 }}>Your request is being matched with nearby drivers. All comms via GetStream.</div>
                  <button onClick={() => { setBooked(false); setFrom(""); setTo(""); }} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 13, cursor: "pointer" }}>
                    Book Another
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { void handleBook(); }}
                  disabled={submitting}
                  style={{ padding: "16px", borderRadius: 14, background: submitting ? "rgba(249,115,22,0.4)" : COLOR, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Booking…" : `Book ${rideTypes.find((r) => r.id === rideType)?.name ?? "Ride"}`}
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "tracking" && (
          <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 20 }}>Live Tracking</div>
            {requests.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Navigation size={20} style={{ color: "rgba(249,115,22,0.4)" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No active trips</div>
                <div style={{ fontSize: 13, color: "#4B5563" }}>Book a ride to see live tracking here.</div>
                <button onClick={() => setTab("book")} style={{ padding: "10px 20px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Book a Ride
                </button>
              </div>
            ) : (
              requests.map((r) => (
                <div key={r.id} style={{ padding: "24px", borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}30`, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${COLOR}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Car size={24} style={{ color: COLOR }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>
                        {r.fromLocation ?? "—"} → {r.toLocation ?? "—"}
                      </div>
                      <div style={{ fontSize: 13, color: "#9CA3AF" }}>{r.status ?? "Pending"}</div>
                    </div>
                    <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E40", fontSize: 12, marginLeft: "auto" }}>
                      {r.status ?? "Pending"}
                    </Badge>
                  </div>
                  <div style={{ padding: "48px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", color: "#4B5563", fontSize: 13, marginBottom: 16 }}>
                    Live map — tracking in progress
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setSelectedRequest(r); setTab("chat"); void fetchChatForRequest(r); }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <MessageSquare size={14} /> Chat
                    </button>
                    <button style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <AlertCircle size={14} /> Safety Alert
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "chat" && (
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            {requests.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#4B5563" }}>
                <MessageSquare size={32} style={{ color: "rgba(249,115,22,0.3)" }} />
                <div style={{ fontSize: 14, color: "#9CA3AF" }}>No trips to chat about yet.</div>
                <button onClick={() => setTab("book")} style={{ padding: "10px 20px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Book a Ride
                </button>
              </div>
            ) : (
              <>
                <div style={{ width: 220, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", overflowY: "auto" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>My Trips</div>
                  {requests.map((r) => (
                    <div key={r.id} onClick={() => { void fetchChatForRequest(r); }} style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: selectedRequest?.id === r.id ? `${COLOR}18` : "transparent", border: selectedRequest?.id === r.id ? `1px solid ${COLOR}30` : "1px solid transparent", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>{r.fromLocation ?? "—"} → {r.toLocation ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{r.status ?? "Pending"}</div>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  {!selectedRequest && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4B5563", fontSize: 14 }}>
                      Select a trip to chat
                    </div>
                  )}
                  {selectedRequest && chatLoading && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontSize: 14 }}>Loading chat…</div>
                  )}
                  {selectedRequest && chatError && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14, padding: 24, textAlign: "center" }}>{chatError}</div>
                  )}
                  {selectedRequest && chatCredentials && (
                    <StreamChatPanel
                      streamApiKey={chatCredentials.streamApiKey}
                      streamToken={chatCredentials.streamToken}
                      streamUserId={chatCredentials.streamUserId}
                      streamChannelId={chatCredentials.streamChannelId ?? selectedRequest.id}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Safety Features</div>
        {[
          { icon: Shield, l: "Background Checked", v: "All drivers", c: "#22C55E" },
          { icon: Phone, l: "Emergency SOS", v: "One-tap alert", c: "#EF4444" },
          { icon: CheckCircle, l: "Identity Verified", v: "Photo ID required", c: COLOR },
          { icon: Zap, l: "Real-time Tracking", v: "GetStream powered", c: "#38BDF8" },
        ].map(({ icon: Icon, l, v, c }) => (
          <div key={l} style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px", borderRadius: 10, background: `${c}08`, border: `1px solid ${c}20`, marginBottom: 8 }}>
            <Icon size={16} style={{ color: c, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>{l}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{v}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Platform Stats</div>
          {[
            { l: "My Requests", v: String(requests.length) },
            { l: "Transport Modes", v: String(modes.length || rideTypes.length) },
            { l: "Safety Incidents", v: "0 today" },
          ].map(({ l, v }) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", color: "#6B7280" }}>
              <span>{l}</span>
              <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setTab("book")} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Book a Ride
        </button>
      </aside>
    </div>
  );
}
