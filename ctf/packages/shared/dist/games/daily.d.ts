import { type SeDailyWord } from './words';
import { type SeScene } from './scene';
export declare const SE_DAILY_START = "2026-11-03";
export type SeDailyKind = 'word' | 'picture' | 'ladder';
export declare const SE_DAILY_TITLES: Record<SeDailyKind, {
    title: string;
    ask: string;
}>;
type Base = {
    day: string;
    number: number;
};
export type SeDailyPuzzle = (Base & {
    kind: 'word';
    word: SeDailyWord;
    choices: string[];
    answer: number;
}) | (Base & {
    kind: 'picture';
    scene: SeScene;
    order: number[];
}) | (Base & {
    kind: 'ladder';
    start: string;
    end: string;
    shortest: number;
});
export declare function seDailyPuzzle(day: string): SeDailyPuzzle;
export declare function sePictureSolved(order: readonly number[]): boolean;
export declare function seDailyShareText(puzzle: SeDailyPuzzle, result: number): string;
export {};
