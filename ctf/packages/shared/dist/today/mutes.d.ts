import type { SeTodayCard } from './types';
export type SeMuteKind = 'person' | 'post' | 'words';
export declare const SE_MUTE_KINDS: readonly SeMuteKind[];
export type SeMute = {
    id: string;
    kind: SeMuteKind;
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
    mutePost: string;
    mutedPost: string;
    failed: string;
};
export declare function seMuteRowLabel(mute: Pick<SeMute, 'kind' | 'target' | 'label'>): string;
export declare function seMutePostTargetValid(cardId: string): boolean;
export type SeCardMuteKind = 'person' | 'post';
export declare function seCardMuteRequest(card: SeTodayCard, kind: SeCardMuteKind): {
    kind: SeCardMuteKind;
    target: string;
    label: string;
} | null;
export declare function seCardMutedNote(card: SeTodayCard, kind: SeCardMuteKind): string;
export declare function seNormalizeMuteWords(text: string): string;
export declare function seApplyMutes(cards: readonly SeTodayCard[], mutes: readonly Pick<SeMute, 'kind' | 'target'>[]): SeTodayCard[];
