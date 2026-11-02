// The daily puzzles (3.1.0 plan, task 17): one short puzzle for each story, built from the story's
// own text, so the game and the reading are the same thing. Shared by web and Android, and
// deterministic: the same post always gives the same puzzle, for every member, on every device.
//
// Three kinds, chosen by the post's number so they take turns:
//   missing-word  a sentence from the post with one word taken out, and four words to choose from;
//   line-order    four sentences from the post, shuffled, to put back in order;
//   which-post    a sentence from the post, and four titles to choose which post it came from.
// A post too short for its kind falls back to the next kind that fits; one that fits none has no
// puzzle and is skipped.

import type { SeStoryPost } from '../stories/release';

export type SePuzzleKind = 'missing-word' | 'line-order' | 'which-post';

export type SePuzzle =
  | { kind: 'missing-word'; slug: string; before: string; after: string; choices: string[]; answer: number }
  | { kind: 'line-order'; slug: string; lines: string[]; order: number[] }
  | { kind: 'which-post'; slug: string; excerpt: string; choices: string[]; answer: number };

export const SE_PUZZLE_WORDS: Record<SePuzzleKind, { title: string; ask: string }> = {
  'missing-word': { title: 'The missing word', ask: 'Which word was taken out?' },
  'line-order': { title: 'Back in order', ask: 'Tap the lines in the order the post has them.' },
  'which-post': { title: 'Which post?', ask: 'Which post is this line from?' },
};

const KINDS: SePuzzleKind[] = ['missing-word', 'line-order', 'which-post'];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A small seeded random source, so every device draws the same puzzle from the same post.
function random(seed: string): () => number {
  let state = hash(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Sentences a reader would recognize: plain prose, no addresses, not a heading or a list marker.
function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    // A heading or a list item is not a sentence: keep only lines that read as prose.
    .filter((line) => !/^([-*•]|\d+\.)\s/.test(line) && /[.!?]["')]?$/.test(line))
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => /^[A-Z"']/.test(sentence) && /[.!?]["')]?$/.test(sentence) && !/https?:|www\.|@/.test(sentence));
}

const WORD = /[A-Za-z][a-z']{4,}/g;

// Words about harm are never offered as a choice or taken out as the answer: a game should not
// hand somebody one of these to tap on. The sentence itself can still carry them.
const HEAVY = /^(suicid|kill|murder|rape|raped|abuse|tortur|assault|death|dead|dying|stalk|harass|weapon|poison)/i;

function missingWord(post: SeStoryPost, next: () => number): SePuzzle | null {
  const usable = sentences(post.text).filter((s) => s.length >= 50 && s.length <= 220 && (s.match(WORD) ?? []).length >= 2);
  if (usable.length === 0) return null;
  const sentence = usable[Math.floor(next() * usable.length)];
  const words = sentence.match(WORD) ?? [];
  const answer = [...words].filter((w) => !HEAVY.test(w)).sort((a, b) => b.length - a.length)[0];
  if (!answer) return null;
  const inSentence = new Set(words.map((w) => w.toLowerCase()));
  const pool = [...new Set((post.text.match(WORD) ?? []).map((w) => w.toLowerCase()))].filter(
    (w) => !inSentence.has(w) && !HEAVY.test(w) && Math.abs(w.length - answer.length) <= 3,
  );
  if (pool.length < 3) return null;
  const decoys = shuffle(pool, next).slice(0, 3);
  const display = (w: string) => (/^[A-Z]/.test(answer) ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  const choices = shuffle([answer, ...decoys.map(display)], next);
  const at = sentence.indexOf(answer);
  return {
    kind: 'missing-word',
    slug: post.slug,
    before: sentence.slice(0, at),
    after: sentence.slice(at + answer.length),
    choices,
    answer: choices.indexOf(answer),
  };
}

function lineOrder(post: SeStoryPost, next: () => number): SePuzzle | null {
  const all = sentences(post.text);
  const runs: string[][] = [];
  for (let i = 0; i + 4 <= all.length; i += 1) {
    const run = all.slice(i, i + 4);
    if (run.every((s) => s.length >= 25 && s.length <= 170)) runs.push(run);
  }
  if (runs.length === 0) return null;
  const run = runs[Math.floor(next() * runs.length)];
  let shown = shuffle(run, next);
  if (shown.every((line, i) => line === run[i])) shown = [...shown.slice(1), shown[0]];
  return { kind: 'line-order', slug: post.slug, lines: shown, order: run.map((line) => shown.indexOf(line)) };
}

function whichPost(post: SeStoryPost, posts: readonly SeStoryPost[], next: () => number): SePuzzle | null {
  const usable = sentences(post.text).filter((s) => s.length >= 60 && s.length <= 240);
  const others = posts.filter((other) => other.slug !== post.slug && other.title !== post.title);
  if (usable.length === 0 || others.length < 3) return null;
  const excerpt = usable[Math.floor(next() * usable.length)];
  const decoys = shuffle(others, next).slice(0, 3).map((other) => other.title);
  const choices = shuffle([post.title, ...decoys], next);
  return { kind: 'which-post', slug: post.slug, excerpt, choices, answer: choices.indexOf(post.title) };
}

// The puzzle for one post. `posts` is the full list, for the other titles in a which-post puzzle.
export function sePuzzleFor(post: SeStoryPost, posts: readonly SeStoryPost[]): SePuzzle | null {
  const next = random(post.slug);
  const first = post.number % KINDS.length;
  for (let step = 0; step < KINDS.length; step += 1) {
    const kind = KINDS[(first + step) % KINDS.length];
    const puzzle = kind === 'missing-word' ? missingWord(post, next) : kind === 'line-order' ? lineOrder(post, next) : whichPost(post, posts, next);
    if (puzzle) return puzzle;
  }
  return null;
}

// Whether an answer is right: the chosen index, or for line-order the indexes tapped in turn.
export function sePuzzleSolved(puzzle: SePuzzle, picked: number | readonly number[]): boolean {
  if (puzzle.kind === 'line-order') {
    return Array.isArray(picked) && picked.length === puzzle.order.length && picked.every((value, i) => value === puzzle.order[i]);
  }
  return picked === puzzle.answer;
}
