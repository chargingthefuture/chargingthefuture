"use client";

import { COLOR, badgeMeta, type SkillsHuntAchievement, type SkillsHuntLeaderboardItem } from "./sh-shared";

function ScoutStats({ entry }: { entry: SkillsHuntLeaderboardItem }) {
  const cells = [
    { l: "Accepted", v: String(entry.acceptedCount) },
    { l: "Pending ⏳", v: String(entry.pendingPoints) },
    { l: "Rank", v: `#${entry.rank}` },
  ];
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Your Scout Stats</div>
      <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {cells.map(({ l, v }) => (
            <div key={l} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{v}</div>
              <div style={{ fontSize: 10, color: "#6B7280" }}>{l}</div>
            </div>
          ))}
        </div>
        {entry.rareSkillBonus > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>💎 {entry.rareSkillBonus} rare skill pts</div>}
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
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
      {currentUserEntry ? (
        <ScoutStats entry={currentUserEntry} />
      ) : (
        <div style={{ padding: "16px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLOR, marginBottom: 4 }}>Start scouting</div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>Nominate your first survivor to appear on the leaderboard.</div>
        </div>
      )}

      {achievements.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Badges Earned</div>
          {achievements.map((a) => {
            const meta = badgeMeta(a.code, a.description);
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, marginBottom: 6 }}>
                <div style={{ fontSize: 20 }}>{meta.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#E8EAF0" }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "#4B5563" }}>{meta.desc}</div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {showModeratorTools && (
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 8 }}>Moderator Tools</div>
          <a href="/admin/skills-hunt" style={{ display: "block", padding: "8px 12px", borderRadius: 8, background: `${COLOR}10`, border: `1px solid ${COLOR}25`, color: COLOR, fontSize: 12, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
            Admin Panel →
          </a>
        </div>
      )}
    </aside>
  );
}
