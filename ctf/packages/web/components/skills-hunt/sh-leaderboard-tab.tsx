"use client";

import { initials, rankColor, rankDisplay, type SkillsHuntLeaderboardItem } from "./sh-shared";
import { useTheme } from '@/hooks/useTheme';
import { getSkillsHuntTokens } from './sh-shared';

function entryDisplayName(entry: SkillsHuntLeaderboardItem): string {
  return entry.usernameSnapshot ?? "Anonymous";
}

function LeaderboardRow({ entry, isMe }: { entry: SkillsHuntLeaderboardItem; isMe: boolean }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <div style={{ padding: "16px 20px", borderRadius: 14, background: isMe ? `${t.ACCENT}12` : "rgba(255,255,255,0.02)", border: `1px solid ${isMe ? t.ACCENT + "40" : t.BORDER}`, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: entry.rank <= 3 ? `${rankColor(entry.rank)}20` : t.INPUT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: rankColor(entry.rank), flexShrink: 0 }}>
        {rankDisplay(entry.rank)}
      </div>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${t.ACCENT}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: t.ACCENT, flexShrink: 0 }}>
        {initials(entryDisplayName(entry))}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isMe ? t.ACCENT : t.TITLE }}>
          {entryDisplayName(entry)}{isMe ? " (You)" : ""}
        </div>
        <div style={{ fontSize: 12, color: t.MUTED }}>
          {entry.acceptedCount} accepted · {entry.firstMatchCount} first-match{entry.firstMatchCount !== 1 ? "es" : ""}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: t.ACCENT }}>{entry.score} pts</div>
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
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Scout Leaderboard</div>
      <div style={{ fontSize: 14, color: t.MUTED, marginBottom: 4 }}>
        Ranked by accepted points · tie-break: first-match count, then earliest submission
      </div>
      <div style={{ fontSize: 12, color: t.FAINT, marginBottom: 12 }}>Pending points (⏳) convert to accepted points after admin review.</div>

      {loading ? (
        <div style={{ fontSize: 14, color: t.MUTED }}>Loading leaderboard…</div>
      ) : leaderboard.length === 0 ? (
        <div style={{ fontSize: 14, color: t.MUTED }}>No entries yet — be the first scout!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leaderboard.map((p) => <LeaderboardRow key={p.rank} entry={p} isMe={p.userId === userId} />)}
        </div>
      )}
    </>
  );
}
