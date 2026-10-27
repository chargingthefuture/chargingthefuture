import type { SeCardKind } from '../design/se-theme';
export type SeTodayActionKind = 'open' | 'help' | 'know-someone' | 'want' | 'helped-me' | 'join' | 'listen' | 'check-in';
export type SeTodayAction = {
    kind: SeTodayActionKind;
    label: string;
    href: string;
};
export type SeTodayAuthor = {
    accountId: string;
    handle: string;
};
export type SeTodayCard = {
    id: string;
    kind: SeCardKind;
    source: string;
    label: string;
    title: string;
    body: string | null;
    author: SeTodayAuthor | null;
    createdAtIso: string;
    href: string;
    actions: SeTodayAction[];
};
export type SeTodayRoom = {
    key: 'main' | 'weavers';
    name: string;
    live: boolean;
    members: number;
    guests: number;
    href: string;
};
export type SeTodayBroadcast = {
    live: boolean;
    title: string | null;
    href: string;
};
export type SeToday = {
    generatedAtIso: string;
    presence: number | null;
    broadcast: SeTodayBroadcast | null;
    rooms: SeTodayRoom[];
    cards: SeTodayCard[];
    unavailable: string[];
};
