"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Car, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { AppLoading } from "@/components/shared/app-loading";
import { BG, deriveRideTypes, type ChatCreds, type Mode, type Tab, type TripRequest } from "./tt-shared";
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
  // Tracks the most recently requested chat trip so a slower earlier response
  // can't overwrite the credentials for a trip the user has since switched to.
  const activeChatReqRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

  async function fetchRequests() {
    const res = await fetch("/api/trusttransport/requests");
    if (res.ok) {
      // The API wraps the list as { ok, items, page, ... } — the array is .items,
      // not the top-level body. Reading the body directly made `requests` an
      // object, so requests.map(...) in the tracking/chat tabs threw.
      const data = (await res.json()) as { items?: TripRequest[] };
      setRequests(Array.isArray(data.items) ? data.items : []);
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [modesRes] = await Promise.all([fetch("/api/trusttransport/modes"), fetchRequests()]);
        if (modesRes.ok) {
          // The API returns { ok, modes: string[] } (e.g. ["ride","package","food"]).
          // Reading the body directly made `modes` the wrapper object, so
          // deriveRideTypes(modes) called .map on an object and crashed the page.
          // Pull out .modes and turn the strings into Mode objects.
          const data = (await modesRes.json()) as { modes?: unknown };
          const rawModes: unknown[] = Array.isArray(data.modes) ? data.modes : [];
          setModes(rawModes.map((m) => (typeof m === "string" ? { id: m, name: m } : (m as Mode))));
        }
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
    activeChatReqRef.current = req.id;
    setSelectedRequest(req);
    setChatCredentials(null);
    setChatError(null);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/trusttransport/trips/${req.id}/chat`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to fetch chat credentials");
      const data = (await res.json()) as ChatCreds;
      if (!data.ok) throw new Error(data.message ?? "No chat credentials");
      if (activeChatReqRef.current !== req.id) return;
      setChatCredentials(data);
    } catch (e: unknown) {
      if (activeChatReqRef.current !== req.id) return;
      setChatError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      if (activeChatReqRef.current === req.id) setChatLoading(false);
    }
  }

  function openChat(req: TripRequest) {
    setTab("chat");
    void fetchChatForRequest(req);
  }

  if (loading) return <AppLoading />;
  if (error) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  const rideTypes = deriveRideTypes(modes);

  const content = (
    <>
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
    </>
  );

  if (isMobile) {
    const tabs: { key: Tab; label: string }[] = [
      { key: "book", label: "Book" },
      { key: "tracking", label: "Tracking" },
      { key: "chat", label: "Chat" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0F14", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F97316", textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Car size={18} style={{ color: "#F97316", flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", flex: 1 }}>TrustTransport</span>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? "rgba(249,115,22,0.12)" : "transparent", border: `1px solid ${tab === key ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.08)"}`, color: tab === key ? "#F97316" : "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <TrustTransportIconRail tab={tab} onTab={setTab} />
      <TrustTransportSidebar rideTypes={rideTypes} rideType={rideType} onRideType={setRideType} requests={requests} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ShellHeader />
        {content}
      </div>
      <TrustTransportRightPanel requestCount={requests.length} modeCount={modes.length || rideTypes.length} onBook={() => setTab("book")} />
    </div>
  );
}
