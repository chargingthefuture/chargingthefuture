"use client";

import { TABS, badgeMeta, type SkillsHuntAchievement, type SkillsHuntLeaderboardItem, type Tab } from "./sh-shared";
import { useTheme } from '@/hooks/useTheme';
import { getSkillsHuntTokens } from './sh-shared';

function ScoutingScore({ entry }: { entry: SkillsHuntLeaderboardItem }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ padding: "10px 12px", borderRadius: 10, background: `${t.ACCENT}10`, border: `1px solid ${t.ACCENT}25` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.ACCENT, marginBottom: 2 }}>Your Scouting Score</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE }}>{entry.score} pts</div>
        <div style={{ fontSize: 11, color: t.MUTED }}>
          {entry.acceptedCount} accepted · +{entry.pendingPoints} pending · Rank #{entry.rank}
        </div>
      </div>
    </div>
  );
}

export function SkillsHuntSidebar({
  tab,
  onTab,
  achievements,
  currentUserEntry,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  achievements: SkillsHuntAchievement[];
  currentUserEntry: SkillsHuntLeaderboardItem | null;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 4 }}>SkillsHunt</div>
        <div style={{ fontSize: 12, color: t.FAINT, lineHeight: 1.5, marginBottom: 12 }}>Nominate survivors — populate the Directory, build the economy.</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        {TABS.map(({ key, icon: Icon, label }) => (
          <button key={key} type="button" onClick={() => onTab(key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: tab === key ? `${t.ACCENT}18` : "transparent", borderLeft: tab === key ? `2px solid ${t.ACCENT}` : "2px solid transparent", marginLeft: 2, marginBottom: 2, border: "none", textAlign: "left" }}>
            <Icon size={14} style={{ color: tab === key ? t.ACCENT : t.MUTED }} />
            <span style={{ fontSize: 13, color: tab === key ? t.TEXT : t.SUBTLE, flex: 1 }}>{label}</span>
          </button>
        ))}

        {achievements.length > 0 && (
          <>
            <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", padding: "0 10px" }}>Your Badges</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 10px" }}>
              {achievements.map((a) => {
                const meta = badgeMeta(a.code, a.description);
                return (
                  <div key={a.id} title={`${a.title}: ${meta.desc}`} style={{ width: 32, height: 32, borderRadius: 8, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer" }}>
                    {meta.emoji}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {currentUserEntry && <ScoutingScore entry={currentUserEntry} />}
    </aside>
  );
}
