"use client";

import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BG, deriveRideTypes, type ChatCreds, type Mode, type Tab, type TripRequest } from "./tt-shared";
import { TrustTransportLoading } from "./tt-loading";
import { TrustTransportIconRail } from "./tt-icon-rail";
import { TrustTransportSidebar } from "./tt-sidebar";
import { TrustTransportBookTab } from "./tt-book-tab";
import { TrustTransportTrackingTab } from "./tt-tracking-tab";
import { TrustTransportChatTab } from "./tt-chat-tab";
import { TrustTransportRightPanel } from "./tt-right-panel";

function ShellHeader() {
  return (
    <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
      <Car size={18} style={{ color: "#F97316" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>TrustTransport</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>Rides · Packages · Food · Safety-first</div>
      </div>
      <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
        Safety-First
      </Badge>
    </header>
  );
}

export function TrustTransportShell() {
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
    if (res.ok) setRequests((await res.json()) as TripRequest[]);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [modesRes] = await Promise.all([fetch("/api/trusttransport/modes"), fetchRequests()]);
        if (modesRes.ok) setModes((await modesRes.json()) as Mode[]);
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
      const data = (await res.json()) as ChatCreds;
      if (!data.ok) throw new Error(data.message ?? "No chat credentials");
      setChatCredentials(data);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      setChatLoading(false);
    }
  }

  function openChat(req: TripRequest) {
    setTab("chat");
    void fetchChatForRequest(req);
  }

  if (loading) return <TrustTransportLoading />;
  if (error) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  const rideTypes = deriveRideTypes(modes);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <TrustTransportIconRail tab={tab} onTab={setTab} />
      <TrustTransportSidebar rideTypes={rideTypes} rideType={rideType} onRideType={setRideType} requests={requests} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ShellHeader />
        {tab === "book" && (
          <TrustTransportBookTab
            rideTypes={rideTypes}
            rideType={rideType}
            onRideType={setRideType}
            from={from}
            to={to}
            onFrom={setFrom}
            onTo={setTo}
            bookingError={bookingError}
            booked={booked}
            submitting={submitting}
            onBook={() => void handleBook()}
            onReset={() => { setBooked(false); setFrom(""); setTo(""); }}
          />
        )}
        {tab === "tracking" && (
          <TrustTransportTrackingTab requests={requests} onBook={() => setTab("book")} onChat={openChat} />
        )}
        {tab === "chat" && (
          <TrustTransportChatTab
            requests={requests}
            selectedRequest={selectedRequest}
            chatCredentials={chatCredentials}
            chatLoading={chatLoading}
            chatError={chatError}
            onSelect={(r) => void fetchChatForRequest(r)}
            onBook={() => setTab("book")}
          />
        )}
      </div>
      <TrustTransportRightPanel requestCount={requests.length} modeCount={modes.length || rideTypes.length} onBook={() => setTab("book")} />
    </div>
  );
}
