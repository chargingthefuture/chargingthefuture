"use client";

import { COLOR, initials, rankColor, rankDisplay, type SkillsHuntLeaderboardItem } from "./sh-shared";

function LeaderboardRow({ entry, isMe }: { entry: SkillsHuntLeaderboardItem; isMe: boolean }) {
  return (
    <div style={{ padding: "16px 20px", borderRadius: 14, background: isMe ? `${COLOR}12` : "rgba(255,255,255,0.02)", border: `1px solid ${isMe ? COLOR + "40" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: entry.rank <= 3 ? `${rankColor(entry.rank)}20` : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: rankColor(entry.rank), flexShrink: 0 }}>
        {rankDisplay(entry.rank)}
      </div>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${COLOR}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: COLOR, flexShrink: 0 }}>
        {initials(entry.usernameSnapshot ?? "?")}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isMe ? COLOR : "#F9FAFB" }}>
          {entry.usernameSnapshot ?? "Anonymous"}{isMe ? " (You)" : ""}
        </div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>
          {entry.acceptedCount} accepted · {entry.firstMatchCount} first-match{entry.firstMatchCount !== 1 ? "es" : ""}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{entry.score} pts</div>
        {entry.pendingPoints > 0 && <div style={{ fontSize: 11, color: "#F59E0B" }}>+{entry.pendingPoints} ⏳ pending</div>}
      </div>
    </div>
  );
}

export function SkillsHuntLeaderboardTab({
  loading,
  leaderboard,
  userId,
}: {
  loading: boolean;
  leaderboard: SkillsHuntLeaderboardItem[];
  userId?: string;
}) {
  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Scout Leaderboard</div>
      <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 4 }}>Ranked by accepted points · tie-break: first-match count, then earliest submission</div>
      <div style={{ fontSize: 12, color: "#4B5563", marginBottom: 20 }}>Pending points (⏳) convert to accepted points after admin review.</div>

      {loading ? (
        <div style={{ fontSize: 14, color: "#6B7280" }}>Loading leaderboard…</div>
      ) : leaderboard.length === 0 ? (
        <div style={{ fontSize: 14, color: "#6B7280" }}>No entries yet — be the first scout!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leaderboard.map((p) => <LeaderboardRow key={p.rank} entry={p} isMe={p.userId === userId} />)}
        </div>
      )}
    </>
  );
}
