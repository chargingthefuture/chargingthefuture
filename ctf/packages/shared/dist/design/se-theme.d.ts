export type SeThemeColor = 'forest' | 'burgundy' | 'coral' | 'teal-purple';
export type SeThemeMode = 'dark' | 'light';
export declare const SE_THEME_COLORS: readonly SeThemeColor[];
export declare const SE_THEME_MODES: readonly SeThemeMode[];
export declare const SE_DEFAULT_THEME: {
    color: SeThemeColor;
    mode: SeThemeMode;
};
export declare const SE_THEME_LABELS: Record<SeThemeColor, string>;
export type SeCardKind = 'ask' | 'offer' | 'story' | 'match' | 'mood' | 'numbers' | 'replay';
export type SeKindColors = Record<SeCardKind, string>;
export type SeThemeTokens = {
    bg: string;
    card: string;
    sunk: string;
    ink: string;
    soft: string;
    hair: string;
    line: string;
    hero: string;
    onHero: string;
    pick: string;
    btn: string;
    onBtn: string;
    live: string;
    liveBadge: string;
    onLiveBadge: string;
    kind: SeKindColors;
    onKind: string;
};
export declare const SE_THEMES: Record<SeThemeColor, Record<SeThemeMode, SeThemeTokens>>;
export declare function seTheme(color?: SeThemeColor, mode?: SeThemeMode): SeThemeTokens;
export declare function isSeThemeColor(value: unknown): value is SeThemeColor;
export declare function isSeThemeMode(value: unknown): value is SeThemeMode;
export declare const SE_FONTS: {
    readonly serif: "Newsreader";
    readonly sans: "DM Sans";
};
export declare const SE_RADIUS: {
    readonly card: 18;
    readonly hero: 22;
    readonly sheet: 26;
    readonly pill: 999;
};
export declare const SE_HARD_SHADOW_PX: {
    readonly button: 2;
    readonly card: 3;
    readonly hero: 4;
};
export declare const SE_MIN_TOUCH_PX = 44;
