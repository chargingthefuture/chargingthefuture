"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PluginUserShellButton } from "@/components/shared/plugin-user-shell-button";
import { MobileScreenHeader } from "@/components/shared/mobile-screen-header";
import type { SharedIncidentReport } from "../../lib/click-log/types";
import { buildTrendReportView } from "../../lib/click-log/trend-report-view";
import {
  ClickLogTrendMethod,
  ClickLogTrendResults,
  ClickLogTrendStat,
} from "./click-log-trend-sections";
import { ClickLogTrendImageLink } from "./click-log-trend-image-link";
import {
  TREND_ACCENT,
  TREND_BG,
  TREND_SUBTLE,
  TREND_TEXT,
} from "./click-log-trend-tokens";

// Owner trends over member-shared incidents. Data is coarse by construction (UTC day, ~11 km
// location cell, counts, canonical tag slugs, and distinct-member counts, all aggregated in SQL) —
// this view never sees notes, precise coordinates, incident ids, or member identity. No in-page
// title card: MobileScreenHeader names the screen (rule 131), so the shell goes straight to content.
//
// The screen shows every area cell with its coordinates. The old view counted the clusters and
// stopped there, which told the owner activity had a location without ever saying where. The
// shareable image never carries those coordinates — it is made to be posted, and nothing on this
// screen can put them into it.
export function ClickLogAdminTrends() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SharedIncidentReport | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/click-log/admin/trends");
        if (!res.ok) throw new Error("Failed to load trends");
        const data = (await res.json()) as SharedIncidentReport;
        if (!canceled) setReport(data);
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

  const view = report ? buildTrendReportView(report, { includeAreas: true }) : null;

  return (
    <div style={{ minHeight: "100vh", background: TREND_BG, color: TREND_TEXT, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <MobileScreenHeader
        title="ClickLog Trends"
        icon={<AlertTriangle size={18} color={TREND_ACCENT} />}
        accent={TREND_ACCENT}
        backHref="/admin"
        actions={<PluginUserShellButton href="/apps/click-log" accent={TREND_ACCENT} />}
      />
      <div style={{ padding: 16, maxWidth: 560, margin: "0 auto" }}>
        {loading && <div style={{ color: TREND_SUBTLE, fontSize: 13, padding: "32px 0", textAlign: "center" }}>Loading trends…</div>}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fecaca", fontSize: 13 }}>{error}</div>
        )}
        {view && !loading && !error && (
          <>
            <div style={{ fontSize: 12, color: TREND_SUBTLE, lineHeight: 1.5, marginBottom: 16 }}>
              {view.windowLine}. Aggregate of incidents members chose to share. Grouped data only:
              day, an approximate area (about 11 km), counts, and which problem/scheme tags members
              picked — no notes, exact locations, or member identity.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
              {view.stats.map((stat) => (
                <ClickLogTrendStat key={stat.label} label={stat.label} value={Number(stat.value)} />
              ))}
            </div>
            <ClickLogTrendResults view={view} />
            <ClickLogTrendImageLink />
            <ClickLogTrendMethod notes={view.notes} />
          </>
        )}
      </div>
    </div>
  );
}
