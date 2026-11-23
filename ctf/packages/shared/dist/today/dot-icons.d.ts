import type { SeCardAccent } from '../design/se-theme';
import type { SeTodayCard } from './types';
export type SeCardDotIcon = {
    paths: readonly string[];
    strokeWidth: number;
};
export declare const SE_CARD_DOT_ICONS: Record<SeCardAccent, SeCardDotIcon>;
export declare const SE_CARD_DOT_CHECK = "M5 12l5 5 9-10";
export declare function seCardDotIcon(accent: SeCardAccent): SeCardDotIcon;
export declare function seCardAccent(card: Pick<SeTodayCard, 'kind' | 'source'>): SeCardAccent;
