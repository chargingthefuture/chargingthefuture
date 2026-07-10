"use client";

import { StreamChatPanel } from "../shared/stream-chat-panel";
import { useTheme } from "@/hooks/useTheme";
import { getLighthouseTokens, type ChatCredentials, type Match } from "./shared";

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
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <div style={{ padding: 24, height: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${t.ACCENT}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Direct Line</div>
        <div style={{ fontSize: 14, color: t.SUBTLE }}>Your private line with this match — talk in real time.</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="match-select" style={{ color: t.SUBTLE, fontSize: 14, marginRight: 8 }}>Select Match:</label>
        <select
          id="match-select"
          value={selectedMatch?.id || ""}
          onChange={(e) => onSelectMatch(matches.find((m) => m.id === e.target.value) || null)}
          style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.ACCENT}25`, background: "#181A20", color: t.TEXT, fontSize: 15 }}
        >
          <option value="">-- Select a match --</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>Match {m.id} ({m.status})</option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.01)", borderRadius: 12, border: `1px solid ${t.ACCENT}10`, padding: 16, minHeight: 200 }}>
        {!selectedMatch ? (
          <div style={{ color: t.SUBTLE, textAlign: "center", marginTop: 40 }}>Select a match to start chatting.</div>
        ) : chatLoading ? (
          <div>Loading chat…</div>
        ) : chatError ? (
          <div style={{ color: "#EF4444" }}>{chatError}</div>
        ) : chatCredentials?.streamChannelId ? (
          <StreamChatPanel
            streamApiKey={chatCredentials.streamApiKey}
            streamToken={chatCredentials.streamToken}
            streamUserId={chatCredentials.streamUserId}
            streamChannelId={chatCredentials.streamChannelId}
            accentColor={t.ACCENT}
          />
        ) : null}
      </div>
    </div>
  );
}
