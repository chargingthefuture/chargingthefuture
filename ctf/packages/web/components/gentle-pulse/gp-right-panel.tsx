"use client";

import { Play } from "lucide-react";
import { COLOR, FAINT, TEXT, type Session } from "./gp-shared";

const DESIGNERS = ["Certified Trauma Therapists", "EMDR Specialists", "Somatic Coaches"];

export function GentlePulseRightPanel({ sessions, onPlay }: { sessions: Session[]; onPlay: (id: string) => void }) {
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(20,184,166,0.08)", background: "#080D0C", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: FAINT, textTransform: "uppercase", marginBottom: 12 }}>Popular Now</div>
      {sessions.slice(0, 4).map((s) => (
        <div key={s.id} onClick={() => onPlay(s.id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px", borderRadius: 10, background: `${COLOR}06`, border: `1px solid ${COLOR}15`, marginBottom: 8, cursor: "pointer" }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>{s.emoji ?? "💚"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
            {s.duration && <div style={{ fontSize: 11, color: FAINT }}>{s.duration}</div>}
          </div>
          <Play size={16} style={{ color: COLOR, flexShrink: 0 }} />
        </div>
      ))}
      {sessions.length === 0 && (
        <div style={{ fontSize: 12, color: FAINT, textAlign: "center", padding: "16px 0" }}>No sessions loaded yet.</div>
      )}
      <div style={{ marginTop: 16, padding: "16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}18` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, marginBottom: 8 }}>Today&apos;s Affirmation</div>
        <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.7, fontStyle: "italic" }}>&quot;You did not choose what happened to you. You DO choose what happens next.&quot;</div>
      </div>
      <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: FAINT, textTransform: "uppercase", marginBottom: 8 }}>Designed By</div>
        {DESIGNERS.map((p) => (
          <div key={p} style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>• {p}</div>
        ))}
      </div>
    </aside>
  );
}
