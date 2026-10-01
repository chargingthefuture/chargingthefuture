"use client";

import { useState } from "react";
import { useTheme } from '@/hooks/useTheme';
import { getSkillsHuntTokens, type SkillsHuntRound } from './sh-shared';

// The round the Leaderboard, Missions and My Finds tabs show. With two or more rounds open the
// nomination round stays unchosen until the scout picks one in the Scout form, and these tabs used
// to read from it, so they showed nothing at all. They now show the round picked here, else the
// scout's chosen round, else the first open one.
export function useViewRound(rounds: SkillsHuntRound[], activeRound: SkillsHuntRound | null) {
  const [viewRoundId, setViewRoundId] = useState<string | null>(null);
  const viewRound = rounds.find((r) => r.id === viewRoundId) ?? activeRound ?? rounds[0] ?? null;
  return { viewRoundKey: viewRound?.id ?? null, setViewRoundId };
}

// Which open round the Leaderboard, Missions and My Finds tabs are showing. Separate from the round
// a nomination is filed under (chosen in the Scout form), so looking at another round's board can
// never move a half-filled nomination. Only drawn when more than one round is open.
export function SkillsHuntViewRoundPicker({ show, rounds, viewRoundId, onSelect }: {
  show: boolean;
  rounds: SkillsHuntRound[];
  viewRoundId: string | null;
  onSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  if (!show || rounds.length < 2) return null;
  return (
    <div role="group" aria-label="Round shown" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {rounds.map((r) => {
        const on = r.id === viewRoundId;
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(r.id)}
            style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", background: on ? `${t.ACCENT}20` : "transparent", border: `1px solid ${on ? t.ACCENT : t.BORDER}`, color: on ? t.ACCENT : t.MUTED }}
          >
            {r.name}
          </button>
        );
      })}
    </div>
  );
}
