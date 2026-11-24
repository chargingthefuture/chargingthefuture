// The small rising line on Today's Days won card (owner request, 2026-11-24): this week's days won
// added up day by day, so it only climbs, drawn like a price line with no axes. Shared so the web
// and Android draw the same points.

export type SeDaysWonTrend = {
  // SVG polyline points, "x,y x,y ...", inside a box `width` by `height`.
  points: string;
  // The last point, where the line ends, for a dot.
  end: { x: number; y: number };
};

// Null when there are fewer than two days to draw. `pad` keeps the stroke and the end dot inside
// the box.
export function seDaysWonTrend(days: number[] | null | undefined, width: number, height: number, pad = 3): SeDaysWonTrend | null {
  const values = (days ?? []).map((day) => (Number.isFinite(day) ? Math.max(0, day) : 0));
  if (values.length < 2 || width <= pad * 2 || height <= pad * 2) return null;
  let running = 0;
  const climb = values.map((day) => (running += day));
  const top = climb[climb.length - 1];
  const step = (width - pad * 2) / (climb.length - 1);
  const coords = climb.map((value, i) => {
    const x = round(pad + i * step);
    // A week with nothing won yet is a flat line along the bottom.
    const y = round(top > 0 ? height - pad - (value / top) * (height - pad * 2) : height - pad);
    return { x, y };
  });
  return { points: coords.map(({ x, y }) => `${x},${y}`).join(' '), end: coords[coords.length - 1] };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
