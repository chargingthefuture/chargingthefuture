"use client";

import { badgeMeta, type SkillsHuntAchievement, type SkillsHuntLeaderboardItem } from "./sh-shared";
import { useTheme } from '@/hooks/useTheme';
import { getSkillsHuntTokens } from './sh-shared';

function ScoutStats({ entry }: { entry: SkillsHuntLeaderboardItem }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const cells = [
    { l: "Accepted", v: String(entry.acceptedCount) },
    { l: "Pending ⏳", v: String(entry.pendingPoints) },
    { l: "Rank", v: `#${entry.rank}` },
  ];
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>Your Scout Stats</div>
      <div style={{ padding: "16px", borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20`, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {cells.map(({ l, v }) => (
            <div key={l} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 10, background: t.INPUT_BG }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.ACCENT }}>{v}</div>
              <div style={{ fontSize: 10, color: t.MUTED }}>{l}</div>
            </div>
          ))}
        </div>
        {entry.rareSkillBonus > 0 && <div style={{ fontSize: 12, color: t.MUTED }}>💎 {entry.rareSkillBonus} rare skill pts</div>}
      </div>
    </>
  );
}

export function SkillsHuntRightPanel({
  currentUserEntry,
  achievements,
  showModeratorTools,
}: {
  currentUserEntry: SkillsHuntLeaderboardItem | null;
  achievements: SkillsHuntAchievement[];
  showModeratorTools: boolean;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: t.HEADER, padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
      {currentUserEntry ? (
        <ScoutStats entry={currentUserEntry} />
      ) : (
        <div style={{ padding: "16px", borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20`, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ACCENT, marginBottom: 4 }}>Start scouting</div>
          <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>Nominate your first survivor to appear on the leaderboard.</div>
        </div>
      )}

      {achievements.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 10 }}>Badges Earned</div>
          {achievements.map((a) => {
            const meta = badgeMeta(a.code, a.description);
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}15`, marginBottom: 6 }}>
                <div style={{ fontSize: 20 }}>{meta.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: t.TEXT }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: t.FAINT }}>{meta.desc}</div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {showModeratorTools && (
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, marginBottom: 8 }}>Moderator Tools</div>
          <a href="/admin/skills-hunt" style={{ display: "block", padding: "8px 12px", borderRadius: 8, background: `${t.ACCENT}10`, border: `1px solid ${t.ACCENT}25`, color: t.ACCENT, fontSize: 12, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
            Admin Panel →
          </a>
        </div>
      )}
    </aside>
  );
}
