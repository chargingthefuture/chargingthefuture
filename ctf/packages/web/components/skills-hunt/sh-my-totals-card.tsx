"use client";

import { useEffect, useState } from "react";
import { useTheme } from '@/hooks/useTheme';
import { getSkillsHuntTokens } from './sh-shared';
import type { SkillsHuntMyTotals } from 'lib/skills-hunt/my-totals';

// Loads the signed-in member's totals; re-runs when the header refresh bumps `refreshKey`.
function useMyTotals(refreshKey: number): { totals: SkillsHuntMyTotals | null; failed: boolean } {
  const [totals, setTotals] = useState<SkillsHuntMyTotals | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/skills-hunt/my-totals", { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) { setFailed(true); return; }
        const data = (await res.json()) as { totals: SkillsHuntMyTotals };
        setTotals(data.totals);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey]);

  return { totals, failed };
}

// Flagged and rejected only appear when there are some, so a member with none sees no zeros.
function secondaryLine(totals: SkillsHuntMyTotals | null): string {
  if (!totals) return "";
  const parts: string[] = [];
  if (totals.flagged > 0) parts.push(`${totals.flagged} flagged`);
  if (totals.rejected > 0) parts.push(`${totals.rejected} rejected`);
  return parts.join(" · ");
}

// The member's own counts across every round, at the top of My Finds. Nobody else's numbers are
// fetched or shown. Loads each time the tab opens and on the header refresh.
export function SkillsHuntMyTotalsCard({ refreshKey }: { refreshKey: number }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const { totals, failed } = useMyTotals(refreshKey);

  const cells: Array<{ label: string; value: number | undefined; color: string }> = [
    { label: "Profiles created", value: totals?.profilesCreated, color: t.ACCENT },
    { label: "Accepted", value: totals?.accepted, color: "#22C55E" },
    { label: "Pending", value: totals?.pending, color: "#F59E0B" },
    { label: "Submitted", value: totals?.submitted, color: t.TITLE },
  ];
  const extra = secondaryLine(totals);

  return (
    <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}`, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 2 }}>Your totals, all rounds</div>
      <div style={{ fontSize: 12, color: t.FAINT, marginBottom: 12 }}>Only you can see these.</div>
      {failed && !totals ? (
        <div style={{ fontSize: 13, color: t.MUTED }}>Your totals could not be loaded. Use refresh to try again.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {cells.map((c) => (
            <div key={c.label}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value ?? "–"}</div>
              <div style={{ fontSize: 12, color: t.MUTED }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}
      {extra && <div style={{ fontSize: 12, color: t.FAINT, marginTop: 10 }}>{extra}</div>}
    </div>
  );
}
