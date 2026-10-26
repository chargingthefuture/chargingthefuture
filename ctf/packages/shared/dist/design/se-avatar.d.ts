export type SeAvatar = {
    bg: string;
    fg: string;
    d: string;
    rotate: 0 | 90 | 180 | 270;
};
export declare const SE_AVATAR_VIEWBOX = 40;
export declare function seAvatar(accountId: string): SeAvatar;
export declare function seAvatarSvg(accountId: string): string;
export declare function seAvatarDataUri(accountId: string): string;
