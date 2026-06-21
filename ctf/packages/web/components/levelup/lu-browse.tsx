"use client";

import { BookOpen, CheckCircle, Coins, Search, Users } from "lucide-react";
import { BORDER, GREEN, MUTED, SUBTLE, SURFACE, TEXT, TRACKS, type Cohort } from "./lu-shared";
import { LevelUpCohortCard } from "./lu-cohort-card";

export function LevelUpBrowse({
  cohorts,
  openCount,
  enrolledCount,
  balance,
  escrow,
  track,
  onTrack,
  search,
  onSearch,
  enrollError,
  enrolledIds,
  enrollingId,
  onEnroll,
}: {
  cohorts: Cohort[];
  openCount: number;
  enrolledCount: number;
  balance: number;
  escrow: number;
  track: string;
  onTrack: (track: string) => void;
  search: string;
  onSearch: (value: string) => void;
  enrollError: string | null;
  enrolledIds: Set<string>;
  enrollingId: string | null;
  onEnroll: (cohort: Cohort) => void;
}) {
  const stats = [
    { label: "Open Cohorts", value: String(openCount), icon: BookOpen, color: GREEN },
    { label: "Enrolled", value: String(enrolledCount), icon: Users, color: "#3B82F6" },
    { label: "My Balance", value: `${balance.toLocaleString()} SC`, icon: Coins, color: "#A855F7" },
    { label: "In Escrow", value: `${escrow.toLocaleString()} SC`, icon: CheckCircle, color: "#F59E0B" },
  ];

  return (
    <>
      {/* Auto-fit grid so the four stat cards lay out 4-across on desktop and wrap to 2×2 on a phone,
          instead of a fixed flex row that runs off the side of the screen (the app viewport hides
          horizontal overflow, so an off-screen card would be unreachable). */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: SURFACE, borderRadius: 10, padding: "14px 16px", border: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon size={14} color={color} />
              <span style={{ fontSize: 12, color: SUBTLE }}>{label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {TRACKS.map((t) => (
          <button key={t} type="button" onClick={() => onTrack(t)}
            style={{ padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, background: track === t ? GREEN : BORDER, color: track === t ? "#000" : SUBTLE }}>
            {t}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 12px" }}>
          <Search size={13} color={MUTED} />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search cohorts…"
            style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: TEXT, width: 140 }} />
        </div>
      </div>

      {enrollError && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#EF4444" }}>
          {enrollError}
        </div>
      )}

      {cohorts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: SUBTLE }}>
          <BookOpen size={40} style={{ opacity: 0.3, display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>No cohorts found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Try a different track or search term</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {cohorts.map((cohort) => (
            <LevelUpCohortCard
              key={cohort.id}
              cohort={cohort}
              isEnrolled={enrolledIds.has(cohort.id)}
              isEnrolling={enrollingId === cohort.id}
              onEnroll={onEnroll}
            />
          ))}
        </div>
      )}
    </>
  );
}
