import type { SeThemeTokens } from '../design/se-theme';
export type SeTodayGoal = {
    taken: number;
    total: number;
    reached: boolean;
    helpers: number;
};
export type SeGoalShare = SeTodayGoal & {
    title: string;
};
type GoalTaskLike = {
    status: string;
    takenByUserId: string | null;
};
export declare function seGoalProgress(tasks: readonly GoalTaskLike[], ownerUserId: string, reached: boolean): SeTodayGoal;
export declare const SE_GOAL_SHARE_LINK = "https://app.lagatos.com/today";
export declare const SE_GOAL_SHARE_LINK_LABEL = "app.lagatos.com";
export declare const SE_GOAL_SHARE_WORDS: {
    readonly title: "Share";
    readonly close: "Close";
    readonly shareThisGoal: "Share this goal";
    readonly picture: "The picture that will be saved";
    readonly reached: "Goal reached";
    readonly about: "Skills Economy is a free app where survivors trade skills and help each other.";
    readonly save: "Save picture";
    readonly saving: "Saving…";
    readonly saved: "Picture saved";
    readonly saveFailed: "The picture was not saved: this device would not make the image file.";
    readonly copy: "Copy as text";
    readonly copied: "Copied";
    readonly copyFailed: "Nothing was copied: this device refused the clipboard.";
    readonly qr: "QR code for app.lagatos.com";
};
export declare function seGoalTakenLine(goal: SeTodayGoal): string;
export declare function seGoalCardLabel(goal: SeTodayGoal): string;
export declare function seGoalPercent(goal: SeTodayGoal): number;
export declare function seGoalShareKicker(goal: SeTodayGoal): string;
export declare function seGoalShareCredit(goal: SeTodayGoal): string | null;
export declare function seGoalShareText(share: SeGoalShare): string;
export declare function seWrapLines(text: string, maxChars: number, maxLines: number): string[];
export declare function seQrPath(moduleCount: number, isDark: (row: number, col: number) => boolean): string;
export declare const SE_QR_DARK = "#2a1a1d";
export declare const SE_QR_LIGHT = "#fffaf6";
export type SeSharePictureItem = {
    type: 'rect';
    x: number;
    y: number;
    w: number;
    h: number;
    r: number;
    fill: string;
    stroke?: string;
    strokeWidth?: number;
} | {
    type: 'path';
    d: string;
    fill: string;
} | {
    type: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    stroke: string;
    strokeWidth: number;
    dash: string;
} | {
    type: 'text';
    x: number;
    y: number;
    text: string;
    size: number;
    font: 'serif' | 'sans';
    weight: 400 | 600 | 700;
    fill: string;
    letterSpacing?: number;
} | {
    type: 'avatar';
    x: number;
    y: number;
    size: number;
    accountId: string;
} | {
    type: 'qr';
    x: number;
    y: number;
    size: number;
    modules: number;
    d: string;
};
export type SeSharePicture = {
    width: number;
    height: number;
    items: SeSharePictureItem[];
};
export declare const SE_SHARE_PICTURE_WIDTH = 358;
export declare const SE_SHARE_HELPER_SEED = "avenhood-member";
export declare function seGoalSharePicture(share: SeGoalShare, sharer: {
    handle: string;
    accountId: string;
} | null, t: SeThemeTokens, qr: {
    modules: number;
    d: string;
}): SeSharePicture;
export {};
