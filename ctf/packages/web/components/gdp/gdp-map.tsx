"use client";

// GDP "Map" tab. Replaces the previous "coming soon" stub with a real inline-SVG
// world map driven by the published aggregate metrics. No per-country GDP data
// exists in the backend, so the map renders regions in a single neutral state and
// overlays the real community-wide USD estimate and active-member count.

import {
  GDP_ACTIVE_MEMBERS_METRIC_KEY,
  GDP_HEADLINE_METRIC_KEY,
  GDP_RECOGNIZED_SC_METRIC_KEY,
  formatGdpCount,
  formatGdpServiceCredits,
  formatGdpUsd,
  pickGdpMetricValue,
  type GdpMetricRow,
} from "./gdp-shared";
import { GdpWorldMap } from "./gdp-world-map";

export function GdpMap({ metricRows }: { metricRows: GdpMetricRow[] }) {
  const gdpTotal = pickGdpMetricValue(metricRows, GDP_HEADLINE_METRIC_KEY);
  const activeMembers = pickGdpMetricValue(metricRows, GDP_ACTIVE_MEMBERS_METRIC_KEY);
  const serviceCredits = pickGdpMetricValue(metricRows, GDP_RECOGNIZED_SC_METRIC_KEY);
  const hasData = gdpTotal !== null || activeMembers !== null || serviceCredits !== null;
  return (
    <GdpWorldMap
      headline={formatGdpUsd(gdpTotal)}
      membersLabel={activeMembers !== null ? formatGdpCount(activeMembers) : null}
      serviceCreditsLabel={serviceCredits !== null ? formatGdpServiceCredits(serviceCredits) : null}
      hasData={hasData}
    />
  );
}
