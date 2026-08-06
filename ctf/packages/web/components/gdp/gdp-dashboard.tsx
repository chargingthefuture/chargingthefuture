"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  
  COMMUNITY_VALUE_INDEX_DISCLAIMER,
  COMMUNITY_VALUE_INDEX_SINCE_LABEL,
  GDP_ESTIMATE_CHIP_LABEL,
  type GdpCountry,
  type GdpMetrics,
  type GdpProjection,
  type GdpSector,
} from "./gdp-shared";
import { useTheme } from '@/hooks/useTheme';
import { getGdpTokens } from './gdp-shared';
import { GdpProjectionPanel } from './gdp-projection-panel';

// Understated chip shown beside the GDP headline figure only when the figure is a
// normalized USD estimate. Matches design/.../survivor-hub/GDP.tsx.
function EstimateChip() {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 600,
        color: t.MUTED,
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
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  const stats = metrics.memberStats ?? [];
  const isEstimate = metrics.isEstimate === true;
  return (
    <div style={{ marginBottom: 24, padding: "28px 32px", borderRadius: 20, background: `linear-gradient(135deg,${t.ACCENT}20 0%,rgba(6,182,212,0.05) 100%)`, border: `1px solid ${t.ACCENT}25` }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: t.ACCENT, textTransform: "uppercase", marginBottom: 8 }}>Skills Economy — Live</div>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: t.TITLE, lineHeight: 1 }}>{metrics.currentValue || "—"}</div>
            {isEstimate ? <EstimateChip /> : null}
          </div>
          {/* The index sums all recognized exchanges since production launch — it never resets, so the
              as-of anchor is the launch date (one constant in gdp-shared.ts). */}
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 6 }}>{COMMUNITY_VALUE_INDEX_SINCE_LABEL}</div>
          <div style={{ fontSize: 16, color: t.SUBTLE }}>
            {metrics.target ? `of ${metrics.target} opportunity` : ""}
            {metrics.progress ? ` · ${metrics.progress} reached` : ""}
          </div>
          {metrics.progress ? (
            <div style={{ marginTop: 16, height: 8, background: t.BORDER, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", background: `linear-gradient(to right,${t.ACCENT},#22D3EE)`, borderRadius: 4, width: metrics.progress }} />
            </div>
          ) : null}
          {/* The Community Value disclaimer always shows on the dashboard (it moved here when the Map
              tab, which used to carry it, was removed): the index is a relative measure, never money. */}
          <div style={{ fontSize: 11, color: t.FAINT, marginTop: 12, lineHeight: 1.55, fontStyle: "italic" }}>{COMMUNITY_VALUE_INDEX_DISCLAIMER}</div>
        </div>
        {stats.length > 0 ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {stats.map(({ v, l, c }) => (
              <div key={l} style={{ flex: "1 1 auto", minWidth: 96, textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "16px 20px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c ?? t.ACCENT }}>{v}</div>
                <div style={{ fontSize: 11, color: t.MUTED }}>{l}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GdpSectors({ sectors }: { sectors: GdpSector[] }) {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE, marginBottom: 16 }}>Value by Source</div>
      {sectors.map((s) => (
        <div key={s.name} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: t.TEXT }}>{s.name}</span>
            <span style={{ color: s.color ?? t.ACCENT, fontWeight: 700 }}>{s.value}</span>
          </div>
          <div style={{ height: 8, background: t.INPUT_BG, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", background: s.color ?? t.ACCENT, borderRadius: 4, width: `${Math.round((s.share ?? 0.6) * 100)}%`, opacity: 0.85 }} />
          </div>
          {s.members !== undefined ? (
            <div style={{ fontSize: 11, color: t.FAINT, marginTop: 2 }}>{s.members.toLocaleString()} members</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function GdpCountries({ countries }: { countries: GdpCountry[] }) {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>All Countries</div>
      <div style={{ fontSize: 12, color: t.FAINT, marginBottom: 16 }}>Members by country</div>
      {countries.map((c) => (
        <div key={c.country} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: c.unspecified ? t.MUTED : t.TEXT, fontWeight: 600, fontStyle: c.unspecified ? "italic" : "normal" }}>{c.country}</span>
            <span style={{ fontSize: 13, color: c.unspecified ? t.MUTED : t.ACCENT, fontWeight: 700 }}>{c.members.toLocaleString()} {c.members === 1 ? "member" : "members"}</span>
          </div>
          {/* The bar width IS a real metric: this row's share of the whole member roster (countries plus
              the "Location not set" bucket sum to the roster). */}
          <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, c.share))}%`, background: c.unspecified ? t.MUTED : t.ACCENT, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 11, color: t.FAINT, marginTop: 2 }}>{c.share.toFixed(0)}% of members{c.unspecified ? " · no country recorded" : ""}</div>
        </div>
      ))}
    </div>
  );
}

export function GdpDashboard({
  sectors,
  countries,
  metrics,
  projection,
}: {
  sectors: GdpSector[];
  countries: GdpCountry[];
  metrics: GdpMetrics;
  // Open posts that have not closed yet — rendered below the real headline, clearly apart from it, and
  // never folded into the Community Value Index above. Optional: absent means no panel.
  projection?: GdpProjection | null;
}) {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  const hasSectors = sectors.length > 0;
  const hasCountries = countries.length > 0;
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "24px" }}>
        <GdpHero metrics={metrics} />
        <GdpProjectionPanel projection={projection} />
        <div style={{ display: "grid", gridTemplateColumns: hasSectors && hasCountries ? "3fr 2fr" : "1fr", gap: 20 }}>
          {hasSectors ? <GdpSectors sectors={sectors} /> : null}
          {hasCountries ? <GdpCountries countries={countries} /> : null}
        </div>
        {!hasSectors && !hasCountries ? (
          <div style={{ textAlign: "center", color: t.MUTED, fontSize: 14, padding: "40px 0" }}>
            No sector or country data available in this report.
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}
