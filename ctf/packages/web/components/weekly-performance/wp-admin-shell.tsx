"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart2, ChevronLeft, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { MobileScreenHeader } from "@/components/shared/mobile-screen-header";
import {
  BG,
  BORDER,
  BRAND,
  SUBTLE,
  SURFACE,
  TEXT,
  formatMetricValue,
  formatWeekRange,
  humanizeMetricKey,
  type CurrentWeekResponse,
  type MetricsResponse,
  type WeekSelectionResponse,
  type WeeksResponse,
  type WpMetric,
  type WpWeek,
} from "./wp-shared";

// Web admin surface for Weekly Performance.
// Real endpoints only (rule 126):
//   GET  /api/weekly-performance/weeks          — tracked weeks
//   GET  /api/weekly-performance/current-week    — current week + active-user count
//   GET  /api/weekly-performance/metrics         — metrics for a week
//   PUT  /api/weekly-performance/admin/week-selection (CSRF) — mark a week active
//   GET  /api/weekly-performance/export          — export gate (admin, env-flagged)

type Feedback = { kind: "success" | "error"; text: string } | null;

function statusColor(status: WpWeek["status"]): string {
  if (status === "open") return "#22C55E";
  if (status === "published") return "#06B6D4";
  return SUBTLE;
}

export function WeeklyPerformanceAdminShell() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WpWeek[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<string | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<WpMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [selecting, setSelecting] = useState(false);

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

  async function selectActiveWeek() {
    if (!selectedWeekStart || selecting) return;
    setSelecting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/weekly-performance/admin/week-selection", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ weekStartDate: selectedWeekStart }),
      });
      const data = (await res.json()) as WeekSelectionResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Could not set the active week.");
      }
      setFeedback({ kind: "success", text: `Active week set to ${data.selectedWeek ? formatWeekRange(data.selectedWeek) : selectedWeekStart}.` });
      await loadWeeks();
    } catch (e) {
      setFeedback({ kind: "error", text: e instanceof Error ? e.message : "Could not set the active week." });
    } finally {
      setSelecting(false);
    }
  }

  function exportSelected() {
    if (selectedWeekStart) {
      window.open(`/api/weekly-performance/export?weekStartDate=${encodeURIComponent(selectedWeekStart)}`, "_blank");
    }
  }

  const cardStyle: React.CSSProperties = {
    padding: 16,
    borderRadius: 12,
    background: SURFACE,
    border: `1px solid ${BORDER}`,
  };

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <Link
        href="/apps/weekly-performance"
        aria-label="Back to plugin"
        style={{ width: 38, height: 38, borderRadius: 10, background: `${BRAND}15`, border: `1px solid ${BRAND}30`, display: "flex", alignItems: "center", justifyContent: "center", color: BRAND, textDecoration: "none", flexShrink: 0 }}
      >
        <ChevronLeft size={20} />
      </Link>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${BRAND}20`, border: `1px solid ${BRAND}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <BarChart2 size={18} color={BRAND} />
      </div>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, margin: 0, color: TEXT }}>Weekly Performance Admin</h1>
        <div style={{ fontSize: 12, color: SUBTLE }}>Set the active week and review its metrics.</div>
      </div>
      <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 11, color: "#818CF8", fontWeight: 700, flexShrink: 0 }}>ADMIN</span>
    </div>
  );

  let body: React.ReactNode;
  if (loading) {
    body = <div style={{ ...cardStyle, color: SUBTLE, fontSize: 13 }}>Loading weeks…</div>;
  } else if (loadError) {
    body = <div style={{ ...cardStyle, color: "#F87171", fontSize: 13 }}>{loadError}</div>;
  } else if (weeks.length === 0) {
    body = <div style={{ ...cardStyle, color: SUBTLE, fontSize: 13 }}>No weeks are tracked yet. Weeks appear once upstream metrics are recorded.</div>;
  } else {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Week selection control */}
        <section style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: TEXT }}>Active week</div>
          <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 12 }}>
            Current week: {currentWeekStart ? currentWeekStart : "not set"}. Tracked weeks: {weeks.length}.
          </div>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, alignItems: isMobile ? "stretch" : "center" }}>
            <select
              value={selectedWeekStart ?? ""}
              onChange={(e) => {
                setSelectedWeekStart(e.target.value);
                setFeedback(null);
              }}
              style={{ flex: 1, padding: "9px 11px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13 }}
            >
              {weeks.map((w) => (
                <option key={w.weekStartDate} value={w.weekStartDate}>
                  {formatWeekRange(w)} · {w.status}
                  {w.weekStartDate === currentWeekStart ? " (current)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => void selectActiveWeek()}
              disabled={selecting || !selectedWeekStart}
              style={{ padding: "9px 16px", borderRadius: 8, background: selecting ? `${BRAND}60` : BRAND, border: "none", color: "#0F1117", fontSize: 13, fontWeight: 700, cursor: selecting ? "default" : "pointer", flexShrink: 0 }}
            >
              {selecting ? "Setting…" : "Set as active week"}
            </button>
          </div>
          {feedback && (
            <div style={{ marginTop: 10, fontSize: 12, color: feedback.kind === "success" ? "#22C55E" : "#F87171" }}>{feedback.text}</div>
          )}
        </section>

        {/* Selected week summary + export */}
        {selectedWeek && (
          <section style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{formatWeekRange(selectedWeek)}</div>
                <div style={{ fontSize: 12, color: statusColor(selectedWeek.status), fontWeight: 600, textTransform: "capitalize" }}>{selectedWeek.status}</div>
              </div>
              <button
                onClick={exportSelected}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, background: `${BRAND}15`, border: `1px solid ${BRAND}30`, color: BRAND, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              >
                <Download size={14} />
                Export
              </button>
            </div>
            {metricsLoading ? (
              <div style={{ fontSize: 13, color: SUBTLE }}>Loading metrics…</div>
            ) : metrics.length === 0 ? (
              <div style={{ fontSize: 13, color: SUBTLE }}>No metrics recorded for this week yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {metrics.map((m) => (
                  <div key={m.metricKey} style={{ padding: "12px 14px", borderRadius: 10, background: BG, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 4 }}>{humanizeMetricKey(m.metricKey)}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: BRAND }}>{formatMetricValue(m.metricValue, m.metricUnit)}</div>
                    <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>{m.sourcePlugin}</div>
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
        background: BG,
        color: TEXT,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: isMobile ? 16 : 32,
      }}
    >
      <MobileScreenHeader title="Weekly Performance Admin" accent={BRAND} icon={<BarChart2 size={18} color={BRAND} />} />
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {header}
        {body}
      </div>
    </main>
  );
}
