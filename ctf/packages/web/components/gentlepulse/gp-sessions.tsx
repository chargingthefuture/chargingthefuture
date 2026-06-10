"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, Heart, Play } from "lucide-react";
import { COLOR, FAINT, SUBTLE, type Session } from "./gp-shared";

function FavoriteButton({
  isFav,
  submitting,
  onClick,
}: {
  isFav: boolean;
  submitting: boolean;
  onClick: () => void;
}) {
  const bg = isFav ? `${COLOR}15` : "rgba(255,255,255,0.04)";
  const borderColor = isFav ? `${COLOR}30` : "rgba(255,255,255,0.08)";
  const color = isFav ? COLOR : SUBTLE;
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
  const s = session;
  return (
    <div style={{ padding: "20px", borderRadius: 16, background: "rgba(20,184,166,0.04)", border: `1px solid ${COLOR}20`, cursor: "pointer" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{s.emoji ?? "💚"}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>{s.title}</div>
      {s.description && <div style={{ fontSize: 12, color: FAINT, marginBottom: 12, lineHeight: 1.5 }}>{s.description}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: SUBTLE, marginBottom: 12 }}>
        {s.duration && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {s.duration}</span>}
        {s.rating && <span>⭐ {s.rating}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {s.category && <Badge style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 10 }}>{s.category}</Badge>}
        {s.level && <Badge style={{ background: "rgba(255,255,255,0.04)", color: SUBTLE, border: "1px solid rgba(255,255,255,0.06)", fontSize: 10 }}>{s.level}</Badge>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onPlay(s.id)} style={{ flex: 1, padding: "8px", borderRadius: 8, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(20,184,166,0.03) 100%)`, border: `1px solid ${COLOR}20` }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Your Space to Breathe</div>
          <div style={{ fontSize: 14, color: SUBTLE }}>{sessions.length} sessions · Trauma-informed therapists · Always free</div>
        </div>
        {sessions.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(20,184,166,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart size={20} style={{ color: "rgba(20,184,166,0.4)" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No sessions available yet</div>
            <div style={{ fontSize: 13, color: FAINT }}>Wellness content will appear here soon.</div>
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
