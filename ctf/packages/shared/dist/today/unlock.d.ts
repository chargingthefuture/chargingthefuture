export declare const SE_UNLOCK_OPEN_DAYS = 14;
export type SeUnlockInput = {
    approved: boolean;
    firstSeenIso: string | null;
    countStopped: boolean;
};
export type SeUnlockStanding = {
    approved: boolean;
    day: number;
    paused: boolean;
    closable: boolean;
    title: string;
    text: string;
};
export declare const SE_UNLOCK_WORDS: {
    routes: string;
    sentTitle: string;
    sentText: string;
    pausedTitle: string;
    pausedText: string;
    open: string;
    help: string;
    close: string;
    href: string;
};
export declare function seUnlockDay(firstSeenIso: string | null, now?: Date): number;
export declare function seUnlockStanding(input: SeUnlockInput, now?: Date): SeUnlockStanding;
