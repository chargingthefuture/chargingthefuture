export declare const SE_GUEST_TICK_MIN_MS = 20000;
export declare const SE_GUEST_TICK_MAX_MS = 90000;
export declare function seGuestTickDelayMs(random: number): number;
export declare function seGuestDaysWon<T extends {
    total: number;
    thisWeek: number;
    days?: number[];
}>(daysWon: T | null | undefined, ticks: number): T | null;
