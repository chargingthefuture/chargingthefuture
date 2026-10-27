export declare const SE_AVATAR_VIEWBOX = 100;
export type SeAvatarKind = 'landscape' | 'paper';
export type SeAvatarStroke = {
    stroke: string;
    strokeWidth: number;
};
export type SeAvatarShape = {
    type: 'rect';
    fill: string;
} | {
    type: 'path';
    d: string;
    fill: string | null;
    stroke: SeAvatarStroke | null;
    opacity: number;
} | {
    type: 'circle';
    cx: number;
    cy: number;
    r: number;
    fill: string | null;
    stroke: SeAvatarStroke | null;
};
export type SeAvatar = {
    kind: SeAvatarKind;
    shapes: SeAvatarShape[];
};
export declare function seAvatar(accountId: string): SeAvatar;
export declare function seAvatarSvg(accountId: string): string;
export declare function seAvatarDataUri(accountId: string): string;
