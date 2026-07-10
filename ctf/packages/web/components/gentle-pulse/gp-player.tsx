"use client";

import { Heart, Pause, Play, Volume2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getGentlePulseTokens, type Session } from "./gp-shared";

export function GentlePulsePlayer({
  session,
  isPaused,
  progress,
  onTogglePause,
  onClose,
  onBrowse,
}: {
  session: Session | null;
  isPaused: boolean;
  progress: number;
  onTogglePause: () => void;
  onClose: () => void;
  onBrowse: () => void;
}) {
  const { theme } = useTheme();
  const t = getGentlePulseTokens(theme);
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {session ? (
        <div style={{ maxWidth: 480, width: "100%", padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: 80, marginBottom: 20 }}>{session.emoji ?? "💚"}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: t.TITLE, marginBottom: 8 }}>{session.title}</div>
          {session.description && <div style={{ fontSize: 14, color: t.MUTED, marginBottom: 32, lineHeight: 1.7 }}>{session.description}</div>}
          <div style={{ position: "relative", marginBottom: 32 }}>
            <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", background: `linear-gradient(to right,${t.ACCENT},${t.ACCENT}88)`, borderRadius: 3, width: `${progress}%`, transition: "width 0.3s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.FAINT }}>
              <span>0:00</span>
              <span>{session.duration ?? "—"}</span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 24 }}>
            <button aria-label="Volume" style={{ width: 56, height: 56, borderRadius: "50%", background: t.INPUT_BG, border: `1px solid ${t.BORDER_STRONG}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.MUTED }}>
              <Volume2 size={20} />
            </button>
            <button onClick={onTogglePause} aria-label={isPaused ? "Play" : "Pause"} style={{ width: 72, height: 72, borderRadius: "50%", background: t.ACCENT, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {isPaused ? <Play size={28} style={{ color: "#0A0F0E" }} /> : <Pause size={28} style={{ color: "#0A0F0E" }} />}
            </button>
            <button onClick={onClose} style={{ width: 56, height: 56, borderRadius: "50%", background: t.INPUT_BG, border: `1px solid ${t.BORDER_STRONG}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.MUTED, fontSize: 14 }}>
              ✕
            </button>
          </div>
          <div style={{ fontSize: 13, color: `${t.ACCENT}80` }}>You are safe. You are enough. You are healing. 💚</div>
        </div>
      ) : (
        <div style={{ textAlign: "center", color: t.FAINT }}>
          <Heart size={48} style={{ color: t.ACCENT, opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: t.MUTED }}>Select a session to begin</div>
          <button onClick={onBrowse} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 10, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Browse Sessions
          </button>
        </div>
      )}
    </div>
  );
}
