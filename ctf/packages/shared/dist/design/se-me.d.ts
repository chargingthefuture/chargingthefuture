import { type SeThemeColor, type SeThemeMode } from './se-theme';
export declare const SE_ME_LINKS: {
    readonly credits: "/apps/service-credits";
    readonly account: "/account";
    readonly survey: "/survey/quora-account-deletions";
    readonly architect: "/admin";
    readonly wallpapers: "https://github.com/chargingthefuture/chargingthefuture/releases?q=wallpapers";
    readonly androidApp: "https://github.com/chargingthefuture/chargingthefuture/releases?q=mobile";
};
export declare const SE_ME_TILES: ReadonlyArray<{
    key: string;
    label: string;
    text: string;
    href: string;
}>;
export declare const SE_ME_WORDS: {
    credits: string;
    creditsUnit: (n: number) => string;
    creditsFailed: string;
    send: string;
    receive: string;
    receiveCopied: (handle: string) => string;
    receiveCopyFailed: (handle: string, reason: string) => string;
    receiveNoHandle: string;
    history: string;
    theme: string;
    themeText: string;
    dark: string;
    light: string;
    version: string;
    backTo30: string;
    account: string;
    survey: string;
    wallpapers: string;
    androidApp: string;
    architect: string;
    architectText: string;
};
export type SeThemeChoice = {
    color: SeThemeColor;
    mode: SeThemeMode;
};
export declare const SE_THEME_STORE_KEY = "se-theme";
export declare function seParseThemeChoice(raw: string | null | undefined): SeThemeChoice;
