"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Send } from "lucide-react";
import { COLOR, initials, type Message, type Room } from "./pp-shared";

function MessageRow({ msg }: { msg: Message }) {
  const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, color: COLOR, fontWeight: 700 }}>
        {initials(msg.author || "?")}
      </div>
      <div style={{ maxWidth: "70%" }}>
        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>{msg.author || "Anonymous"} · {time}</div>
        <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, lineHeight: 1.6, color: "#E8EAF0" }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

export function PeerProgrammingChatTab({
  room,
  messages,
  messageInput,
  onMessageInput,
  onSend,
  submitting,
}: {
  room: Room | null;
  messages: Message[];
  messageInput: string;
  onMessageInput: (v: string) => void;
  onSend: () => void;
  submitting: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const hasCohort = Boolean(room?.cohortId);
  const canSend = messageInput.trim().length > 0 && !submitting;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9CA3AF", marginTop: 40 }}>
            <MessageSquare size={32} style={{ color: COLOR, opacity: 0.5, display: "block", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 15 }}>No messages yet. Start the conversation!</div>
          </div>
        ) : (
          messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
        )}
        <div ref={endRef} />
      </div>
      {!hasCohort ? (
        <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", textAlign: "center", color: "#6B7280", fontSize: 13 }}>
          Join a cohort to participate in chat
        </div>
      ) : (
        <div style={{ padding: "8px 24px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}>
            <input
              value={messageInput}
              onChange={(e) => onMessageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder="Message your cohort…"
              disabled={submitting}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }}
            />
            <button type="button" aria-label="Send" onClick={onSend} disabled={!canSend} style={{ width: 32, height: 32, borderRadius: 8, background: canSend ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: canSend ? "pointer" : "not-allowed" }}>
              <Send size={14} style={{ color: canSend ? "#fff" : "#4B5563" }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
