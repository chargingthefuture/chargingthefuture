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
  type GdpTab,
  type GdpTokens,
} from "./gdp-shared";
import { GdpLoading } from "./gdp-loading";
import { GdpIconRail } from "./gdp-icon-rail";
import { GdpSidebar } from "./gdp-sidebar";
import { GdpDashboard } from "./gdp-dashboard";
import { GdpMap } from "./gdp-map";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";

function ShellHeader({ t, metrics, isAdmin }: { t: GdpTokens; metrics: GdpMetrics; isAdmin?: boolean }) {
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
      <PluginAdminButton href="/admin/gdp" isAdmin={isAdmin} accent={t.ACCENT} />
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
  tab,
  sectors,
  countries,
  metrics,
  metricRows,
}: {
  t: GdpTokens;
  error: string | null;
  report: GdpReportPayload | null;
  tab: GdpTab;
  sectors: GdpSector[];
  countries: GdpCountry[];
  metrics: GdpMetrics;
  metricRows: GdpMetricRow[];
}) {
  if (error) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14, padding: 24 }}>{error}</div>;
  }
  if (!report) return <EmptyReport t={t} />;
  if (tab === "dashboard") return <GdpDashboard sectors={sectors} countries={countries} metrics={metrics} />;
  return <GdpMap metricRows={metricRows} />;
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

export default function GdpShell({ isAdmin }: { isAdmin?: boolean } = {}) {
  const [tab, setTab] = useState<GdpTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GdpReportPayload | null>(null);
  const [isEstimate, setIsEstimate] = useState(false);
  // Raw per-metric rows from the report payload. Kept separately from the shaped
  // GdpMetrics so the world map can read the real community-wide aggregates
  // (gdp_value_index, weekly_active_users) by key. No per-country data exists.
  const [metricRows, setMetricRows] = useState<GdpMetricRow[]>([]);
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

  if (loading) return <GdpLoading />;

  const sectors = shapeSourceSectors(report?.sources);
  const countries: GdpCountry[] = [];
  const metrics: GdpMetrics = shapeLiveGdpMetrics(metricRows, isEstimate);

  if (isMobile) {
    const tabs: { key: GdpTab; label: string }[] = [
      { key: "dashboard", label: "Dashboard" },
      { key: "map", label: "Map" },
    ];
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
            <PluginAdminButton href="/admin/gdp" isAdmin={isAdmin} accent={t.ACCENT} />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${tab === key ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
        <GdpContent t={t} error={error} report={report} tab={tab} sectors={sectors} countries={countries} metrics={metrics} metricRows={metricRows} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden", background: t.BG, fontFamily: "Inter, system-ui, sans-serif", color: t.TEXT, display: "flex" }}>
      <GdpIconRail tab={tab} onTab={setTab} />
      <GdpSidebar metrics={metrics} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <ShellHeader t={t} metrics={metrics} isAdmin={isAdmin} />
        <GdpContent t={t} error={error} report={report} tab={tab} sectors={sectors} countries={countries} metrics={metrics} metricRows={metricRows} />
      </div>
    </div>
  );
}
