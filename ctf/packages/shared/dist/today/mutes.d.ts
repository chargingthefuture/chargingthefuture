import type { SeTodayCard } from './types';
export type SeMute = {
    id: string;
    kind: 'person' | 'words';
    target: string;
    label: string | null;
    createdAtIso: string;
};
export declare const SE_MUTE_WORDS: {
    title: string;
    intro: string;
    addWords: string;
    addPlaceholder: string;
    add: string;
    remove: string;
    empty: string;
    mutePerson: (handle: string) => string;
    muted: (handle: string) => string;
    failed: string;
};
export declare function seNormalizeMuteWords(text: string): string;
export declare function seApplyMutes(cards: readonly SeTodayCard[], mutes: readonly Pick<SeMute, 'kind' | 'target'>[]): SeTodayCard[];
