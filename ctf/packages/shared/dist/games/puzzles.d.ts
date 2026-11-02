import type { SeStoryPost } from '../stories/release';
export type SePuzzleKind = 'missing-word' | 'line-order' | 'which-post';
export type SePuzzle = {
    kind: 'missing-word';
    slug: string;
    before: string;
    after: string;
    choices: string[];
    answer: number;
} | {
    kind: 'line-order';
    slug: string;
    lines: string[];
    order: number[];
} | {
    kind: 'which-post';
    slug: string;
    excerpt: string;
    choices: string[];
    answer: number;
};
export declare const SE_PUZZLE_WORDS: Record<SePuzzleKind, {
    title: string;
    ask: string;
}>;
export declare function sePuzzleFor(post: SeStoryPost, posts: readonly SeStoryPost[]): SePuzzle | null;
export declare function sePuzzleSolved(puzzle: SePuzzle, picked: number | readonly number[]): boolean;
