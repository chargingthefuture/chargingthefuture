"use client";

import { useCallback, useEffect, useState } from "react";
import { BackChevronButton } from "@/lib/nav/back-history";
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
  formatWeekRange,
  isCurrentWeek,
} from "./wp-shared";
import { WeeklyPerformanceLoading } from "./wp-loading";
import { WeeklyPerformanceDashboardMain } from "./wp-dashboard-main";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

type ShellData = {
  weeks: WpWeek[];
  activeUsers: number | null;
  currentWeekStart: string | null;
  initialWeekStart: string | null;
};

function priorWeekStart(weeks: WpWeek[], selected: string | null): string | null {
  if (!selected) return null;
  const sorted = [...weeks].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  const index = sorted.findIndex((w) => w.weekStartDate === selected);
  if (index < 0 || index + 1 >= sorted.length) return null;
  return sorted[index + 1].weekStartDate;
}

function readCurrentWeekStart(currentData: CurrentWeekResponse | null): string | null {
  return currentData?.currentWeek?.weekStartDate ?? null;
}

async function fetchShellData(): Promise<ShellData> {
  const [weeksRes, currentRes] = await Promise.all([
    fetch("/api/weekly-performance/weeks", { cache: "no-store" }),
    fetch("/api/weekly-performance/current-week", { cache: "no-store" }),
  ]);
  if (!weeksRes.ok) throw new Error("Failed to load weeks.");
  const weeksData = (await weeksRes.json()) as WeeksResponse;
  const currentData = currentRes.ok ? ((await currentRes.json()) as CurrentWeekResponse) : null;
  const currentWeekStart = readCurrentWeekStart(currentData);
  return {
    weeks: weeksData.weeks,
    activeUsers: currentData?.activeUsersLast7Days ?? null,
    currentWeekStart,
    initialWeekStart: currentWeekStart ?? weeksData.weeks[0]?.weekStartDate ?? null,
  };
}

export function WeeklyPerformanceShell() {
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WpWeek[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<string | null>(null);
  const [, setActiveUsers] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<WpMetric[]>([]);
  const [comparison, setComparison] = useState<WpComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);

  useEffect(() => {
    let active = true;
    fetchShellData()
      .then((data) => {
        if (!active) return;
        setWeeks(data.weeks);
        setActiveUsers(data.activeUsers);
        setCurrentWeekStart(data.currentWeekStart);
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

  const loadWeekData = useCallback(async (weekStartDate: string, compareWeekStartDate: string | null, silent = false) => {
    // A silent refresh (current-week polling / focus refetch) keeps the numbers on screen
    // and swaps them in place; a week switch clears first so last week's cards don't linger.
    if (!silent) {
      setMetrics([]);
      setComparison(null);
    }
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

  // The current week's numbers are computed live, so keep them moving: re-fetch on a 60s
  // interval and whenever the tab regains focus, but only for the current week — past weeks are
  // settled historical windows and never change. Refreshes are silent (no flash to the empty state).
  const selectedIsCurrent = isCurrentWeek(selectedWeekStart, currentWeekStart);
  useEffect(() => {
    if (!selectedWeekStart || !selectedIsCurrent) return;
    const compare = priorWeekStart(weeks, selectedWeekStart);
    const refresh = () => { void loadWeekData(selectedWeekStart, compare, true); };
    const interval = window.setInterval(refresh, 60_000);
    const onFocus = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [selectedWeekStart, selectedIsCurrent, weeks, loadWeekData]);

  // Manual refresh (header button): silent re-pull of the selected week's numbers,
  // keeping the cards on screen instead of flashing the empty state.
  const refreshSelectedWeek = useCallback(async () => {
    if (!selectedWeekStart) return;
    await loadWeekData(selectedWeekStart, priorWeekStart(weeks, selectedWeekStart), true);
  }, [selectedWeekStart, weeks, loadWeekData]);

  if (loading) return <WeeklyPerformanceLoading />;

  const selectedWeek = weeks.find((w) => w.weekStartDate === selectedWeekStart) ?? null;

  const content = error ? (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#F87171", fontSize: 14, padding: 24 }}>{error}</div>
  ) : (
    <WeeklyPerformanceDashboardMain
      week={selectedWeek}
      metrics={metrics}
      comparison={comparison}
      onRefresh={refreshSelectedWeek}
      isCurrent={selectedIsCurrent}
    />
  );

    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
            <BackChevronButton style={{ background: t.BTN_BG, border: `1px solid ${t.BORDER_HI}`, color: t.TITLE }} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Weekly Performance</span>
            <RefreshButton onRefresh={refreshSelectedWeek} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ display: "flex", gap: 8, padding: "0 12px 10px" }}>
            <select value={selectedWeekStart ?? ""} onChange={(e) => setSelectedWeekStart(e.target.value)} style={{ flex: 1, padding: "8px 10px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_HI}`, borderRadius: 8, color: t.TEXT, fontSize: 13 }}>
              {weeks.map((w) => (
                <option key={w.weekStartDate} value={w.weekStartDate}>Week of {formatWeekRange(w)}</option>
              ))}
            </select>
          </div>
        </div>
        {content}
      </div>
    );

}
