"use client";

import { StreamChatPanel } from "../shared/stream-chat-panel";
import { COLOR, type ChatCredentials, type Match } from "./shared";

export function LighthouseChat({
  matches,
  selectedMatch,
  onSelectMatch,
  chatLoading,
  chatError,
  chatCredentials,
}: {
  matches: Match[];
  selectedMatch: Match | null;
  onSelectMatch: (match: Match | null) => void;
  chatLoading: boolean;
  chatError: string | null;
  chatCredentials: ChatCredentials | null;
}) {
  return (
    <div style={{ padding: 24, height: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>LightHouse Chat</div>
        <div style={{ fontSize: 14, color: "#9CA3AF" }}>Connect with your match in real time.</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="match-select" style={{ color: "#9CA3AF", fontSize: 14, marginRight: 8 }}>Select Match:</label>
        <select
          id="match-select"
          value={selectedMatch?.id || ""}
          onChange={(e) => onSelectMatch(matches.find((m) => m.id === e.target.value) || null)}
          style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${COLOR}25`, background: "#181A20", color: "#E8EAF0", fontSize: 15 }}
        >
          <option value="">-- Select a match --</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>Match {m.id} ({m.status})</option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.01)", borderRadius: 12, border: `1px solid ${COLOR}10`, padding: 16, minHeight: 200 }}>
        {!selectedMatch ? (
          <div style={{ color: "#9CA3AF", textAlign: "center", marginTop: 40 }}>Select a match to start chatting.</div>
        ) : chatLoading ? (
          <div>Loading chat…</div>
        ) : chatError ? (
          <div style={{ color: "#EF4444" }}>{chatError}</div>
        ) : chatCredentials ? (
          <StreamChatPanel
            streamApiKey={chatCredentials.streamApiKey}
            streamToken={chatCredentials.streamToken}
            streamUserId={chatCredentials.streamUserId}
            streamChannelId={chatCredentials.streamChannelId || selectedMatch.id}
          />
        ) : null}
      </div>
    </div>
  );
}
