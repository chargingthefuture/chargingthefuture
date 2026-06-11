"use client";

// Inline SVG world map for the GDP "Map" tab. Lightweight on purpose — no mapping
// dependency. The continents are simplified silhouettes drawn from a small set of
// SVG paths on an equirectangular 1000x500 canvas.
//
// Real-data note: the GDP module exposes only community-wide aggregates
// (gdp_total_revenue, weekly_active_users) — there is NO per-country GDP table. So
// every region renders in one neutral cyan "unpopulated" state and the headline
// aggregate is overlaid on the map. We never invent per-country values. If a
// per-country table is added later, `regionFill` can be made data-driven.

import { COLOR, COMMUNITY_VALUE_INDEX_DISCLAIMER, COMMUNITY_VALUE_INDEX_LABEL } from "./gdp-shared";

// Simplified continent outlines on a 1000x500 equirectangular canvas. These are
// coarse silhouettes, accurate enough to read as a world map at dashboard scale.
const CONTINENTS: { id: string; label: string; d: string }[] = [
  {
    id: "north-america",
    label: "North America",
    d: "M150 70 L260 60 L300 95 L290 140 L250 150 L240 190 L210 230 L190 210 L200 170 L160 150 L120 120 L130 90 Z M120 235 L160 250 L150 285 L120 270 Z",
  },
  {
    id: "south-america",
    label: "South America",
    d: "M250 300 L300 290 L320 330 L310 390 L280 440 L255 420 L250 370 L235 340 Z",
  },
  {
    id: "europe",
    label: "Europe",
    d: "M470 90 L540 80 L560 110 L540 140 L500 150 L475 130 Z",
  },
  {
    id: "africa",
    label: "Africa",
    d: "M480 170 L560 165 L590 210 L580 280 L545 340 L510 330 L490 270 L475 215 Z",
  },
  {
    id: "asia",
    label: "Asia",
    d: "M575 70 L780 60 L840 110 L820 170 L760 200 L700 180 L640 160 L600 130 L575 100 Z",
  },
  {
    id: "oceania",
    label: "Oceania",
    d: "M790 320 L860 310 L880 350 L850 380 L800 370 Z",
  },
];

// Centroid-ish marker points per inhabited region, used for the subtle pulse dots.
const MARKERS: { id: string; cx: number; cy: number }[] = [
  { id: "north-america", cx: 210, cy: 130 },
  { id: "south-america", cx: 280, cy: 360 },
  { id: "europe", cx: 515, cy: 115 },
  { id: "africa", cx: 530, cy: 255 },
  { id: "asia", cx: 710, cy: 130 },
  { id: "oceania", cx: 835, cy: 350 },
];

export function GdpWorldMap({
  headline,
  membersLabel,
  hasData,
}: {
  // Community Value Index (already formatted, no currency symbol — it is a relative measure, not money),
  // or a dash when absent.
  headline: string;
  // Real active-member count (already formatted), or null to hide the chip.
  membersLabel: string | null;
  // True when at least one real aggregate metric is present.
  hasData: boolean;
}) {
  const regionFill = `${COLOR}1F`;
  const regionStroke = `${COLOR}55`;
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: "24px 32px",
        gap: 16,
      }}
    >
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 280,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.06)",
          background:
            "radial-gradient(1200px 600px at 50% 30%, rgba(6,182,212,0.07), rgba(15,17,23,0) 70%), #0D0F14",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 1000 500"
          role="img"
          aria-label="World map of the TI Skills Economy"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          {/* Faint graticule for map texture */}
          {[125, 250, 375].map((y) => (
            <line
              key={`lat-${y}`}
              x1={0}
              y1={y}
              x2={1000}
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
          ))}
          {[200, 400, 600, 800].map((x) => (
            <line
              key={`lon-${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={500}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
          ))}
          {CONTINENTS.map((c) => (
            <path
              key={c.id}
              d={c.d}
              fill={regionFill}
              stroke={regionStroke}
              strokeWidth={1.5}
              strokeLinejoin="round"
            >
              <title>{c.label}</title>
            </path>
          ))}
          {hasData
            ? MARKERS.map((m) => (
                <circle key={m.id} cx={m.cx} cy={m.cy} r={5} fill={COLOR} opacity={0.85}>
                  <animate
                    attributeName="opacity"
                    values="0.85;0.25;0.85"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              ))
            : null}
        </svg>

        {/* Headline aggregate overlay — real data only */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 20,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#6B7280",
              textTransform: "uppercase",
            }}
          >
            {COMMUNITY_VALUE_INDEX_LABEL}
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: COLOR, lineHeight: 1 }}>{headline}</div>
          {membersLabel ? (
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>{membersLabel} active members</div>
          ) : null}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5 }}>
        {hasData
          ? `Regions show where the survivor economy is active (per-country breakdowns are not published yet, so regions are shown in a single neutral state). ${COMMUNITY_VALUE_INDEX_DISCLAIMER}`
          : "No published report yet. The map activates once a figure is published."}
      </div>
    </div>
  );
}
