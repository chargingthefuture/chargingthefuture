"use client";

// Public "Economy" tab: aggregate circulation figures for all members. Every number is a bare
// credit quantity — ServiceCredits are not money and are never shown at a fiat equivalent.
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fmtCredits, type CirculationMetrics } from "./sc-shared";
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens } from './sc-shared';

function fmtOrDash(n: number | null): string {
  return n === null ? "—" : fmtCredits(n);
}

type Card = { label: string; value: string };

function buildCards(m: CirculationMetrics): Card[] {
  return [
    { label: "In circulation", value: fmtCredits(m.inCirculation) },
    { label: "Total issued", value: fmtCredits(m.totalIssued) },
    { label: "Total burned", value: fmtCredits(m.totalBurned) },
    { label: "Held in treasury", value: fmtOrDash(m.treasuryBalance) },
    { label: "On community credit", value: fmtCredits(m.outstandingMutualCreditDebt) },
    { label: "Moving (30-day velocity)", value: m.velocity.toFixed(2) },
    { label: "Sent in last 30 days", value: fmtCredits(m.transferVolume30d) },
  ];
}

function Cards({ metrics }: { metrics: CirculationMetrics }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
      {buildCards(metrics).map(({ label, value }) => (
        <div key={label} style={{ padding: "16px", borderRadius: 12, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}18` }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: t.TITLE, marginBottom: 6, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 12, color: t.SUBTLE }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export function ServiceCreditsCirculationTab() {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<CirculationMetrics | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch("/api/service-credits/circulation")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load the economy view (${res.status}).`);
        const data = (await res.json()) as { ok?: boolean; metrics?: CirculationMetrics };
        if (!data.metrics) throw new Error("The economy view returned no figures.");
        if (active) setMetrics(data.metrics);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load the economy view.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>The economy</div>
        <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, marginBottom: 20 }}>
          ServiceCredits are usable across the plugins. They are not money and cannot be cashed out.
        </div>
        {loading && <div style={{ fontSize: 14, color: t.SUBTLE }}>Loading…</div>}
        {error && <div style={{ fontSize: 14, color: "#EF4444" }}>{error}</div>}
        {!loading && !error && metrics && <Cards metrics={metrics} />}
      </div>
    </ScrollArea>
  );
}
