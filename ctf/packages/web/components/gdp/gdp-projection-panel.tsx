"use client";

import { Hourglass } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import {
  PROJECTED_VALUE_DISCLAIMER,
  PROJECTED_VALUE_LABEL,
  formatCommunityValueIndex,
  getGdpTokens,
  shapeProjectedSources,
  type GdpProjection,
} from "./gdp-shared";

// "Value waiting to happen" — the projected figure.
//
// Kept in its own component, below the real headline and styled apart from it (dashed border, muted
// surface, no hero gradient), because it is NOT the Community Value Index: it counts posts that are
// still open, and most posts never close. The panel always carries the plain-language sentence that
// says so, and it renders nothing at all when the board is empty, so it can never imply activity that
// does not exist.
export function GdpProjectionPanel({ projection }: { projection: GdpProjection | null | undefined }) {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  if (!projection || projection.projectedValueIndex <= 0) return null;
  const rows = shapeProjectedSources(projection.perSource);
  if (rows.length === 0) return null;
  const max = rows.reduce((m, r) => Math.max(m, r.valueIndex), 0);
  const posts = projection.openPostCount;

  return (
    <div
      style={{
        marginBottom: 24,
        padding: "20px 24px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.02)",
        border: `1px dashed ${t.ACCENT}35`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Hourglass size={15} style={{ color: t.ACCENT, opacity: 0.8, flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>{PROJECTED_VALUE_LABEL}</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: t.ACCENT, lineHeight: 1 }}>
          {formatCommunityValueIndex(projection.projectedValueIndex)}
        </span>
        <span style={{ fontSize: 13, color: t.SUBTLE }}>
          across {posts.toLocaleString()} {posts === 1 ? "open post" : "open posts"}
        </span>
      </div>

      <div style={{ fontSize: 11, color: t.FAINT, marginTop: 10, marginBottom: 16, lineHeight: 1.55, fontStyle: "italic" }}>
        {PROJECTED_VALUE_DISCLAIMER}
      </div>

      {rows.map((row) => (
        <div key={`${row.pluginSlug}-${row.label}`} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: t.TEXT, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</span>
            <span style={{ color: t.ACCENT, fontWeight: 700, flexShrink: 0 }}>{formatCommunityValueIndex(row.valueIndex)}</span>
          </div>
          <div style={{ height: 6, background: t.INPUT_BG, borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${max > 0 ? Math.max(2, Math.round((row.valueIndex / max) * 100)) : 2}%`,
                background: t.ACCENT,
                borderRadius: 4,
                opacity: 0.55,
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: t.FAINT, marginTop: 2 }}>
            {row.openCount.toLocaleString()} {row.openCount === 1 ? "post" : "posts"} still open
          </div>
        </div>
      ))}
    </div>
  );
}
