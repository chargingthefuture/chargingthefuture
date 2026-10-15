// A small Markdown reader for text the app shows to members, such as the Directory invites.
//
// It reads the parts of Markdown that blog posts use: headings, paragraphs (hard-wrapped lines are
// joined), bullet and numbered lists, quotes, rules, links, bold, italic, inline code, and bare web
// addresses. It returns plain data, and components/shared/simple-markdown.tsx turns that into React
// elements, so no HTML from the text is ever put into the page: a tag in the text shows as text.
// A Markdown picture becomes its alt text, because the words in it are what carries the credit.

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: MdInline[] }
  | { type: 'em'; children: MdInline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: MdInline[] };

export type MdBlock =
  | { type: 'heading'; level: 2 | 3 | 4; children: MdInline[] }
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'quote'; children: MdInline[] }
  | { type: 'list'; ordered: boolean; items: MdInline[][] }
  | { type: 'rule' };

// Only web addresses and paths inside the app are followed. Anything else (javascript:, data:)
// keeps its words and loses the link.
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (/^mailto:/i.test(href)) return href;
  return null;
}

type InlineRule = { re: RegExp; build: (match: RegExpExecArray) => MdInline | MdInline[] };

const INLINE_RULES: InlineRule[] = [
  { re: /`([^`]+)`/, build: (m) => ({ type: 'code', text: m[1] }) },
  { re: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/, build: (m) => ({ type: 'text', text: m[1] }) },
  {
    re: /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/,
    build: (m) => {
      const href = safeHref(m[2]);
      const children = parseInline(m[1]);
      return href ? { type: 'link', href, children } : children;
    },
  },
  { re: /\*\*([^*]+)\*\*|__([^_]+)__/, build: (m) => ({ type: 'strong', children: parseInline(m[1] ?? m[2]) }) },
  { re: /\*([^*\s][^*]*)\*|(?<![A-Za-z0-9])_([^_\s][^_]*)_(?![A-Za-z0-9])/, build: (m) => ({ type: 'em', children: parseInline(m[1] ?? m[2]) }) },
  {
    // A bare address. Trailing punctuation that ends a sentence stays outside the link.
    re: /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/,
    build: (m) => ({ type: 'link', href: m[0], children: [{ type: 'text', text: m[0] }] }),
  },
];

export function parseInline(text: string): MdInline[] {
  const out: MdInline[] = [];
  let rest = text;
  while (rest.length > 0) {
    let best: { index: number; match: RegExpExecArray; rule: InlineRule } | null = null;
    for (const rule of INLINE_RULES) {
      const match = rule.re.exec(rest);
      if (match && (best === null || match.index < best.index)) {
        best = { index: match.index, match, rule };
      }
    }
    if (!best) {
      out.push({ type: 'text', text: rest });
      break;
    }
    if (best.index > 0) out.push({ type: 'text', text: rest.slice(0, best.index) });
    const built = best.rule.build(best.match);
    out.push(...(Array.isArray(built) ? built : [built]));
    rest = rest.slice(best.index + best.match[0].length);
  }
  return out;
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET_RE = /^\s*[-*+]\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const RULE_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const FENCE_RE = /^\s*```/;

function headingLevel(hashes: number): 2 | 3 | 4 {
  // The card already carries the invite's title, so a heading in the text never outranks it.
  return hashes <= 2 ? 2 : hashes === 3 ? 3 : 4;
}

function readList(lines: string[], start: number, re: RegExp): { items: MdInline[][]; next: number } {
  const items: MdInline[][] = [];
  let i = start;
  while (i < lines.length) {
    const match = re.exec(lines[i]);
    if (match) {
      items.push(parseInline(match[1]));
    } else if (lines[i].trim() !== '' && /^\s{2,}\S/.test(lines[i]) && items.length > 0) {
      // A wrapped continuation of the item above.
      items[items.length - 1].push({ type: 'text', text: ` ${lines[i].trim()}` });
    } else {
      break;
    }
    i += 1;
  }
  return { items, next: i };
}

function startsBlock(line: string): boolean {
  return HEADING_RE.test(line) || BULLET_RE.test(line) || NUMBERED_RE.test(line) || QUOTE_RE.test(line) || RULE_RE.test(line) || FENCE_RE.test(line);
}

type Read = { block: MdBlock; next: number } | null;

function readHeading(lines: string[], i: number): Read {
  const heading = HEADING_RE.exec(lines[i]);
  return heading ? { block: { type: 'heading', level: headingLevel(heading[1].length), children: parseInline(heading[2]) }, next: i + 1 } : null;
}

function readRule(lines: string[], i: number): Read {
  return RULE_RE.test(lines[i]) ? { block: { type: 'rule' }, next: i + 1 } : null;
}

// A fenced block is shown as its plain text.
function readFence(lines: string[], i: number): Read {
  if (!FENCE_RE.test(lines[i])) return null;
  const body: string[] = [];
  let j = i + 1;
  while (j < lines.length && !FENCE_RE.test(lines[j])) { body.push(lines[j]); j += 1; }
  return { block: { type: 'paragraph', children: [{ type: 'code', text: body.join('\n') }] }, next: j + 1 };
}

function readAnyList(lines: string[], i: number): Read {
  const bullet = BULLET_RE.test(lines[i]);
  if (!bullet && !NUMBERED_RE.test(lines[i])) return null;
  const { items, next } = readList(lines, i, bullet ? BULLET_RE : NUMBERED_RE);
  return { block: { type: 'list', ordered: !bullet, items }, next };
}

function readQuote(lines: string[], i: number): Read {
  if (!QUOTE_RE.test(lines[i])) return null;
  const parts: string[] = [];
  let j = i;
  while (j < lines.length && QUOTE_RE.test(lines[j])) { parts.push(QUOTE_RE.exec(lines[j])?.[1] ?? ''); j += 1; }
  return { block: { type: 'quote', children: parseInline(parts.join(' ').trim()) }, next: j };
}

function readParagraph(lines: string[], i: number): { block: MdBlock; next: number } {
  const parts: string[] = [];
  let j = i;
  while (j < lines.length && lines[j].trim() !== '' && (parts.length === 0 || !startsBlock(lines[j]))) {
    parts.push(lines[j].trim());
    j += 1;
  }
  return { block: { type: 'paragraph', children: parseInline(parts.join(' ')) }, next: j };
}

const BLOCK_READERS = [readHeading, readRule, readFence, readAnyList, readQuote];

export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === '') { i += 1; continue; }
    let read: Read = null;
    for (const reader of BLOCK_READERS) {
      read = reader(lines, i);
      if (read) break;
    }
    const { block, next } = read ?? readParagraph(lines, i);
    blocks.push(block);
    i = next;
  }
  return blocks;
}
