export declare const SE_EMOJI_RAIN: readonly ["🎉", "🌱", "⭐", "🙌", "✨"];
export declare const SE_EMOJI_RAIN_DROPS = 18;
export declare const SE_EMOJI_RAIN_MS = 3200;
export type SeEmojiRainDrop = {
    key: string;
    emoji: string;
    leftPct: number;
    delayMs: number;
    fallMs: number;
    sizePx: number;
};
export declare function seEmojiRainDrops(count?: number): SeEmojiRainDrop[];
export declare function seEmojiRainStep(input: {
    on: boolean;
    total: number | null | undefined;
    sample?: boolean;
    seen: number | null | undefined;
}): {
    rain: boolean;
    record: number | null;
};
export declare function isSeDaysWonSeen(value: unknown): value is number;
