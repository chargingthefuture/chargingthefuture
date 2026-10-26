// Generated avatars for 3.1.0. Every member's picture is drawn from a hash of their account id, so
// no uploaded photo is ever shown or stored, and the same account gets the same picture on web and
// Android. Two kinds, in earth colors with a hand-drawn ink line: a small landscape (hills, a sun
// or moon, sometimes water, a tree or a field) or cut paper (overlapping shapes and one stroke).
// Neither has a face, hair or clothes, so a picture says nothing about who the member is.
//
// The picture is a list of plain shapes on a 100 x 100 square, which web and Android each draw
// with their own SVG elements, and which seAvatarSvg writes out for places that take an image.

export const SE_AVATAR_VIEWBOX = 100;

export type SeAvatarKind = 'landscape' | 'paper';

export type SeAvatarStroke = { stroke: string; strokeWidth: number };

export type SeAvatarShape =
  | { type: 'rect'; fill: string }
  | { type: 'path'; d: string; fill: string | null; stroke: SeAvatarStroke | null; opacity: number }
  | { type: 'circle'; cx: number; cy: number; r: number; fill: string | null; stroke: SeAvatarStroke | null };

export type SeAvatar = { kind: SeAvatarKind; shapes: SeAvatarShape[] };

const INK = '#2b211c';
const PAPER = '#f3e9db';
const EARTH = ['#c96f4a', '#d9a441', '#8a9a5b', '#5f7a5a', '#b8836b', '#e6cfa7', '#7a5c46', '#a86b4b', '#6f8f8c', '#c9a27e'];
const SKIES = ['#e6cfa7', '#f0d9b5', '#c9d6c3', '#d8c3a5', '#b7c9c6'];
const PAPER_GROUNDS = ['#e6cfa7', '#f3e9db', '#d8c3a5'];
const INK_LINE: SeAvatarStroke = { stroke: INK, strokeWidth: 2.4 };

// FNV-1a, 32 bit, for the seed. Stable across runtimes; it is not a security hash.
function hash32(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// xorshift32: a repeatable sequence of numbers in [0, 1) from one seed.
function sequence(seed: number): () => number {
  let h = seed || 1;
  return () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
}

type Next = () => number;

const n1 = (value: number) => Number(value.toFixed(1));

function pick<T>(next: Next, list: readonly T[]): T {
  return list[Math.floor(next() * list.length)];
}

// A closed shape with a slightly uneven edge, as if drawn by hand.
function blob(next: Next, cx: number, cy: number, radius: number, points: number, wobble: number): string {
  const p: Array<[number, number]> = [];
  for (let i = 0; i < points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const rr = radius * (1 - wobble / 2 + next() * wobble);
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let d = '';
  for (let i = 0; i < points; i += 1) {
    const [ax, ay] = p[i];
    const [bx, by] = p[(i + 1) % points];
    const [cx2, cy2] = p[(i + 2) % points];
    if (i === 0) d = `M${n1((ax + bx) / 2)} ${n1((ay + by) / 2)}`;
    d += ` Q${n1(bx)} ${n1(by)} ${n1((bx + cx2) / 2)} ${n1((by + cy2) / 2)}`;
  }
  return `${d}Z`;
}

// A line with a slight bend, as if drawn by hand.
function handLine(next: Next, x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2 + (next() - 0.5) * 4;
  const my = (y1 + y2) / 2 + (next() - 0.5) * 4;
  return `M${n1(x1)} ${n1(y1)} Q${n1(mx)} ${n1(my)} ${n1(x2)} ${n1(y2)}`;
}

const path = (d: string, fill: string | null, stroke: SeAvatarStroke | null = INK_LINE, opacity = 1): SeAvatarShape => ({
  type: 'path',
  d,
  fill,
  stroke,
  opacity,
});

function landscape(next: Next): SeAvatarShape[] {
  const shapes: SeAvatarShape[] = [{ type: 'rect', fill: pick(next, SKIES) }];
  const orb = pick(next, ['sun', 'moon', 'none'] as const);
  const ox = n1(25 + next() * 50);
  if (orb === 'sun') shapes.push(path(blob(next, ox, 32, 10, 8, 0.12), '#d9a441'));
  if (orb === 'moon') shapes.push(path(`M${ox} 22 A11 11 0 1 0 ${n1(ox + 8)} 40 A9 9 0 1 1 ${ox} 22Z`, PAPER));
  const far = n1(50 + next() * 10);
  const near = n1(62 + next() * 10);
  shapes.push(path(`M-2 ${far} Q25 ${n1(far - 18 - next() * 10)} 50 ${far} T102 ${n1(far - 6)} V102 H-2Z`, pick(next, ['#8a9a5b', '#a86b4b', '#b8836b'])));
  shapes.push(path(`M-2 ${near} Q35 ${n1(near - 14)} 70 ${near} T102 ${n1(near + 2)} V102 H-2Z`, pick(next, ['#5f7a5a', '#7a5c46', '#c96f4a'])));
  const extra = pick(next, ['water', 'tree', 'field', 'none'] as const);
  if (extra === 'water') {
    shapes.push(path('M10 86 Q20 82 30 86 T50 86 T70 86 T90 86', null, { stroke: PAPER, strokeWidth: 2.4 }));
  }
  if (extra === 'tree') {
    const tx = n1(20 + next() * 60);
    shapes.push(path(handLine(next, tx, near + 4, tx, near - 14), null));
    shapes.push(path(blob(next, tx, near - 20, 8, 7, 0.25), '#5f7a5a'));
  }
  if (extra === 'field') {
    for (let i = 0; i < 5; i += 1) {
      const x = 14 + i * 17;
      shapes.push(path(`M${x} 92 L${x + 3} 84`, null));
    }
  }
  return shapes;
}

function cutPaper(next: Next): SeAvatarShape[] {
  const shapes: SeAvatarShape[] = [{ type: 'rect', fill: pick(next, PAPER_GROUNDS) }];
  const colors = [...EARTH];
  // Shuffle with the same sequence, so the colors are as repeatable as the shapes.
  for (let i = colors.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  const count = 3 + Math.floor(next() * 2);
  for (let i = 0; i < count; i += 1) {
    shapes.push(path(blob(next, 25 + next() * 50, 25 + next() * 50, 14 + next() * 16, 7, 0.4), colors[i], null, 0.95));
  }
  shapes.push(path(handLine(next, 15 + next() * 20, 70 + next() * 15, 65 + next() * 20, 60 + next() * 20), null));
  if (next() > 0.4) {
    shapes.push({ type: 'circle', cx: n1(20 + next() * 60), cy: n1(20 + next() * 30), r: 4, fill: INK, stroke: null });
  }
  return shapes;
}

export function seAvatar(accountId: string): SeAvatar {
  const seed = hash32(accountId);
  const next = sequence(seed);
  const kind: SeAvatarKind = seed % 2 === 0 ? 'landscape' : 'paper';
  return { kind, shapes: kind === 'landscape' ? landscape(next) : cutPaper(next) };
}

function strokeAttrs(stroke: SeAvatarStroke | null): string {
  return stroke
    ? ` stroke="${stroke.stroke}" stroke-width="${stroke.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`
    : '';
}

// The same picture as an SVG document, for places that take an image address rather than markup
// (Clerk's account button). Every value in it comes from the fixed lists above, never from input.
export function seAvatarSvg(accountId: string): string {
  const v = SE_AVATAR_VIEWBOX;
  const body = seAvatar(accountId)
    .shapes.map((s) => {
      if (s.type === 'rect') return `<rect width="${v}" height="${v}" fill="${s.fill}"/>`;
      if (s.type === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${s.fill ?? 'none'}"${strokeAttrs(s.stroke)}/>`;
      return `<path d="${s.d}" fill="${s.fill ?? 'none'}" opacity="${s.opacity}"${strokeAttrs(s.stroke)}/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v} ${v}">${body}</svg>`;
}

export function seAvatarDataUri(accountId: string): string {
  return `data:image/svg+xml,${encodeURIComponent(seAvatarSvg(accountId))}`;
}
