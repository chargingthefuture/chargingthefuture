import type { SeTodayCard } from './types';
export type SeCardMarkKind = 'done' | 'not_for_me';
export type SeCardMark = {
    cardId: string;
    mark: SeCardMarkKind;
    markedAtIso: string;
};
export type SeCardMarkChange = {
    cardId: string;
    mark: SeCardMarkKind | 'clear';
};
export declare const SE_CARD_MARKS_MAX_BATCH = 500;
export declare function seParseCardMarkChanges(body: unknown): SeCardMarkChange[] | null;
export declare function seLegacyMarkChanges(saved: unknown): SeCardMarkChange[];
export declare function seNewCommentsSince(card: Pick<SeTodayCard, 'commentTimesIso'>, markedAtIso: string): number;
export declare function seNewCommentsLine(count: number | undefined): string | null;
export declare function seApplyCardMarks(cards: readonly SeTodayCard[], marks: readonly SeCardMark[], dayStartIso: string): SeTodayCard[];
export declare function seCardShownDone(card: SeTodayCard): boolean;
export declare function seMarkCardInToday<T extends {
    cards: SeTodayCard[];
}>(today: T, change: SeCardMarkChange, now?: Date): T;
export declare function seDayStartIso(now?: Date): string;
export declare function seMarksFromToday(today: {
    cards: SeTodayCard[];
} | null): {
    read: string[];
    hidden: string[];
};
export declare function seMarkChangeFor(today: {
    cards: SeTodayCard[];
} | null, kind: 'read' | 'hidden', cardId: string): SeCardMarkChange | null;
