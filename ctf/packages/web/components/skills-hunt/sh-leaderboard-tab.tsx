"use client";

import { initials, rankColor, rankDisplay, type SkillsHuntLeaderboardItem, type SkillsHuntLeaderboardMode } from "./sh-shared";
import { useTheme } from '@/hooks/useTheme';
import { getSkillsHuntTokens } from './sh-shared';

// Team rows aggregate by claimed profession, so the display name is the team key, not a username.
function entryDisplayName(entry: SkillsHuntLeaderboardItem): string {
  if (entry.teamKey) {
    return entry.teamKey.charAt(0).toUpperCase() + entry.teamKey.slice(1);
  }
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

function ModeToggle({ mode, onModeChange }: { mode: SkillsHuntLeaderboardMode; onModeChange: (mode: SkillsHuntLeaderboardMode) => void }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const options: Array<{ value: SkillsHuntLeaderboardMode; label: string }> = [
    { value: "individual", label: "Scouts" },
    { value: "team", label: "Teams" },
  ];
  return (
    <div role="tablist" aria-label="Leaderboard view" style={{ display: "inline-flex", gap: 6, marginBottom: 16 }}>
      {options.map((option) => {
        const active = option.value === mode;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onModeChange(option.value)}
            style={{
              padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: active ? `${t.ACCENT}20` : "transparent",
              border: `1px solid ${active ? t.ACCENT + "60" : t.BORDER}`,
              color: active ? t.ACCENT : t.MUTED,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SkillsHuntLeaderboardTab({
  loading,
  leaderboard,
  mode,
  onModeChange,
  userId,
}: {
  loading: boolean;
  leaderboard: SkillsHuntLeaderboardItem[];
  mode: SkillsHuntLeaderboardMode;
  onModeChange: (mode: SkillsHuntLeaderboardMode) => void;
  userId?: string;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const isTeam = mode === "team";
  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>{isTeam ? "Team Leaderboard" : "Scout Leaderboard"}</div>
      <div style={{ fontSize: 14, color: t.MUTED, marginBottom: 4 }}>
        {isTeam
          ? "Scores grouped by claimed profession · ranked by accepted points"
          : "Ranked by accepted points · tie-break: first-match count, then earliest submission"}
      </div>
      <div style={{ fontSize: 12, color: t.FAINT, marginBottom: 12 }}>Pending points (⏳) convert to accepted points after admin review.</div>

      <ModeToggle mode={mode} onModeChange={onModeChange} />

      {loading ? (
        <div style={{ fontSize: 14, color: t.MUTED }}>Loading leaderboard…</div>
      ) : leaderboard.length === 0 ? (
        <div style={{ fontSize: 14, color: t.MUTED }}>No entries yet — be the first scout!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leaderboard.map((p) => <LeaderboardRow key={p.rank} entry={p} isMe={!isTeam && p.userId === userId} />)}
        </div>
      )}
    </>
  );
}
