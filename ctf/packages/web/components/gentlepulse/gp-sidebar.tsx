"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { COLOR, FAINT, SUBTLE, TEXT } from "./gp-shared";

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
  return (
    <aside style={{ width: 240, background: "#080D0C", borderRight: "1px solid rgba(20,184,166,0.08)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: FAINT, textTransform: "uppercase", marginBottom: 12 }}>💚 GentlePulse</div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {categories.map((c) => (
            <div key={c} onClick={() => onCategory(c)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: category === c ? `${COLOR}18` : "transparent", borderLeft: category === c ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: category === c ? TEXT : SUBTLE, flex: 1 }}>{c}</span>
            </div>
          ))}
          <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: FAINT, textTransform: "uppercase", padding: "0 10px" }}>Your Library</div>
          {[{ l: "Available Sessions", v: String(sessionCount) }, { l: "Favorites", v: String(favoriteCount) }].map(({ l, v }) => (
            <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: SUBTLE }}>
              {l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
