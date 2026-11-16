import type { SeCardKind } from '../design/se-theme';
export type SeCardDotIcon = {
    paths: readonly string[];
    strokeWidth: number;
};
export declare const SE_CARD_DOT_ICONS: Record<SeCardKind, SeCardDotIcon>;
export declare const SE_CARD_DOT_CHECK = "M5 12l5 5 9-10";
export declare function seCardDotIcon(kind: SeCardKind): SeCardDotIcon;
