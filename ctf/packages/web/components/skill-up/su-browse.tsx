"use client";

import { BookMarked, BookOpen, CheckCircle, Search } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getSkillUpTokens, type Cohort } from "./su-shared";
import { SkillUpCohortCard } from "./su-cohort-card";

export function SkillUpBrowse({
  cohorts,
  openCount,
  enrolledCount,
  enrolledCountError,
  escrow,
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
  enrolledCountError: string | null;
  escrow: number;
  search: string;
  onSearch: (value: string) => void;
  enrollError: string | null;
  enrolledIds: Set<string>;
  enrollingId: string | null;
  onEnroll: (cohort: Cohort) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillUpTokens(theme);
  // All three cards are about you, not about the whole site: how many cohorts are open to join, how
  // many you are in, and how many of your credits are held. The middle card used to read just
  // "Enrolled" next to a people icon, which invited reading it as a count of everyone enrolled
  // site-wide (owner report). It is your own count, so it says so.
  const stats = [
    { label: "Open Cohorts", value: String(openCount), icon: BookOpen, color: t.ACCENT },
    { label: "My Cohorts", value: enrolledCountError ? "—" : String(enrolledCount), icon: BookMarked, color: "#3B82F6" },
    { label: "In Escrow", value: `${escrow.toLocaleString()} SC`, icon: CheckCircle, color: "#F59E0B" },
  ];

  return (
    <>
      {/* Auto-fit grid so the stat cards lay out across the row on desktop and wrap on a phone,
          instead of a fixed flex row that runs off the side of the screen (the app viewport hides
          horizontal overflow, so an off-screen card would be unreachable). */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: t.SURFACE, borderRadius: 10, padding: "14px 16px", border: `1px solid ${t.BORDER_SOLID}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon size={14} color={color} />
              <span style={{ fontSize: 12, color: t.TEXT_SUBTLE }}>{label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Preset track filter chips were a fixed, hardcoded list (Tech / Finance / Wellness / Life
          Skills) that did not reflect the cohorts that actually exist, so they are hidden until they
          can be driven by real cohort data at scale (deferred — see #1197). Search stays. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 8, padding: "7px 12px" }}>
          <Search size={13} color={t.FAINT} />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search cohorts…"
            style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: t.TEXT_BODY, width: 140 }} />
        </div>
      </div>

      {enrolledCountError && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#F59E0B" }}>
          Could not read the cohorts you are in ({enrolledCountError}), so &ldquo;My Cohorts&rdquo; shows a dash and a
          cohort you already joined may still offer an Enroll button. Refresh to try again.
        </div>
      )}

      {enrollError && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#EF4444" }}>
          {enrollError}
        </div>
      )}

      {cohorts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: t.TEXT_SUBTLE }}>
          <BookOpen size={40} style={{ opacity: 0.3, display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>No cohorts found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Try a different track or search term</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {cohorts.map((cohort) => (
            <SkillUpCohortCard
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
