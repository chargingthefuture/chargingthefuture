"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { BG, COLOR, GDP_HEADLINE_METRIC_KEY, type GdpMetricRow, type GdpMetrics, type GdpReport, type GdpTab } from "./gdp-shared";
import { GdpLoading } from "./gdp-loading";
import { GdpIconRail } from "./gdp-icon-rail";
import { GdpSidebar } from "./gdp-sidebar";
import { GdpDashboard } from "./gdp-dashboard";
import { GdpMap } from "./gdp-map";

function ShellHeader({ metrics }: { metrics: GdpMetrics }) {
  return (
    <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
      <Globe size={18} style={{ color: COLOR }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>Gross Domestic Product — TI Skills Economy</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>
          {metrics.countries ? `${metrics.countries} countries · ` : ""}{metrics.members ? `${metrics.members} survivors` : "Loading…"}
        </div>
      </div>
      <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>↑ Live</Badge>
    </header>
  );
}

function EmptyReport() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#6B7280" }}>
      <Globe size={48} style={{ color: COLOR, opacity: 0.3 }} />
      <div style={{ fontSize: 16, fontWeight: 600 }}>No GDP report published yet</div>
      <div style={{ fontSize: 13 }}>Check back soon.</div>
    </div>
  );
}

function GdpContent({
  error,
  report,
  tab,
  sectors,
  countries,
  metrics,
}: {
  error: string | null;
  report: GdpReport | null;
  tab: GdpTab;
  sectors: GdpReport["sectors"];
  countries: GdpReport["countries"];
  metrics: GdpMetrics;
}) {
  if (error) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14, padding: 24 }}>{error}</div>;
  }
  if (!report) return <EmptyReport />;
  if (tab === "dashboard") return <GdpDashboard sectors={sectors} countries={countries} metrics={metrics} />;
  return <GdpMap countries={countries} />;
}

// Read the published headline GDP metric off the raw report payload and report
// whether it is flagged a normalized USD estimate. Returns false unless the report
// actually carries that flag, so the estimate treatment only renders where the data
// says it is an estimate. Never inspects per-user figures — only the aggregate metric.
function deriveIsEstimate(rawMetrics: unknown): boolean {
  if (!Array.isArray(rawMetrics)) return false;
  return (rawMetrics as GdpMetricRow[]).some(
    (m) => m && m.metricKey === GDP_HEADLINE_METRIC_KEY && m.isEstimate === true,
  );
}

export default function GdpShell() {
  const [tab, setTab] = useState<GdpTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GdpReport | null>(null);
  const [isEstimate, setIsEstimate] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const controller = new AbortController();
    async function fetchReport() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/gdp/report/current", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load GDP report");
        const data = (await res.json()) as { report?: (GdpReport & { metrics?: unknown }) | null };
        if (!controller.signal.aborted) {
          setReport(data.report ?? null);
          setIsEstimate(deriveIsEstimate(data.report?.metrics));
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

  const sectors = report?.sectors ?? [];
  const countries = report?.countries ?? [];
  const metrics: GdpMetrics = { ...(report?.metrics ?? {}), isEstimate };

  if (isMobile) {
    const tabs: { key: GdpTab; label: string }[] = [
      { key: "dashboard", label: "Dashboard" },
      { key: "map", label: "Map" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "Inter, system-ui, sans-serif", color: "#E8EAF0", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0F14", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${COLOR}14`, border: `1px solid ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", color: COLOR, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Globe size={18} style={{ color: COLOR, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", flex: 1 }}>GDP</span>
            <Badge style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>↑ Live</Badge>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${COLOR}1A` : "transparent", border: `1px solid ${tab === key ? COLOR + "40" : "rgba(255,255,255,0.08)"}`, color: tab === key ? COLOR : "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
        <GdpContent error={error} report={report} tab={tab} sectors={sectors} countries={countries} metrics={metrics} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "Inter, system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <GdpIconRail tab={tab} onTab={setTab} />
      <GdpSidebar metrics={metrics} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ShellHeader metrics={metrics} />
        <GdpContent error={error} report={report} tab={tab} sectors={sectors} countries={countries} metrics={metrics} />
      </div>
    </div>
  );
}
