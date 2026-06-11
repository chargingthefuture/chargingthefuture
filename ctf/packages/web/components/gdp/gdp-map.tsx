"use client";

// GDP "Map" tab. Replaces the previous "coming soon" stub with a real inline-SVG
// world map driven by the published aggregate metrics. No per-country GDP data
// exists in the backend, so the map renders regions in a single neutral state and
// overlays the real community-wide USD estimate and active-member count.

import {
  COMMUNITY_VALUE_INDEX_METRIC_KEY,
  GDP_ACTIVE_MEMBERS_METRIC_KEY,
  formatCommunityValueIndex,
  formatGdpCount,
  pickGdpMetricValue,
  type GdpMetricRow,
} from "./gdp-shared";
import { GdpWorldMap } from "./gdp-world-map";

export function GdpMap({ metricRows }: { metricRows: GdpMetricRow[] }) {
  const valueIndex = pickGdpMetricValue(metricRows, COMMUNITY_VALUE_INDEX_METRIC_KEY);
  const activeMembers = pickGdpMetricValue(metricRows, GDP_ACTIVE_MEMBERS_METRIC_KEY);
  const hasData = valueIndex !== null || activeMembers !== null;
  return (
    <GdpWorldMap
      headline={formatCommunityValueIndex(valueIndex)}
      membersLabel={activeMembers !== null ? formatGdpCount(activeMembers) : null}
      hasData={hasData}
    />
  );
}
