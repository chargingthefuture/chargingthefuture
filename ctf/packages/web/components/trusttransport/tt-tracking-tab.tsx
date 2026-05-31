"use client";

import { Car, Navigation, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { COLOR, type TripRequest } from "./tt-shared";

function statusBadgeStyle(status: string) {
  const s = status.toLowerCase();
  if (s.includes("cancel")) return { background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" };
  if (s.includes("complet")) return { background: "#A855F720", color: "#A855F7", border: "1px solid #A855F740" };
  if (s.includes("pend") || s.includes("form") || s.includes("wait")) return { background: "#F59E0B20", color: "#F59E0B", border: "1px solid #F59E0B40" };
  return { background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E40" };
}

function TrackingEmpty({ onBook }: { onBook: () => void }) {
  return (
    <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Navigation size={20} style={{ color: "rgba(249,115,22,0.4)" }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No active trips</div>
      <div style={{ fontSize: 13, color: "#4B5563" }}>Book a ride to see live tracking here.</div>
      <button type="button" onClick={onBook} style={{ padding: "10px 20px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Book a Ride
      </button>
    </div>
  );
}

function TrackingCard({ request, onChat }: { request: TripRequest; onChat: (r: TripRequest) => void }) {
  const route = `${request.fromLocation ?? "—"} → ${request.toLocation ?? "—"}`;
  const status = request.status ?? "Pending";
  return (
    <div style={{ padding: "24px", borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}30`, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${COLOR}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Car size={24} style={{ color: COLOR }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>{route}</div>
        <Badge style={{ ...statusBadgeStyle(status), fontSize: 12, marginLeft: "auto" }}>{status}</Badge>
      </div>
      <div style={{ padding: "48px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", color: "#4B5563", fontSize: 13, marginBottom: 16 }}>
        Live map — tracking in progress
      </div>
      <button type="button" onClick={() => onChat(request)} style={{ width: "100%", padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <MessageSquare size={14} /> Chat
      </button>
    </div>
  );
}

export function TrustTransportTrackingTab({
  requests,
  onBook,
  onChat,
}: {
  requests: TripRequest[];
  onBook: () => void;
  onChat: (r: TripRequest) => void;
}) {
  return (
    <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 20 }}>Live Tracking</div>
      {requests.length === 0
        ? <TrackingEmpty onBook={onBook} />
        : requests.map((r) => <TrackingCard key={r.id} request={r} onChat={onChat} />)}
    </div>
  );
}
