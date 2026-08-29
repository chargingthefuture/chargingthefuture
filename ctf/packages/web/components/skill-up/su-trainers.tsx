"use client";

import { BookOpen, Users } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getSkillUpTokens, TRACK_COLORS, type Trainer } from "./su-shared";

// Trainers screen — layout aligned to design/.../survivor-hub/SkillUpTrainers.tsx.
// Real data only: every value comes from GET /api/skill-up/trainers.
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
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 150, background: t.SURFACE, borderRadius: 10, padding: "14px 16px", border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Users size={14} color={color} />
        <span style={{ fontSize: 12, color: t.TEXT_SUBTLE }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function EmptyTrainers() {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "48px 0", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: `${t.ACCENT}10`, border: `1px solid ${t.ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Users size={24} style={{ color: t.ACCENT, opacity: 0.5 }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT_BODY, marginBottom: 6 }}>No trainers listed yet</div>
        <div style={{ fontSize: 13, color: t.TEXT_SUBTLE, lineHeight: 1.6, maxWidth: 360 }}>Trainers are survivor-advocates who lead cohorts. New trainers appear here as they join.</div>
      </div>
    </div>
  );
}

function TrainerCard({ trainer }: { trainer: Trainer }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  const primaryTrack = trainer.tracks[0];
  const tc = (primaryTrack && TRACK_COLORS[primaryTrack]) || t.ACCENT;
  return (
    <div style={{ background: t.SURFACE, borderRadius: 12, padding: "20px", border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${tc}18`, border: `1.5px solid ${tc}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: tc, flexShrink: 0 }}>
          {initials(trainer.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TEXT_BODY }}>{trainer.displayName}</span>
            {trainer.tracks.map((track) => {
              const color = TRACK_COLORS[track] ?? t.ACCENT;
              return (
                <span key={track} style={{ fontSize: 10, fontWeight: 600, color, background: `${color}15`, padding: "2px 7px", borderRadius: 20 }}>{track}</span>
              );
            })}
          </div>
          {trainer.headline && <div style={{ fontSize: 12, color: t.TEXT_SUBTLE }}>{trainer.headline}</div>}
        </div>
      </div>

      {trainer.bio && (
        <div style={{ padding: "10px 12px", background: t.BG, borderRadius: 8, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 14, fontSize: 13, color: t.TEXT_BODY, lineHeight: 1.5 }}>
          {trainer.bio}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.FAINT, paddingTop: 4 }}>
        <BookOpen size={13} />
        {trainer.activeCohortCount} active {trainer.activeCohortCount === 1 ? "cohort" : "cohorts"}
      </div>
    </div>
  );
}

export function SkillUpTrainers({ trainers }: { trainers: Trainer[] }) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  if (trainers.length === 0) return <EmptyTrainers />;

  const trackSet = new Set<string>();
  trainers.forEach((tr) => tr.tracks.forEach((track) => trackSet.add(track)));
  const totalCohorts = trainers.reduce((sum, tr) => sum + tr.activeCohortCount, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Trainers" value={String(trainers.length)} color={t.ACCENT} />
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
