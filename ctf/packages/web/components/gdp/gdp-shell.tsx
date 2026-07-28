"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import {
  getGdpTokens,
  shapeLiveGdpMetrics,
  shapeSourceSectors,
  COMMUNITY_VALUE_INDEX_METRIC_KEY,
  type GdpCountry,
  type GdpMetricRow,
  type GdpMetrics,
  type GdpReportPayload,
  type GdpSector,
  type GdpTokens,
} from "./gdp-shared";
import { GdpLoading } from "./gdp-loading";
import { GdpDashboard } from "./gdp-dashboard";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

function EmptyReport({ t }: { t: GdpTokens }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: t.MUTED }}>
      <Globe size={48} style={{ color: t.ACCENT, opacity: 0.3 }} />
      <div style={{ fontSize: 16, fontWeight: 600 }}>No GDP report published yet</div>
      <div style={{ fontSize: 13 }}>Check back soon.</div>
    </div>
  );
}

function GdpContent({
  t,
  error,
  report,
  sectors,
  countries,
  metrics,
}: {
  t: GdpTokens;
  error: string | null;
  report: GdpReportPayload | null;
  sectors: GdpSector[];
  countries: GdpCountry[];
  metrics: GdpMetrics;
}) {
  if (error) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14, padding: 24 }}>{error}</div>;
  }
  if (!report) return <EmptyReport t={t} />;
  return <GdpDashboard sectors={sectors} countries={countries} metrics={metrics} />;
}

// Read the live headline figure (the Community Value Index) off the report payload and report whether it
// is flagged a normalized estimate. Returns false unless the row actually carries that flag, so the
// estimate treatment only renders where the data says it is an estimate. Never inspects per-user figures
// — only the aggregate metric.
function deriveIsEstimate(rawMetrics: unknown): boolean {
  if (!Array.isArray(rawMetrics)) return false;
  return (rawMetrics as GdpMetricRow[]).some(
    (m) => m && m.metricKey === COMMUNITY_VALUE_INDEX_METRIC_KEY && m.isEstimate === true,
  );
}

export default function GdpShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GdpReportPayload | null>(null);
  const [isEstimate, setIsEstimate] = useState(false);
  // Raw per-metric rows from the report payload, kept so shapeLiveGdpMetrics can read the community-wide
  // aggregates (gdp_value_index, total_members) by key for the hero. No per-country data exists here.
  const [metricRows, setMetricRows] = useState<GdpMetricRow[]>([]);
  // Real per-country member distribution (location tied to people), fetched from /api/gdp/countries.
  const [countries, setCountries] = useState<GdpCountry[]>([]);
  const { theme } = useTheme();
  const t = getGdpTokens(theme);

  // Re-pull the current report. Only the initial load shows the full-screen loading state;
  // the header refresh button calls this with initial=false so the dashboard stays on screen.
  const fetchReport = useCallback(async (initial: boolean, signal?: AbortSignal) => {
    if (initial) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gdp/report/current", { signal });
      if (!res.ok) throw new Error("Failed to load GDP report");
      const data = (await res.json()) as { report?: GdpReportPayload | null };
      if (signal?.aborted) return;
      setReport(data.report ?? null);
      setIsEstimate(deriveIsEstimate(data.report?.metrics));
      setMetricRows(Array.isArray(data.report?.metrics) ? data.report.metrics : []);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load GDP data.");
    } finally {
      if (initial && !signal?.aborted) setLoading(false);
    }
  }, []);

  // Load the real per-country member distribution for the "All Countries" panel. Independent of the
  // main report (a failure here just leaves the panel empty; it never blocks the dashboard).
  const fetchCountries = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/gdp/countries", { signal });
      if (!res.ok || signal?.aborted) return;
      const data = (await res.json()) as { countries?: Array<{ country: string; members: number }>; unspecified?: number; totalMembers?: number };
      const rows = data.countries ?? [];
      const located = rows.reduce((sum, r) => sum + r.members, 0);
      // total is the full member roster; shares are a % of it, so the located countries plus the
      // "Location not set" bucket reconcile to the same member count the hero shows.
      const total = data.totalMembers ?? located;
      const unspecified = data.unspecified ?? Math.max(0, total - located);
      if (signal?.aborted) return;
      const mapped: GdpCountry[] = rows.map((r) => ({ country: r.country, members: r.members, share: total > 0 ? (r.members / total) * 100 : 0 }));
      if (unspecified > 0) {
        mapped.push({ country: "Location not set", members: unspecified, share: total > 0 ? (unspecified / total) * 100 : 0, unspecified: true });
      }
      setCountries(mapped);
    } catch {
      // Leave the panel empty.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchReport(true, controller.signal);
    return () => { controller.abort(); };
  }, [fetchReport]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchCountries(controller.signal);
    return () => { controller.abort(); };
  }, [fetchCountries]);

  // Header refresh: re-pull the report and the country panel without the full-screen loading state.
  // Track the refresh AbortController in a ref so a new refresh (or an unmount) cancels an in-flight one:
  // the initial-load effects already abort on unmount, and this gives the refresh path the same cleanup
  // and stops two rapid refreshes from racing.
  const refreshControllerRef = useRef<AbortController | null>(null);
  const handleRefresh = useCallback(async () => {
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    await Promise.all([fetchReport(false, controller.signal), fetchCountries(controller.signal)]);
  }, [fetchReport, fetchCountries]);
  useEffect(() => () => refreshControllerRef.current?.abort(), []);

  if (loading) return <GdpLoading />;

  const sectors = shapeSourceSectors(report?.sources);
  const metrics: GdpMetrics = shapeLiveGdpMetrics(metricRows, isEstimate);
  // Surface the real number of distinct countries in the hero/sidebar line. The synthetic
  // "Location not set" bucket is not a country, so it is excluded from the count.
  const distinctCountryCount = countries.filter((c) => !c.unspecified).length;
  if (distinctCountryCount > 0) {
    metrics.countries = String(distinctCountryCount);
  }

    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "Inter, system-ui, sans-serif", color: t.TEXT, display: "flex", flexDirection: "column" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            <Globe size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>GDP</span>
            <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>↑ Live</Badge>
            <RefreshButton onRefresh={handleRefresh} title="Refresh" />
            <MobileTopActions />
          </div>
        </div>
        <GdpContent t={t} error={error} report={report} sectors={sectors} countries={countries} metrics={metrics} />
      </div>
    );
}
