"use client";

import { BookOpen, User, Users } from "lucide-react";
import { BORDER, GREEN, MUTED, SUBTLE, SURFACE, TEXT, TRACK_COLORS, type Trainer } from "./lu-shared";

function EmptyTrainers() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "48px 0", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: `${GREEN}10`, border: `1px solid ${GREEN}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Users size={24} style={{ color: GREEN, opacity: 0.5 }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 6 }}>No trainers listed yet</div>
        <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6, maxWidth: 360 }}>Trainers are survivor-advocates who lead cohorts. New trainers appear here as they join.</div>
      </div>
    </div>
  );
}

export function LevelUpTrainers({ trainers }: { trainers: Trainer[] }) {
  if (trainers.length === 0) return <EmptyTrainers />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
      {trainers.map((trainer) => (
        <div key={trainer.id} style={{ background: SURFACE, borderRadius: 12, padding: "16px", border: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${GREEN}18`, border: `1px solid ${GREEN}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <User size={18} color={GREEN} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{trainer.displayName}</div>
              {trainer.headline && <div style={{ fontSize: 12, color: SUBTLE }}>{trainer.headline}</div>}
            </div>
          </div>
          {trainer.bio && <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5, marginBottom: 12 }}>{trainer.bio}</div>}
          {trainer.tracks.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {trainer.tracks.map((track) => {
                const color = TRACK_COLORS[track] ?? GREEN;
                return (
                  <span key={track} style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, padding: "3px 8px", borderRadius: 20 }}>{track}</span>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: MUTED, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
            <BookOpen size={12} />
            {trainer.activeCohortCount} active {trainer.activeCohortCount === 1 ? "cohort" : "cohorts"}
          </div>
        </div>
      ))}
    </div>
  );
}
