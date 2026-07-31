"use client";

import { MessageSquare } from "lucide-react";
import { StreamChatPanel } from "../shared/stream-chat-panel";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTransportTokens, type ChatCreds, type TripRequest } from "./tt-shared";

function ChatEmpty({ onBook }: { onBook: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: t.FAINT }}>
      <MessageSquare size={32} style={{ color: t.ACCENT_TINT_BORDER }} />
      <div style={{ fontSize: 14, color: t.SUBTLE }}>No trips to chat about yet.</div>
      <button type="button" onClick={onBook} style={{ padding: "10px 20px", borderRadius: 10, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Book a Ride
      </button>
    </div>
  );
}

function ChatPane({ selected, creds, loading, error }: { selected: TripRequest | null; creds: ChatCreds | null; loading: boolean; error: string | null }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  if (!selected) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: t.FAINT, fontSize: 14 }}>Select a trip to chat</div>;
  }
  // An open/pending trip has no driver yet, so there is no one to chat with — fetching chat
  // credentials will always fail. Show a calm waiting state instead of a red error.
  const awaitingDriver = /open|pending|request|search|form|wait/i.test(selected.status ?? "");
  if (awaitingDriver) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: t.SUBTLE, fontSize: 14, padding: 24, textAlign: "center" }}>
        <MessageSquare size={28} style={{ color: t.ACCENT_TINT_BORDER }} />
        <div>Direct Line opens once a driver accepts your trip.</div>
        <div style={{ fontSize: 13, color: t.MUTED }}>We&apos;ll bring you here when you&apos;re matched.</div>
      </div>
    );
  }
  if (loading) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: t.MUTED, fontSize: 14 }}>Loading chat…</div>;
  }
  if (error) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14, padding: 24, textAlign: "center" }}>{error}</div>;
  }
  if (creds?.streamChannelId) {
    return (
      <StreamChatPanel
        streamApiKey={creds.streamApiKey}
        streamToken={creds.streamToken}
        streamUserId={creds.streamUserId}
        streamChannelId={creds.streamChannelId}
        accentColor={t.ACCENT}
      />
    );
  }
  return null;
}

// A trip's list label: the pickup → drop-off route when either endpoint is known, otherwise the
// trip's own title (falling back to "Your trip").
function tripLabel(r: TripRequest): string {
  const from = r.pickupCity ?? r.fromLocation;
  const to = r.dropoffCity ?? r.toLocation;
  if (from || to) {
    return `${from ?? "—"} → ${to ?? "—"}`;
  }
  return r.title?.trim() || "Your trip";
}

// One selectable trip in the left rail. `active` is computed by the parent so this stays simple.
function TripListItem({ r, active, onSelect }: { r: TripRequest; active: boolean; onSelect: (r: TripRequest) => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <button type="button" onClick={() => onSelect(r)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: active ? `${t.ACCENT}18` : "transparent", border: active ? `1px solid ${t.ACCENT}30` : "1px solid transparent", marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.TEXT }}>{tripLabel(r)}</div>
      <div style={{ fontSize: 11, color: t.MUTED }}>{r.status ?? "Pending"}</div>
    </button>
  );
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
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  if (requests.length === 0) {
    return <div style={{ flex: 1, display: "flex", minHeight: 0 }}><ChatEmpty onBook={onBook} /></div>;
  }
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div style={{ width: 220, borderRight: `1px solid ${t.BORDER}`, padding: "12px 8px", overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.FAINT, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>My Trips</div>
        {requests.map((r) => (
          <TripListItem key={r.id} r={r} active={selectedRequest?.id === r.id} onSelect={onSelect} />
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ChatPane selected={selectedRequest} creds={chatCredentials} loading={chatLoading} error={chatError} />
      </div>
    </div>
  );
}
