// The daily puzzle: one a day, the same for everyone, taking turns between three kinds — the word of
// the day, the picture of the day and the word ladder. Nothing in it comes from posts or members.
// Shared by web and Android, so a day's puzzle is identical on every device.

import { SE_DAILY_WORDS, type SeDailyWord } from './words';
import { SE_LADDERS } from './ladder-list';
import { SE_SCENE_STRIPS, seScene, seSeededRandom, type SeScene } from './scene';

export const SE_DAILY_START = '2026-11-03';

export type SeDailyKind = 'word' | 'picture' | 'ladder';

export const SE_DAILY_TITLES: Record<SeDailyKind, { title: string; ask: string }> = {
  word: { title: 'Word of the day', ask: 'Which word has this meaning?' },
  picture: { title: 'Picture of the day', ask: 'Tap two strips to swap them, until the picture is back in order.' },
  ladder: { title: 'Word ladder', ask: 'Change one letter at a time. Every step must be a word.' },
};

type Base = { day: string; number: number };

export type SeDailyPuzzle =
  | (Base & { kind: 'word'; word: SeDailyWord; choices: string[]; answer: number })
  | (Base & { kind: 'picture'; scene: SeScene; order: number[] })
  | (Base & { kind: 'ladder'; start: string; end: string; shortest: number });

const KINDS: SeDailyKind[] = ['word', 'picture', 'ladder'];

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function wordPuzzle(base: Base, turn: number, next: () => number): SeDailyPuzzle {
  const word = SE_DAILY_WORDS[turn % SE_DAILY_WORDS.length];
  const others = SE_DAILY_WORDS.filter((item) => item.word !== word.word && item.part === word.part);
  const decoys = shuffle(others, next).slice(0, 2).map((item) => item.word);
  const choices = shuffle([word.word, ...decoys], next);
  return { ...base, kind: 'word', word, choices, answer: choices.indexOf(word.word) };
}

function picturePuzzle(base: Base, next: () => number): SeDailyPuzzle {
  const solved = Array.from({ length: SE_SCENE_STRIPS }, (_, i) => i);
  let order = shuffle(solved, next);
  if (order.every((strip, i) => strip === i)) order = [...order.slice(1), order[0]];
  return { ...base, kind: 'picture', scene: seScene(base.day), order };
}

// The day's puzzle, by calendar day (YYYY-MM-DD). Days before the first day show the first puzzle.
export function seDailyPuzzle(day: string): SeDailyPuzzle {
  const index = Math.max(0, dayNumber(day) - dayNumber(SE_DAILY_START));
  const base: Base = { day, number: index + 1 };
  const turn = Math.floor(index / KINDS.length);
  const next = seSeededRandom(`daily:${day}`);
  const kind = KINDS[index % KINDS.length];
  if (kind === 'word') return wordPuzzle(base, turn, next);
  if (kind === 'picture') return picturePuzzle(base, next);
  const [start, end, shortest] = SE_LADDERS[turn % SE_LADDERS.length];
  return { ...base, kind: 'ladder', start, end, shortest };
}

// Whether the strips are back in order.
export function sePictureSolved(order: readonly number[]): boolean {
  return order.every((strip, i) => strip === i);
}

// What a member can paste anywhere after finishing: the puzzle number and how it went, no answer.
export function seDailyShareText(puzzle: SeDailyPuzzle, result: number): string {
  const head = `Skills Economy daily puzzle No. ${puzzle.number}`;
  if (puzzle.kind === 'word') return `${head}: word of the day, ${result === 1 ? 'right first try' : `right on try ${result}`}.`;
  if (puzzle.kind === 'picture') return `${head}: picture back together in ${result} swap${result === 1 ? '' : 's'}.`;
  return `${head}: word ladder in ${result} steps.`;
}
