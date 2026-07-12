"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-is-mobile";
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
import { GdpIconRail } from "./gdp-icon-rail";
import { GdpSidebar } from "./gdp-sidebar";
import { GdpDashboard } from "./gdp-dashboard";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";

function ShellHeader({ t, metrics }: { t: GdpTokens; metrics: GdpMetrics }) {
  return (
    <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
      <Globe size={18} style={{ color: t.ACCENT }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT }}>Gross Domestic Product — TI Skills Economy</div>
        <div style={{ fontSize: 12, color: t.MUTED }}>
          {metrics.countries ? `${metrics.countries} countries · ` : ""}{metrics.members ? `${metrics.members} survivors` : "Loading…"}
        </div>
      </div>
      <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>↑ Live</Badge>
    </header>
  );
}

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
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getGdpTokens(theme);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchReport() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/gdp/report/current", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load GDP report");
        const data = (await res.json()) as { report?: GdpReportPayload | null };
        if (!controller.signal.aborted) {
          setReport(data.report ?? null);
          setIsEstimate(deriveIsEstimate(data.report?.metrics));
          setMetricRows(Array.isArray(data.report?.metrics) ? data.report.metrics : []);
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load GDP data.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void fetchReport();
    return () => { controller.abort(); };
  }, []);

  // Load the real per-country member distribution for the "All Countries" panel. Independent of the
  // main report (a failure here just leaves the panel empty; it never blocks the dashboard).
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/gdp/countries", { signal: controller.signal });
        if (!res.ok || controller.signal.aborted) return;
        const data = (await res.json()) as { countries?: Array<{ country: string; members: number }>; totalMembers?: number };
        const rows = data.countries ?? [];
        const total = data.totalMembers ?? rows.reduce((sum, r) => sum + r.members, 0);
        if (controller.signal.aborted) return;
        setCountries(rows.map((r) => ({ country: r.country, members: r.members, share: total > 0 ? (r.members / total) * 100 : 0 })));
      } catch {
        // Leave the panel empty.
      }
    })();
    return () => { controller.abort(); };
  }, []);

  if (loading) return <GdpLoading />;

  const sectors = shapeSourceSectors(report?.sources);
  const metrics: GdpMetrics = shapeLiveGdpMetrics(metricRows, isEstimate);
  // Surface the real number of countries with located members in the hero/sidebar line.
  if (countries.length > 0) {
    metrics.countries = String(countries.length);
  }

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "Inter, system-ui, sans-serif", color: t.TEXT, display: "flex", flexDirection: "column" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Globe size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>GDP</span>
            <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>↑ Live</Badge>
            <MobileTopActions />
          </div>
        </div>
        <GdpContent t={t} error={error} report={report} sectors={sectors} countries={countries} metrics={metrics} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden", background: t.BG, fontFamily: "Inter, system-ui, sans-serif", color: t.TEXT, display: "flex" }}>
      <GdpIconRail />
      <GdpSidebar metrics={metrics} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <ShellHeader t={t} metrics={metrics} />
        <GdpContent t={t} error={error} report={report} sectors={sectors} countries={countries} metrics={metrics} />
      </div>
    </div>
  );
}
