"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, Heart, Play } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getGentlePulseTokens, type Session } from "./gp-shared";

function FavoriteButton({
  isFav,
  submitting,
  onClick,
}: {
  isFav: boolean;
  submitting: boolean;
  onClick: () => void;
}) {
  const { theme } = useTheme();
  const t = getGentlePulseTokens(theme);
  const bg = isFav ? `${t.ACCENT}15` : t.INPUT_BG;
  const borderColor = isFav ? `${t.ACCENT}30` : t.BORDER_STRONG;
  const color = isFav ? t.ACCENT : t.MUTED;
  return (
    <button
      onClick={onClick}
      disabled={submitting}
      aria-label={isFav ? "Remove favorite" : "Add favorite"}
      style={{ padding: "8px 10px", borderRadius: 8, background: bg, border: `1px solid ${borderColor}`, color, cursor: "pointer" }}
    >
      ♥
    </button>
  );
}

function SessionCard({
  session,
  isFav,
  submitting,
  onPlay,
  onToggleFavorite,
}: {
  session: Session;
  isFav: boolean;
  submitting: boolean;
  onPlay: (id: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getGentlePulseTokens(theme);
  const s = session;
  return (
    <div style={{ padding: "20px", borderRadius: 16, background: "rgba(20,184,166,0.04)", border: `1px solid ${t.ACCENT}20`, cursor: "pointer" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{s.emoji ?? "💚"}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>{s.title}</div>
      {s.description && <div style={{ fontSize: 12, color: t.FAINT, marginBottom: 12, lineHeight: 1.5 }}>{s.description}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.MUTED, marginBottom: 12 }}>
        {s.duration && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {s.duration}</span>}
        {s.rating && <span>⭐ {s.rating}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {s.category && <Badge style={{ background: `${t.ACCENT}10`, color: t.ACCENT, border: `1px solid ${t.ACCENT}25`, fontSize: 10 }}>{s.category}</Badge>}
        {s.level && <Badge style={{ background: t.INPUT_BG, color: t.MUTED, border: "1px solid rgba(255,255,255,0.06)", fontSize: 10 }}>{s.level}</Badge>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onPlay(s.id)} style={{ flex: 1, padding: "8px", borderRadius: 8, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Play size={13} /> Start
        </button>
        <FavoriteButton isFav={isFav} submitting={submitting} onClick={() => onToggleFavorite(s.id, isFav)} />
      </div>
    </div>
  );
}

export function GentlePulseSessions({
  sessions,
  filtered,
  favorites,
  submitting,
  onPlay,
  onToggleFavorite,
}: {
  sessions: Session[];
  filtered: Session[];
  favorites: Set<string>;
  submitting: boolean;
  onPlay: (id: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getGentlePulseTokens(theme);
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(20,184,166,0.03) 100%)`, border: `1px solid ${t.ACCENT}20` }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Your Space to Breathe</div>
          <div style={{ fontSize: 14, color: t.MUTED }}>{sessions.length} sessions · Trauma-informed therapists · Always free</div>
        </div>
        {sessions.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(20,184,166,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart size={20} style={{ color: "rgba(20,184,166,0.4)" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.SUBTLE }}>No sessions available yet</div>
            <div style={{ fontSize: 13, color: t.FAINT }}>Wellness content will appear here soon.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {filtered.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                isFav={favorites.has(s.id)}
                submitting={submitting}
                onPlay={onPlay}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
