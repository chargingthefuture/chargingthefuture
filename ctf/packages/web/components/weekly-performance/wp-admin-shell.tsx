"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart2, ChevronLeft, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { MobileScreenHeader } from "@/components/shared/mobile-screen-header";
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import {
  getWeeklyPerformanceTokens,
  formatMetricValue,
  formatWeekRange,
  humanizeMetricKey,
  isCurrentWeek,
  type CurrentWeekResponse,
  type MetricsResponse,
  type WeeksResponse,
  type WpMetric,
  type WpWeek,
} from "./wp-shared";

// Web admin surface for Weekly Performance.
// Real endpoints only (rule 126):
//   GET  /api/weekly-performance/weeks          — tracked weeks
//   GET  /api/weekly-performance/current-week    — current week + active-user count
//   GET  /api/weekly-performance/metrics         — metrics for a week
//   GET  /api/weekly-performance/export          — export gate (admin, env-flagged)
//
// Numbers are always live (there is no "close the week" step), so the admin surface is a read/review
// tool: pick a week, see its live metrics, export. It does not mark a week "active".

export function WeeklyPerformanceAdminShell() {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WpWeek[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<string | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<WpMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWeeks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [weeksRes, currentRes] = await Promise.all([
        fetch("/api/weekly-performance/weeks", { cache: "no-store" }),
        fetch("/api/weekly-performance/current-week", { cache: "no-store" }),
      ]);
      if (!weeksRes.ok) throw new Error("Could not load tracked weeks.");
      const weeksData = (await weeksRes.json()) as WeeksResponse;
      const currentData = currentRes.ok ? ((await currentRes.json()) as CurrentWeekResponse) : null;
      const current = currentData?.currentWeek?.weekStartDate ?? null;
      setWeeks(weeksData.weeks);
      setCurrentWeekStart(current);
      setSelectedWeekStart((prev) => prev ?? current ?? weeksData.weeks[0]?.weekStartDate ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load Weekly Performance admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWeeks();
  }, [loadWeeks]);

  useEffect(() => {
    if (!selectedWeekStart) {
      setMetrics([]);
      return;
    }
    let active = true;
    setMetricsLoading(true);
    fetch(`/api/weekly-performance/metrics?weekStartDate=${encodeURIComponent(selectedWeekStart)}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<MetricsResponse>) : Promise.resolve({ ok: false, metrics: [] } as MetricsResponse)))
      .then((data) => {
        if (active) setMetrics(data.metrics ?? []);
      })
      .catch(() => {
        if (active) setMetrics([]);
      })
      .finally(() => {
        if (active) setMetricsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedWeekStart]);

  const selectedWeek = weeks.find((w) => w.weekStartDate === selectedWeekStart) ?? null;
  const selectedIsCurrent = isCurrentWeek(selectedWeekStart, currentWeekStart);

  function exportSelected() {
    if (selectedWeekStart) {
      window.open(`/api/weekly-performance/export?weekStartDate=${encodeURIComponent(selectedWeekStart)}`, "_blank");
    }
  }

  const cardStyle: React.CSSProperties = {
    padding: 16,
    borderRadius: 12,
    background: t.SURFACE,
    border: `1px solid ${t.BORDER_SOLID}`,
  };

  // Desktop-only header. On mobile, MobileScreenHeader (below) already renders the back button,
  // brand icon, and title, so rendering this too would duplicate the header.
  const header = isMobile ? null : (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <Link
        href="/admin"
        aria-label="Back to admin"
        style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none", flexShrink: 0 }}
      >
        <ChevronLeft size={20} />
      </Link>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <BarChart2 size={18} color={t.ACCENT} />
      </div>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: t.TITLE }}>Weekly Performance Admin</h1>
        <div style={{ fontSize: 12, color: t.MUTED }}>Review weekly metrics and export.</div>
      </div>
      <PluginUserShellButton href="/apps/weekly-performance" accent={t.ACCENT} />
      <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 11, color: "#818CF8", fontWeight: 700, flexShrink: 0 }}>ADMIN</span>
    </div>
  );

  let body: React.ReactNode;
  if (loading) {
    body = <div style={{ ...cardStyle, color: t.MUTED, fontSize: 13 }}>Loading weeks…</div>;
  } else if (loadError) {
    body = <div style={{ ...cardStyle, color: "#F87171", fontSize: 13 }}>{loadError}</div>;
  } else if (weeks.length === 0) {
    body = <div style={{ ...cardStyle, color: t.MUTED, fontSize: 13 }}>No weeks are tracked yet. Weeks appear once upstream metrics are recorded.</div>;
  } else {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Review-week picker. Numbers are always live, so this only chooses which week to review and
            export — it does not mark a week "active". */}
        <section style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: t.TITLE }}>Review week</div>
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 12 }}>
            Current week: {currentWeekStart ? currentWeekStart : "not set"}. Tracked weeks: {weeks.length}.
          </div>
          <select
            value={selectedWeekStart ?? ""}
            onChange={(e) => setSelectedWeekStart(e.target.value)}
            style={{ width: "100%", padding: "9px 11px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 8, color: t.TITLE, fontSize: 13 }}
          >
            {weeks.map((w) => (
              <option key={w.weekStartDate} value={w.weekStartDate}>
                {formatWeekRange(w)}
                {w.weekStartDate === currentWeekStart ? " (current · live)" : ""}
              </option>
            ))}
          </select>
        </section>

        {/* Selected week summary + export */}
        {selectedWeek && (
          <section style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>{formatWeekRange(selectedWeek)}</div>
                {selectedIsCurrent && (
                  <div style={{ fontSize: 12, color: "#22C55E", fontWeight: 600 }}>Live</div>
                )}
              </div>
              <button
                onClick={exportSelected}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              >
                <Download size={14} />
                Export
              </button>
            </div>
            {metricsLoading ? (
              <div style={{ fontSize: 13, color: t.MUTED }}>Loading metrics…</div>
            ) : metrics.length === 0 ? (
              <div style={{ fontSize: 13, color: t.MUTED }}>No metric data available for this week.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {metrics.map((m) => (
                  <div key={m.metricKey} style={{ padding: "12px 14px", borderRadius: 10, background: t.BG, border: `1px solid ${t.BORDER_SOLID}` }}>
                    <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 4 }}>{humanizeMetricKey(m.metricKey)}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: t.ACCENT }}>{formatMetricValue(m.metricValue, m.metricUnit)}</div>
                    <div style={{ fontSize: 10, color: t.MUTED, marginTop: 2 }}>{m.sourcePlugin}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <main
      style={{
        // Mobile relies on the document scrolling, so keep minHeight there. On
        // desktop the document is locked (globals.css), so bound this surface to
        // one viewport and let it scroll its own content.
        ...(isMobile ? { minHeight: "100vh" } : { height: "100dvh", overflowY: "auto" }),
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: isMobile ? 16 : 32,
      }}
    >
      {/* This shell renders its own desktop header (with a back chevron) above, so the shared header
          only supplies the mobile bar here — opt out of its desktop back to avoid a duplicate. */}
      <MobileScreenHeader title="Weekly Performance Admin" accent={t.ACCENT} icon={<BarChart2 size={18} color={t.ACCENT} />} desktopBack={false} actions={<PluginUserShellButton href="/apps/weekly-performance" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {header}
        {body}
      </div>
    </main>
  );
}
