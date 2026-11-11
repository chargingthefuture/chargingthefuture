import type { SeCardKind } from '../design/se-theme';
import type { SeTodayCard } from './types';
export type SeSavedCard = {
    cardId: string;
    kind: SeCardKind;
    title: string;
    href: string;
    savedAtIso: string;
};
export type SeSaveChange = {
    cardId: string;
    saved: true;
    kind: SeCardKind;
    title: string;
    href: string;
} | {
    cardId: string;
    saved: false;
};
export declare const SE_SAVES_MAX = 200;
export declare function seCanSave(card: Pick<SeTodayCard, 'kind'>): boolean;
export declare function seParseSaveChange(body: unknown): SeSaveChange | null;
export declare function seSaveChangeFor(card: SeTodayCard): SeSaveChange;
export declare function seSaveCardInToday<T extends {
    cards: SeTodayCard[];
}>(today: T, change: SeSaveChange): T;
export declare function seSavedKindName(kind: SeCardKind): string;
export declare const SE_SAVED_WORDS: {
    readonly title: "Saved";
    readonly intro: "Stories and replays you saved from Today.";
    readonly empty: "Nothing saved yet. Tap Save for later on a story or a replay to keep it here.";
    readonly save: "Save for later";
    readonly unsave: "Saved. Tap to remove from Saved";
    readonly hide: "Hide";
    readonly remove: "Remove";
    readonly failed: "Saved could not be changed:";
    readonly loadFailed: "Saved could not be loaded:";
    readonly full: "Saved holds up to 200 cards. Remove one in Me to save another.";
};
