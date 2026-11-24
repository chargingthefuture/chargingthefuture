import type { SeTodayCard } from './types';
export type SeOpenState = 'yours' | 'goal' | 'joined';
export type SeOpenItem = {
    card: SeTodayCard;
    state: SeOpenState;
    line: string;
};
export declare const SE_OPEN_WORDS: {
    title: string;
    intro: string;
    empty: string;
    failed: string;
    loading: string;
    yours: string;
    goal: string;
    joined: string;
};
export declare function seOpenCards(cards: readonly SeTodayCard[], viewerId: string): SeOpenItem[];
