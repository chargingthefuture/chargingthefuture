"use client";

import { Play } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getGentlePulseTokens, type Session } from "./gp-shared";

export function GentlePulseRightPanel({ sessions, onPlay }: { sessions: Session[]; onPlay: (id: string) => void }) {
  const { theme } = useTheme();
  const t = getGentlePulseTokens(theme);
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(20,184,166,0.08)", background: t.HEADER, padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>Popular Now</div>
      {sessions.slice(0, 4).map((s) => (
        <div key={s.id} onClick={() => onPlay(s.id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px", borderRadius: 10, background: `${t.ACCENT}06`, border: `1px solid ${t.ACCENT}15`, marginBottom: 8, cursor: "pointer" }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>{s.emoji ?? "💚"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
            {s.duration && <div style={{ fontSize: 11, color: t.FAINT }}>{s.duration}</div>}
          </div>
          <Play size={16} style={{ color: t.ACCENT, flexShrink: 0 }} />
        </div>
      ))}
      {sessions.length === 0 && (
        <div style={{ fontSize: 12, color: t.FAINT, textAlign: "center", padding: "16px 0" }}>No sessions loaded yet.</div>
      )}
      <div style={{ marginTop: 16, padding: "16px", borderRadius: 12, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}18` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.ACCENT, marginBottom: 8 }}>Today&apos;s Affirmation</div>
        <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.7, fontStyle: "italic" }}>&quot;You did not choose what happened to you. You DO choose what happens next.&quot;</div>
      </div>
    </aside>
  );
}
