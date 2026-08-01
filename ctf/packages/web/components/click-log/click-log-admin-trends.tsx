"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import Link from "next/link";
import { MobileScreenHeader } from "@/components/shared/mobile-screen-header";
import type { SharedIncidentTrendBucket } from "../../lib/click-log/types";

// Admin dark palette (rule 131) with the ClickLog accent.
const BG = "#0F1117";
const SURFACE = "#161B27";
const BORDER = "#1E2A3A";
const TEXT = "#F9FAFB";
const SUBTLE = "#6B7280";
const ACCENT = "#EC4899";

// Owner trends over member-shared incidents. Data is coarse by construction (UTC day + ~11 km
// location cell + count, aggregated in SQL) — this view never sees notes, precise coordinates,
// incident ids, or member identity. No in-page title card: MobileScreenHeader names the screen
// (rule 131), so the shell goes straight to content.
export function ClickLogAdminTrends() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<SharedIncidentTrendBucket[]>([]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/click-log/admin/trends");
        if (!res.ok) throw new Error("Failed to load trends");
        const data = (await res.json()) as { buckets: SharedIncidentTrendBucket[] };
        if (!canceled) setBuckets(data.buckets);
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : "Failed to load trends");
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const totalShared = buckets.reduce((sum, b) => sum + b.count, 0);
  const dayTotals = buckets.reduce<Map<string, number>>((map, b) => {
    map.set(b.day, (map.get(b.day) ?? 0) + b.count);
    return map;
  }, new Map());
  const days = Array.from(dayTotals.entries());
  const withLocation = buckets.filter((b) => b.latitudeCell !== null && b.longitudeCell !== null);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <MobileScreenHeader
        title="ClickLog Trends"
        icon={<AlertTriangle size={18} color={ACCENT} />}
        accent={ACCENT}
        backHref="/admin"
        actions={<Link href="/apps/click-log" style={{ fontSize: 12, color: SUBTLE, textDecoration: "none" }}>Member view</Link>}
      />
      <div style={{ padding: 16, maxWidth: 560, margin: "0 auto" }}>
        {loading && <div style={{ color: SUBTLE, fontSize: 13, padding: "32px 0", textAlign: "center" }}>Loading trends…</div>}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fecaca", fontSize: 13 }}>{error}</div>
        )}
        {!loading && !error && (
          <>
            <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5, marginBottom: 16 }}>
              Aggregate of incidents members chose to share, last 90 days. Coarse data only: day, an
              approximate area (about 11 km), and counts — no notes, exact locations, or member identity.
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{totalShared}</div>
                <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>Shared incidents</div>
              </div>
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{days.length}</div>
                <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>Days with activity</div>
              </div>
            </div>
            {days.length === 0 ? (
              <div style={{ padding: "40px 16px", borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: "center", color: SUBTLE, fontSize: 13, lineHeight: 1.6 }}>
                No shared incidents yet. Members control sharing from their ClickLog — nothing appears
                here until someone opts in.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {days.map(([day, count]) => (
                  <div key={day} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 13, color: TEXT, flex: 1 }}>{day}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{count}</div>
                  </div>
                ))}
                {withLocation.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11, color: SUBTLE }}>
                    <MapPin size={11} color={SUBTLE} />
                    {withLocation.length} area cluster{withLocation.length === 1 ? "" : "s"} across the shared incidents (each about 11 km wide)
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
