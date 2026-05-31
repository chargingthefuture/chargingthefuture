"use client";

import { MessageSquare } from "lucide-react";
import { StreamChatPanel } from "../shared/stream-chat-panel";
import { COLOR, type ChatCreds, type TripRequest } from "./tt-shared";

function ChatEmpty({ onBook }: { onBook: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#4B5563" }}>
      <MessageSquare size={32} style={{ color: "rgba(249,115,22,0.3)" }} />
      <div style={{ fontSize: 14, color: "#9CA3AF" }}>No trips to chat about yet.</div>
      <button type="button" onClick={onBook} style={{ padding: "10px 20px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Book a Ride
      </button>
    </div>
  );
}

function ChatPane({ selected, creds, loading, error }: { selected: TripRequest | null; creds: ChatCreds | null; loading: boolean; error: string | null }) {
  if (!selected) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4B5563", fontSize: 14 }}>Select a trip to chat</div>;
  }
  if (loading) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontSize: 14 }}>Loading chat…</div>;
  }
  if (error) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14, padding: 24, textAlign: "center" }}>{error}</div>;
  }
  if (creds) {
    return (
      <StreamChatPanel
        streamApiKey={creds.streamApiKey}
        streamToken={creds.streamToken}
        streamUserId={creds.streamUserId}
        streamChannelId={creds.streamChannelId ?? selected.id}
      />
    );
  }
  return null;
}

export function TrustTransportChatTab({
  requests,
  selectedRequest,
  chatCredentials,
  chatLoading,
  chatError,
  onSelect,
  onBook,
}: {
  requests: TripRequest[];
  selectedRequest: TripRequest | null;
  chatCredentials: ChatCreds | null;
  chatLoading: boolean;
  chatError: string | null;
  onSelect: (r: TripRequest) => void;
  onBook: () => void;
}) {
  if (requests.length === 0) {
    return <div style={{ flex: 1, display: "flex", minHeight: 0 }}><ChatEmpty onBook={onBook} /></div>;
  }
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div style={{ width: 220, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>My Trips</div>
        {requests.map((r) => {
          const active = selectedRequest?.id === r.id;
          return (
            <button key={r.id} type="button" onClick={() => onSelect(r)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: active ? `${COLOR}18` : "transparent", border: active ? `1px solid ${COLOR}30` : "1px solid transparent", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>{r.fromLocation ?? "—"} → {r.toLocation ?? "—"}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{r.status ?? "Pending"}</div>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ChatPane selected={selectedRequest} creds={chatCredentials} loading={chatLoading} error={chatError} />
      </div>
    </div>
  );
}
