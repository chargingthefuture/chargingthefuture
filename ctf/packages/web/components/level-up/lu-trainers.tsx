"use client";

import { BookOpen, Users } from "lucide-react";
import { BG, BORDER, GREEN, MUTED, SUBTLE, SURFACE, TEXT, TRACK_COLORS, type Trainer } from "./lu-shared";

// Trainers screen — layout aligned to design/.../survivor-hub/LevelUpTrainers.tsx.
// Real data only: every value comes from GET /api/level-up/trainers.
// The mockup also shows per-trainer rating, handle, learners count, milestones
// validated, SC released, a "message" action, and a recent-activity feed — none
// of these are returned by the trainers endpoint, so they are intentionally not
// rendered (no fabricated numbers). Only displayName, tracks, headline, bio, and
// activeCohortCount are real, plus the real total-trainer count.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 150, background: SURFACE, borderRadius: 10, padding: "14px 16px", border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Users size={14} color={color} />
        <span style={{ fontSize: 12, color: SUBTLE }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

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

function TrainerCard({ trainer }: { trainer: Trainer }) {
  const primaryTrack = trainer.tracks[0];
  const tc = (primaryTrack && TRACK_COLORS[primaryTrack]) || GREEN;
  return (
    <div style={{ background: SURFACE, borderRadius: 12, padding: "20px", border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${tc}18`, border: `1.5px solid ${tc}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: tc, flexShrink: 0 }}>
          {initials(trainer.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{trainer.displayName}</span>
            {trainer.tracks.map((track) => {
              const color = TRACK_COLORS[track] ?? GREEN;
              return (
                <span key={track} style={{ fontSize: 10, fontWeight: 600, color, background: `${color}15`, padding: "2px 7px", borderRadius: 20 }}>{track}</span>
              );
            })}
          </div>
          {trainer.headline && <div style={{ fontSize: 12, color: SUBTLE }}>{trainer.headline}</div>}
        </div>
      </div>

      {trainer.bio && (
        <div style={{ padding: "10px 12px", background: BG, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 14, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
          {trainer.bio}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, paddingTop: 4 }}>
        <BookOpen size={13} />
        {trainer.activeCohortCount} active {trainer.activeCohortCount === 1 ? "cohort" : "cohorts"}
      </div>
    </div>
  );
}

export function LevelUpTrainers({ trainers }: { trainers: Trainer[] }) {
  if (trainers.length === 0) return <EmptyTrainers />;

  const trackSet = new Set<string>();
  trainers.forEach((t) => t.tracks.forEach((track) => trackSet.add(track)));
  const totalCohorts = trainers.reduce((sum, t) => sum + t.activeCohortCount, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Trainers" value={String(trainers.length)} color={GREEN} />
        <StatCard label="Tracks covered" value={String(trackSet.size)} color="#3B82F6" />
        <StatCard label="Active cohorts" value={String(totalCohorts)} color="#F59E0B" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {trainers.map((trainer) => (
          <TrainerCard key={trainer.id} trainer={trainer} />
        ))}
      </div>
    </div>
  );
}
