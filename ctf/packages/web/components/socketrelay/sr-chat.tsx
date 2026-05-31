"use client";

import { MessageSquare } from "lucide-react";
import { StreamChatPanel } from "../shared/stream-chat-panel";
import { COLOR, FAINT, SUBTLE, type SrChatCredentials, type SrFulfillment } from "./sr-shared";

function ChatPane({
  selected,
  chatLoading,
  chatError,
  chatCredentials,
}: {
  selected: SrFulfillment | null;
  chatLoading: boolean;
  chatError: string | null;
  chatCredentials: SrChatCredentials | null;
}) {
  if (!selected) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: FAINT, fontSize: 14 }}>Select a fulfillment to chat</div>;
  if (chatLoading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: SUBTLE, fontSize: 14 }}>Loading chat…</div>;
  if (chatError) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14 }}>{chatError}</div>;
  if (!chatCredentials?.streamApiKey) return null;
  return (
    <StreamChatPanel
      streamApiKey={chatCredentials.streamApiKey}
      streamToken={chatCredentials.streamToken as string}
      streamUserId={chatCredentials.streamUserId as string}
      streamChannelId={chatCredentials.streamChannelId || selected.id}
    />
  );
}

export function SocketRelayChat({
  fulfillments,
  selected,
  onSelect,
  chatLoading,
  chatError,
  chatCredentials,
}: {
  fulfillments: SrFulfillment[];
  selected: SrFulfillment | null;
  onSelect: (fulfillment: SrFulfillment) => void;
  chatLoading: boolean;
  chatError: string | null;
  chatCredentials: SrChatCredentials | null;
}) {
  if (fulfillments.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px dashed ${COLOR}4D`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageSquare size={20} style={{ color: `${COLOR}66` }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No active fulfillments</div>
        <div style={{ fontSize: 13, color: FAINT, textAlign: "center" }}>When you help someone or receive help, chat channels appear here.</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div style={{ width: 220, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>My Fulfillments</div>
        {fulfillments.map((f) => (
          <div key={f.id} onClick={() => onSelect(f)} style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: selected?.id === f.id ? `${COLOR}18` : "transparent", border: selected?.id === f.id ? `1px solid ${COLOR}30` : "1px solid transparent", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>Fulfillment {f.id.slice(0, 8)}</div>
            <div style={{ fontSize: 11, color: SUBTLE, textTransform: "capitalize" }}>{f.status}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ChatPane selected={selected} chatLoading={chatLoading} chatError={chatError} chatCredentials={chatCredentials} />
      </div>
    </div>
  );
}
