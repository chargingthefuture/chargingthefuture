"use client";

import { useState, useEffect } from "react";
import {
  BarChart2, Bell, Settings, TrendingUp,
  Download, Lock, Calendar, CheckCircle,
} from "lucide-react";

// API: GET /api/weekly-performance/weeks  → weeks[]
// API: GET /api/weekly-performance/metrics?weekStartDate=…  → metrics[]
// API: GET /api/weekly-performance/export?weekStartDate=…  (admin)
// API: POST /api/weekly-performance/admin/week-selection  (admin)

const BRAND = "#F59E0B";
const bg = "#0F1117";
const surface = "#161B27";
const border = "#1E2A3A";
const textColor = "#F9FAFB";
const subtle = "#6B7280";

type Week = {
  weekStartDate: string;
  weekEndDate: string;
  status: "open" | "locked" | "published";
};

type Metric = {
  metricKey: string;
  metricValue: number;
  metricUnit: string;
  sourcePlugin: string;
};

type Props = {
  initialWeeks: Week[];
  initialMetrics: Metric[];
  isAdmin: boolean;
};

function formatWeekLabel(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[start.getUTCMonth()]} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
}

const METRIC_DISPLAY: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  total_members: { label: "Total Members", color: "#A78BFA", icon: TrendingUp },
  new_signups: { label: "New Sign-ups", color: "#22C55E", icon: TrendingUp },
  plugin_engagements: { label: "Plugin Engagements", color: BRAND, icon: BarChart2 },
  gdp_delta: { label: "GDP Delta", color: "#06B6D4", icon: TrendingUp },
};

export function WeeklyPerformanceBrowser({ initialWeeks, initialMetrics, isAdmin }: Props) {
  const [weeks] = useState<Week[]>(initialWeeks);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics);
  const [loading, setLoading] = useState(false);

  const selectedWeek = weeks[selectedIdx];

  useEffect(() => {
    if (!selectedWeek) return;
    if (selectedIdx === 0) {
      setMetrics(initialMetrics);
      return;
    }
    setLoading(true);
    fetch(`/api/weekly-performance/metrics?weekStartDate=${selectedWeek.weekStartDate}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setMetrics(d.metrics ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedIdx, selectedWeek, initialMetrics]);

  const isLive = selectedWeek?.status === "open";

  const handleExport = async () => {
    window.open(`/api/weekly-performance/export?weekStartDate=${selectedWeek?.weekStartDate}`, "_blank");
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: bg, fontFamily: "'Inter', system-ui, sans-serif", color: textColor, overflow: "hidden" }}>

      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <BarChart2 size={20} color={BRAND} />
        </div>
        {[BarChart2, TrendingUp, Calendar].map((Icon, i) => (
          <button key={i} style={{ width: 44, height: 44, borderRadius: 12, background: i === 0 ? `${BRAND}20` : "transparent", border: i === 0 ? `1px solid ${BRAND}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: i === 0 ? BRAND : subtle }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: subtle }}><Bell size={18} /></button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: subtle }}><Settings size={18} /></button>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${BRAND}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: BRAND }}>S</div>
      </aside>

      {/* Week sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: subtle, textTransform: "uppercase", marginBottom: 4 }}>📊 Weekly Performance</div>
          <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5 }}>Week-over-week platform metrics</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#374151", textTransform: "uppercase", padding: "4px 10px 8px" }}>Week History</div>
          {weeks.length === 0 && (
            <div style={{ fontSize: 12, color: subtle, padding: "8px 10px" }}>No weeks recorded yet.</div>
          )}
          {weeks.map(({ weekStartDate, weekEndDate, status }, i) => (
            <button key={weekStartDate} onClick={() => setSelectedIdx(i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, cursor: "pointer", background: selectedIdx === i ? `${BRAND}18` : "transparent", borderLeft: selectedIdx === i ? `2px solid ${BRAND}` : "2px solid transparent", marginLeft: 2, marginBottom: 2, border: "none", textAlign: "left" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: selectedIdx === i ? textColor : "#9CA3AF", fontWeight: selectedIdx === i ? 600 : 400 }}>{formatWeekLabel(weekStartDate, weekEndDate)}</div>
              </div>
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: status === "open" ? `${BRAND}20` : "rgba(255,255,255,0.05)", color: status === "open" ? BRAND : subtle, fontWeight: 600 }}>
                {status === "open" ? "LIVE" : status === "locked" ? "Locked" : "Published"}
              </span>
            </button>
          ))}
        </div>
        {isAdmin && (
          <div style={{ padding: 12, borderTop: `1px solid ${border}` }}>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: `${BRAND}08`, border: `1px solid ${BRAND}20` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND, marginBottom: 6 }}>Admin Controls</div>
              <button style={{ width: "100%", padding: "7px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, color: textColor, fontSize: 11, cursor: "pointer", marginBottom: 5, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <Lock size={11} /> Lock Week
              </button>
              <button onClick={handleExport} style={{ width: "100%", padding: "7px", borderRadius: 7, background: `${BRAND}15`, border: `1px solid ${BRAND}30`, color: BRAND, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <Download size={11} /> Export CSV
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <BarChart2 size={18} color={BRAND} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>
              {selectedWeek ? `Week of ${formatWeekLabel(selectedWeek.weekStartDate, selectedWeek.weekEndDate)}` : "No weeks"}
            </div>
            <div style={{ fontSize: 12, color: subtle }}>Non-financial platform metrics</div>
          </div>
          {selectedWeek && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: isLive ? `${BRAND}15` : "rgba(255,255,255,0.05)", border: `1px solid ${isLive ? BRAND + "40" : border}`, fontSize: 11, fontWeight: 600, color: isLive ? BRAND : subtle }}>
              {isLive ? "● In Progress" : <><CheckCircle size={11} style={{ marginRight: 4 }} />Closed</>}
            </div>
          )}
          {isAdmin && selectedWeek && (
            <button onClick={handleExport} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${BRAND}15`, border: `1px solid ${BRAND}30`, color: BRAND, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Download size={14} /> Export
            </button>
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px", opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
          {/* Metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            {metrics.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: "24px", textAlign: "center", fontSize: 13, color: subtle }}>No metrics recorded for this week.</div>
            ) : metrics.map(({ metricKey, metricValue, metricUnit }) => {
              const display = METRIC_DISPLAY[metricKey];
              const color = display?.color ?? BRAND;
              const label = display?.label ?? metricKey.replace(/_/g, " ");
              const Icon = display?.icon ?? TrendingUp;
              return (
                <div key={metricKey} style={{ padding: "18px 16px", borderRadius: 14, background: surface, border: `1px solid ${color}20` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: subtle }}>{label}</span>
                    <Icon size={14} color={color} />
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>
                    {metricUnit === "$" ? `$${metricValue.toLocaleString()}` : metricValue.toLocaleString()}
                    {metricUnit && metricUnit !== "$" ? <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{metricUnit}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bar chart placeholder — data shape depends on daily breakdown endpoint */}
          <div style={{ padding: "20px 24px", borderRadius: 16, background: surface, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: textColor, marginBottom: 8 }}>Plugin Engagements — Daily</div>
            <div style={{ fontSize: 12, color: subtle }}>Daily breakdown available when metrics include per-day source_plugin data.</div>
          </div>
        </div>
      </div>

      {/* Right rail */}
      <aside style={{ width: 280, borderLeft: `1px solid ${border}`, background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Week Summary</div>
        {selectedWeek && (
          <div style={{ padding: "16px", borderRadius: 14, background: `${BRAND}08`, border: `1px solid ${BRAND}20`, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <BarChart2 size={14} color={BRAND} />
              <span style={{ fontSize: 13, fontWeight: 600, color: BRAND }}>{formatWeekLabel(selectedWeek.weekStartDate, selectedWeek.weekEndDate)}</span>
            </div>
            {[
              { k: "Status", v: selectedWeek.status === "open" ? "In Progress" : selectedWeek.status === "locked" ? "Locked" : "Published" },
              { k: "Metrics", v: String(metrics.length) },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: subtle }}>{k}</span>
                <span style={{ color: textColor, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
        {!isAdmin && (
          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={13} color={subtle} />
            <span style={{ fontSize: 11, color: subtle }}>Export available to admins</span>
          </div>
        )}
      </aside>
    </div>
  );
}
