// The picture of the day: a landscape drawn from a seed, as plain shapes that web (SVG) and Android
// (react-native-svg) draw the same way. Original art made here, so nothing loads from another site.
// The picture is 300 by 300; the puzzle cuts it into SE_SCENE_STRIPS horizontal strips.

export const SE_SCENE_SIZE = 300;
export const SE_SCENE_STRIPS = 5;

export type SeShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string }
  | { kind: 'path'; d: string; fill: string; stroke?: string };

export type SeScene = { name: string; shapes: SeShape[] };

type Palette = { name: string; sky: [string, string]; sun: string; hills: [string, string, string]; water: string; trees: string };

const PALETTES: Palette[] = [
  { name: 'Morning', sky: ['#f7d9b9', '#fbeee0'], sun: '#f59e5b', hills: ['#a9c6a0', '#7fa874', '#557d4f'], water: '#9cc3cf', trees: '#3e6240' },
  { name: 'Midday', sky: ['#8ec5e8', '#d6ecf7'], sun: '#ffe08a', hills: ['#9fd08f', '#6fb35e', '#4a8a3f'], water: '#5aa6c9', trees: '#2f6b32' },
  { name: 'Evening', sky: ['#e58a6b', '#f6c39a'], sun: '#ffdd99', hills: ['#b07a8c', '#7d5570', '#523a55'], water: '#c98a86', trees: '#3a2a40' },
  { name: 'Night', sky: ['#1d2547', '#3b4a7a'], sun: '#f2efd8', hills: ['#3b4f6b', '#2c3c55', '#1e2a3f'], water: '#34507a', trees: '#151e2e' },
  { name: 'Autumn', sky: ['#cfe0e8', '#f3ead9'], sun: '#f2b45a', hills: ['#d9a35b', '#c07a3e', '#8f5530'], water: '#8fb2bf', trees: '#6b3a22' },
  { name: 'Winter', sky: ['#c9d6e3', '#eef3f8'], sun: '#ffffff', hills: ['#e4ebf2', '#c3d0de', '#9fb1c5'], water: '#a9c0d6', trees: '#4c6378' },
];

const PLACES = ['over the hills', 'by the lake', 'in the valley', 'across the ridge', 'at the meadow', 'along the river'];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seSeededRandom(seed: string): () => number {
  let state = hash(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0'));
  return `#${out.join('')}`;
}

// A smooth hill line across the picture, closed down to the bottom edge.
function hill(base: number, height: number, next: () => number): string {
  const points = [0, 60, 120, 180, 240, 300].map((x) => [x, base - next() * height] as const);
  let d = `M0 ${SE_SCENE_SIZE} L0 ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    d += ` C${(x0 + 30).toFixed(1)} ${y0.toFixed(1)} ${(x1 - 30).toFixed(1)} ${y1.toFixed(1)} ${x1} ${y1.toFixed(1)}`;
  }
  return `${d} L${SE_SCENE_SIZE} ${SE_SCENE_SIZE} Z`;
}

function sky(p: Palette): SeShape[] {
  const bands = 10;
  return Array.from({ length: bands }, (_, i) => ({
    kind: 'rect' as const,
    x: 0,
    y: (i * 180) / bands,
    w: SE_SCENE_SIZE,
    h: 180 / bands + 1,
    fill: mix(p.sky[0], p.sky[1], i / (bands - 1)),
  }));
}

function pines(p: Palette, next: () => number): SeShape[] {
  const count = 3 + Math.floor(next() * 5);
  return Array.from({ length: count }, () => {
    const x = 10 + next() * 280;
    const y = 250 + next() * 30;
    const h = 30 + next() * 30;
    return { kind: 'path' as const, d: `M${x.toFixed(1)} ${(y - h).toFixed(1)} L${(x - h / 3).toFixed(1)} ${y.toFixed(1)} L${(x + h / 3).toFixed(1)} ${y.toFixed(1)} Z`, fill: p.trees };
  });
}

function birds(p: Palette, next: () => number): SeShape[] {
  if (p.name === 'Night') {
    return Array.from({ length: 14 }, () => ({ kind: 'circle' as const, cx: next() * 300, cy: next() * 120, r: 0.8 + next() * 1.2, fill: '#f2efd8' }));
  }
  return Array.from({ length: 2 + Math.floor(next() * 3) }, () => {
    const x = 40 + next() * 220;
    const y = 30 + next() * 70;
    return { kind: 'path' as const, d: `M${x.toFixed(1)} ${y.toFixed(1)} q5 -5 10 0 q5 -5 10 0`, fill: 'none', stroke: p.trees };
  });
}

export function seScene(seed: string): SeScene {
  const next = seSeededRandom(`scene:${seed}`);
  const p = PALETTES[Math.floor(next() * PALETTES.length)];
  const lake = next() < 0.5;
  const shapes: SeShape[] = [
    ...sky(p),
    { kind: 'circle', cx: 40 + next() * 220, cy: 40 + next() * 60, r: 18 + next() * 14, fill: p.sun },
    ...birds(p, next),
    { kind: 'path', d: hill(150, 50, next), fill: p.hills[0] },
    { kind: 'path', d: hill(200, 45, next), fill: p.hills[1] },
  ];
  if (lake) shapes.push({ kind: 'rect', x: 0, y: 225, w: SE_SCENE_SIZE, h: 30, fill: p.water });
  shapes.push({ kind: 'path', d: hill(lake ? 275 : 250, 30, next), fill: p.hills[2] }, ...pines(p, next));
  const place = lake ? 'by the lake' : PLACES[Math.floor(next() * PLACES.length)];
  return { name: `${p.name} ${place}`, shapes };
}
