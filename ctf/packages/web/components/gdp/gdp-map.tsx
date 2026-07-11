"use client";

// GDP "Map" tab. Replaces the previous "coming soon" stub with a real inline-SVG
// world map driven by the live aggregate metrics. No per-country GDP data exists in
// the backend, so the map renders regions in a single neutral state and overlays the
// community-wide Community Value Index and total member count.
// Differential-privacy-suppressed rows (dpSuppressed) are dropped before reading,
// so a value flagged for suppression is never rendered.

import {
  COMMUNITY_VALUE_INDEX_METRIC_KEY,
  GDP_TOTAL_MEMBERS_METRIC_KEY,
  formatCommunityValueIndex,
  formatGdpCount,
  pickGdpMetricValue,
  type GdpMetricRow,
} from "./gdp-shared";
import { GdpWorldMap } from "./gdp-world-map";

export function GdpMap({ metricRows }: { metricRows: GdpMetricRow[] }) {
  const visibleRows = metricRows.filter((m) => !m?.dpSuppressed);
  const valueIndex = pickGdpMetricValue(visibleRows, COMMUNITY_VALUE_INDEX_METRIC_KEY);
  const totalMembers = pickGdpMetricValue(visibleRows, GDP_TOTAL_MEMBERS_METRIC_KEY);
  const hasData = valueIndex !== null || totalMembers !== null;
  return (
    <GdpWorldMap
      headline={formatCommunityValueIndex(valueIndex)}
      membersLabel={totalMembers !== null ? formatGdpCount(totalMembers) : null}
      hasData={hasData}
    />
  );
}
