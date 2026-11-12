import type { SeTodayCard } from './types';
import type { SeCardAnswer } from './cards';
export type SeDailyCreditCandidate = {
    id: string;
    createdAtIso: string;
    authorAccountId: string | null;
};
export declare function sePickDailyCreditCard<T extends SeDailyCreditCandidate>(candidates: readonly T[]): T | null;
export declare function seDailyCreditDay(now: Date): string;
export declare function seDoneHelpers(answers: readonly SeCardAnswer[], viewerId: string): SeCardAnswer[];
export declare function seDailyCreditPill(card: Pick<SeTodayCard, 'dailyCredit' | 'author'>, viewerId: string | null): string | null;
