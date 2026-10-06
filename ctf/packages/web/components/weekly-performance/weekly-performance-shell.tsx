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
import { startVisibleInterval } from "../../lib/shared/visible-interval";
import { responseFailureText } from "lib/errors/client-failure";

type ShellData = {
  weeks: WpWeek[];
  currentWeekStart: string | null;
  initialWeekStart: string | null;
  // Set when the current-week read failed: the picker still works, but the screen cannot tell which
  // week is live, so it does not poll and says why.
  currentWeekNotice: string | null;
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

// What the route said about a failed answer (message, then reason), or a plain note when it said
// nothing. Callers put the status in their own sentence.
function routeReason(res: Response): Promise<string> {
  return responseFailureText(res, "the route gave no reason.", "member");
}

async function readWeekMetrics(
  weekStartDate: string,
): Promise<{ ok: true; metrics: WpMetric[] } | { ok: false; error: string }> {
  const metricsRes = await fetch(`/api/weekly-performance/metrics?weekStartDate=${encodeURIComponent(weekStartDate)}`, { cache: "no-store" });
  if (metricsRes.ok) {
    return { ok: true, metrics: ((await metricsRes.json()) as MetricsResponse).metrics ?? [] };
  }
  // A failed read used to leave the cards empty and the placeholder saying the numbers were
  // loading, which is indistinguishable from a slow read and never resolves. Say what failed
  // instead (rule 137), with the route's own message when it gives one.
  const body = (await metricsRes.json().catch(() => null)) as { message?: string } | null;
  return {
    ok: false,
    error: `Could not load this week's numbers (${metricsRes.status})${body?.message ? `: ${body.message}` : "."}`,
  };
}

// The prior-week comparison. `comparison` is left undefined when nothing should replace what is on
// screen: there is no prior week to compare against, or its read failed.
async function readComparison(
  weekStartDate: string,
  compareWeekStartDate: string | null,
): Promise<{ comparison?: WpComparison | null; notice: string | null }> {
  if (!compareWeekStartDate) return { notice: null };
  const cmpRes = await fetch(`/api/weekly-performance/metrics?weekStartDate=${encodeURIComponent(weekStartDate)}&compareWeekStartDate=${encodeURIComponent(compareWeekStartDate)}`, { cache: "no-store" });
  if (cmpRes.ok) {
    return { comparison: ((await cmpRes.json()) as ComparisonResponse).comparison ?? null, notice: null };
  }
  // Without this the cards read "No prior-week comparison", which says there is no prior data
  // when the read actually failed.
  return { notice: `Could not load the prior week for comparison (${cmpRes.status}): ${await routeReason(cmpRes)}` };
}

async function fetchShellData(): Promise<ShellData> {
  const [weeksRes, currentRes] = await Promise.all([
    fetch("/api/weekly-performance/weeks", { cache: "no-store" }),
    fetch("/api/weekly-performance/current-week", { cache: "no-store" }),
  ]);
  if (!weeksRes.ok) throw new Error(`Failed to load weeks (${weeksRes.status}): ${await routeReason(weeksRes)}`);
  const weeksData = (await weeksRes.json()) as WeeksResponse;
  const currentData = currentRes.ok ? ((await currentRes.json()) as CurrentWeekResponse) : null;
  const currentWeekNotice = currentRes.ok
    ? null
    : `Could not read the current week (${currentRes.status}), so the numbers will not refresh on their own: ${await routeReason(currentRes)}`;
  const currentWeekStart = readCurrentWeekStart(currentData);
  return {
    weeks: weeksData.weeks,
    currentWeekStart,
    initialWeekStart: currentWeekStart ?? weeksData.weeks[0]?.weekStartDate ?? null,
    currentWeekNotice,
  };
}

export function WeeklyPerformanceShell() {
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WpWeek[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<WpMetric[]>([]);
  const [comparison, setComparison] = useState<WpComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True while a week's numbers are being fetched after a week switch, so the empty cards read as
  // loading rather than as a week with no activity.
  const [weekLoading, setWeekLoading] = useState(false);
  const [currentWeekNotice, setCurrentWeekNotice] = useState<string | null>(null);
  const [comparisonNotice, setComparisonNotice] = useState<string | null>(null);
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);

  useEffect(() => {
    let active = true;
    fetchShellData()
      .then((data) => {
        if (!active) return;
        setWeeks(data.weeks);
        setCurrentWeekStart(data.currentWeekStart);
        setSelectedWeekStart(data.initialWeekStart);
        setCurrentWeekNotice(data.currentWeekNotice);
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
      setWeekLoading(true);
    }
    const week = await readWeekMetrics(weekStartDate);
    if (week.ok) {
      setMetrics(week.metrics);
      setError(null);
    } else {
      setError(week.error);
    }
    if (!silent) setWeekLoading(false);
    const prior = await readComparison(weekStartDate, compareWeekStartDate);
    if (prior.comparison !== undefined) setComparison(prior.comparison);
    setComparisonNotice(prior.notice);
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
    // Ticks only while the tab is visible, and refreshes once when it is shown again.
    const stopPoll = startVisibleInterval(refresh, 60_000);
    const onFocus = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      stopPoll();
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
    <>
      {[currentWeekNotice, comparisonNotice].map((notice) =>
        notice ? (
          <div key={notice} role="status" style={{ margin: "12px 24px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", color: "#F87171", fontSize: 13 }}>
            {notice}
          </div>
        ) : null,
      )}
      <WeeklyPerformanceDashboardMain
        week={selectedWeek}
        metrics={metrics}
        comparison={comparison}
        onRefresh={refreshSelectedWeek}
        isCurrent={selectedIsCurrent}
        loading={weekLoading}
      />
    </>
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
