"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  COLOR,
  COMMUNITY_VALUE_INDEX_DISCLAIMER,
  GDP_ESTIMATE_CHIP_LABEL,
  type GdpCountry,
  type GdpMetrics,
  type GdpSector,
} from "./gdp-shared";

// Understated chip shown beside the GDP headline figure only when the figure is a
// normalized USD estimate. Matches design/.../survivor-hub/GDP.tsx.
function EstimateChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 600,
        color: "#6B7280",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 4,
        padding: "2px 7px",
        marginLeft: 10,
        letterSpacing: "0.04em",
      }}
    >
      {GDP_ESTIMATE_CHIP_LABEL}
    </span>
  );
}

function GdpHero({ metrics }: { metrics: GdpMetrics }) {
  const stats = metrics.memberStats ?? [];
  const isEstimate = metrics.isEstimate === true;
  return (
    <div style={{ marginBottom: 24, padding: "28px 32px", borderRadius: 20, background: `linear-gradient(135deg,${COLOR}20 0%,rgba(6,182,212,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
      <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: COLOR, textTransform: "uppercase", marginBottom: 8 }}>TI Skills Economy — Live</div>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: "#F9FAFB", lineHeight: 1 }}>{metrics.currentValue || "—"}</div>
            {isEstimate ? <EstimateChip /> : null}
          </div>
          <div style={{ fontSize: 16, color: "#9CA3AF" }}>
            {metrics.target ? `of ${metrics.target} opportunity` : ""}
            {metrics.progress ? ` · ${metrics.progress} reached` : ""}
          </div>
          {metrics.progress ? (
            <div style={{ marginTop: 16, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", background: `linear-gradient(to right,${COLOR},#22D3EE)`, borderRadius: 4, width: metrics.progress }} />
            </div>
          ) : null}
          {isEstimate ? (
            <div style={{ fontSize: 11, color: "#4B5563", marginTop: 12, lineHeight: 1.55, fontStyle: "italic" }}>{COMMUNITY_VALUE_INDEX_DISCLAIMER}</div>
          ) : null}
        </div>
        {stats.length > 0 ? (
          <div style={{ display: "flex", gap: 12 }}>
            {stats.map(({ v, l, c }) => (
              <div key={l} style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "16px 20px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c ?? COLOR }}>{v}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>{l}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GdpSectors({ sectors }: { sectors: GdpSector[] }) {
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16 }}>Value by Source</div>
      {sectors.map((s) => (
        <div key={s.name} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: "#E8EAF0" }}>{s.name}</span>
            <span style={{ color: s.color ?? COLOR, fontWeight: 700 }}>{s.value}</span>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", background: s.color ?? COLOR, borderRadius: 4, width: `${Math.round((s.share ?? 0.6) * 100)}%`, opacity: 0.85 }} />
          </div>
          {s.members !== undefined ? (
            <div style={{ fontSize: 11, color: "#4B5563", marginTop: 2 }}>{s.members.toLocaleString()} members</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function GdpCountries({ countries }: { countries: GdpCountry[] }) {
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16 }}>Top Countries</div>
      {countries.map((c) => (
        <div key={c.country} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>{c.flag}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "#E8EAF0", fontWeight: 600 }}>{c.country}</span>
              <span style={{ fontSize: 13, color: COLOR, fontWeight: 700 }}>{c.gdp}</span>
            </div>
            {/* No per-country numeric share exists, so no progress bar is drawn — a width derived from
                list position would be a fabricated visual metric (real-data-only rule). */}
            <div style={{ fontSize: 11, color: "#4B5563", marginTop: 2 }}>{c.members.toLocaleString()} members</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GdpDashboard({
  sectors,
  countries,
  metrics,
}: {
  sectors: GdpSector[];
  countries: GdpCountry[];
  metrics: GdpMetrics;
}) {
  const hasSectors = sectors.length > 0;
  const hasCountries = countries.length > 0;
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "24px" }}>
        <GdpHero metrics={metrics} />
        <div style={{ display: "grid", gridTemplateColumns: hasSectors && hasCountries ? "3fr 2fr" : "1fr", gap: 20 }}>
          {hasSectors ? <GdpSectors sectors={sectors} /> : null}
          {hasCountries ? <GdpCountries countries={countries} /> : null}
        </div>
        {!hasSectors && !hasCountries ? (
          <div style={{ textAlign: "center", color: "#6B7280", fontSize: 14, padding: "40px 0" }}>
            No sector or country data available in this report.
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}
