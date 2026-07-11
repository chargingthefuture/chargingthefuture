"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/hooks/useTheme";
import { getGentlePulseTokens } from "./gp-shared";

export function GentlePulseSidebar({
  categories,
  category,
  onCategory,
  sessionCount,
  favoriteCount,
}: {
  categories: string[];
  category: string;
  onCategory: (category: string) => void;
  sessionCount: number;
  favoriteCount: number;
}) {
  const { theme } = useTheme();
  const t = getGentlePulseTokens(theme);
  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: "1px solid rgba(20,184,166,0.08)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>💚 GentlePulse</div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {categories.map((c) => (
            <div key={c} role="button" tabIndex={0} onClick={() => onCategory(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCategory(c); } }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: category === c ? `${t.ACCENT}18` : "transparent", borderLeft: category === c ? `2px solid ${t.ACCENT}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: category === c ? t.TEXT : t.MUTED, flex: 1 }}>{c}</span>
            </div>
          ))}
          <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", padding: "0 10px" }}>Your Library</div>
          {[{ l: "Available Sessions", v: String(sessionCount) }, { l: "Favorites", v: String(favoriteCount) }].map(({ l, v }) => (
            <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: t.MUTED }}>
              {l}: <span style={{ color: t.ACCENT, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
