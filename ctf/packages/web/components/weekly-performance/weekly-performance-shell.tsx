"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import {
  getWeeklyPerformanceTokens,
  type ComparisonResponse,
  type CurrentWeekResponse,
  type MetricsResponse,
  type WeeksResponse,
  type WpComparison,
  type WpMetric,
  type WpWeek,
} from "./wp-shared";
import { WeeklyPerformanceLoading } from "./wp-loading";
import { WeeklyPerformanceIconRail } from "./wp-icon-rail";
import { WeeklyPerformanceSidebar } from "./wp-sidebar";
import { WeeklyPerformanceDashboardMain } from "./wp-dashboard-main";
import { WeeklyPerformanceRightRail } from "./wp-right-rail";

type WeeklyPerformanceShellProps = {
  isAdmin: boolean;
};

type ShellData = {
  weeks: WpWeek[];
  activeUsers: number | null;
  initialWeekStart: string | null;
};

function priorWeekStart(weeks: WpWeek[], selected: string | null): string | null {
  if (!selected) return null;
  const sorted = [...weeks].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  const index = sorted.findIndex((w) => w.weekStartDate === selected);
  if (index < 0 || index + 1 >= sorted.length) return null;
  return sorted[index + 1].weekStartDate;
}

async function fetchShellData(): Promise<ShellData> {
  const [weeksRes, currentRes] = await Promise.all([
    fetch("/api/weekly-performance/weeks", { cache: "no-store" }),
    fetch("/api/weekly-performance/current-week", { cache: "no-store" }),
  ]);
  if (!weeksRes.ok) throw new Error("Failed to load weeks.");
  const weeksData = (await weeksRes.json()) as WeeksResponse;
  const currentData = currentRes.ok ? ((await currentRes.json()) as CurrentWeekResponse) : null;
  return {
    weeks: weeksData.weeks,
    activeUsers: currentData?.activeUsersLast7Days ?? null,
    initialWeekStart: currentData?.currentWeek?.weekStartDate ?? weeksData.weeks[0]?.weekStartDate ?? null,
  };
}

export function WeeklyPerformanceShell({ isAdmin }: WeeklyPerformanceShellProps) {
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WpWeek[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<WpMetric[]>([]);
  const [comparison, setComparison] = useState<WpComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);

  useEffect(() => {
    let active = true;
    fetchShellData()
      .then((data) => {
        if (!active) return;
        setWeeks(data.weeks);
        setActiveUsers(data.activeUsers);
        setSelectedWeekStart(data.initialWeekStart);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Failed to load Weekly Performance.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const loadWeekData = useCallback(async (weekStartDate: string, compareWeekStartDate: string | null) => {
    setMetrics([]);
    setComparison(null);
    const metricsRes = await fetch(`/api/weekly-performance/metrics?weekStartDate=${encodeURIComponent(weekStartDate)}`, { cache: "no-store" });
    if (metricsRes.ok) {
      setMetrics(((await metricsRes.json()) as MetricsResponse).metrics ?? []);
    }
    if (compareWeekStartDate) {
      const cmpRes = await fetch(`/api/weekly-performance/metrics?weekStartDate=${encodeURIComponent(weekStartDate)}&compareWeekStartDate=${encodeURIComponent(compareWeekStartDate)}`, { cache: "no-store" });
      if (cmpRes.ok) {
        setComparison(((await cmpRes.json()) as ComparisonResponse).comparison ?? null);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedWeekStart) return;
    void loadWeekData(selectedWeekStart, priorWeekStart(weeks, selectedWeekStart));
  }, [selectedWeekStart, weeks, loadWeekData]);

  if (loading) return <WeeklyPerformanceLoading />;

  const selectedWeek = weeks.find((w) => w.weekStartDate === selectedWeekStart) ?? null;

  function exportSelected() {
    if (selectedWeekStart) {
      window.open(`/api/weekly-performance/export?weekStartDate=${encodeURIComponent(selectedWeekStart)}`, "_blank");
    }
  }

  const content = error ? (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#F87171", fontSize: 14, padding: 24 }}>{error}</div>
  ) : (
    <WeeklyPerformanceDashboardMain
      week={selectedWeek}
      metrics={metrics}
      comparison={comparison}
      isAdmin={isAdmin}
      onExport={exportSelected}
      isMobile={isMobile}
    />
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: t.BTN_BG, border: `1px solid ${t.BORDER_HI}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.TITLE, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>Weekly Performance</span>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "0 12px 10px" }}>
            <select value={selectedWeekStart ?? ""} onChange={(e) => setSelectedWeekStart(e.target.value)} style={{ flex: 1, padding: "8px 10px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_HI}`, borderRadius: 8, color: t.TEXT, fontSize: 13 }}>
              {weeks.map((w) => (
                <option key={w.weekStartDate} value={w.weekStartDate}>Week of {w.weekStartDate}</option>
              ))}
            </select>
            {isAdmin && (
              <button onClick={exportSelected} style={{ padding: "8px 14px", borderRadius: 8, background: t.BTN_BG, border: `1px solid ${t.BORDER_HI}`, color: t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Export</button>
            )}
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100dvh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE, overflow: "hidden" }}>
      <WeeklyPerformanceIconRail />
      <WeeklyPerformanceSidebar
        weeks={weeks}
        selectedWeekStart={selectedWeekStart}
        onSelect={setSelectedWeekStart}
        isAdmin={isAdmin}
        onExport={exportSelected}
      />
      {content}
      <WeeklyPerformanceRightRail
        week={selectedWeek}
        metricCount={metrics.length}
        activeUsersLast7Days={activeUsers}
        isAdmin={isAdmin}
      />
    </div>
  );
}
