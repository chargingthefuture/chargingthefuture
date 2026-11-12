import type { SeCardKind } from '../design/se-theme';
import type { SeTodayGoal } from './goal-share';
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
    done?: boolean;
    commentTimesIso?: string[];
    markedDoneAtIso?: string;
    newComments?: number;
    sample?: boolean;
    mine?: SeTodayCardMine;
    saved?: boolean;
    goal?: SeTodayGoal;
    figures?: SeTodayFigure[];
};
export type SeTodayFigure = {
    value: string;
    line: string;
};
export type SeTodayCardMine = {
    leavesIso: string;
    dueIso: string | null;
    canClose: boolean;
    canRenew: boolean;
};
export type SeTodayTalk = {
    title: string;
    host: string;
    startIso: string;
    endIso: string;
    onAir: boolean;
};
export type SeTodayRoom = {
    key: 'main' | 'weavers';
    name: string;
    live: boolean;
    members: number;
    guests: number;
    speakers: number;
    faces: string[];
    href: string;
    nextTalk: SeTodayTalk | null;
};
export type SeTodayBroadcast = {
    live: boolean;
    title: string | null;
    href: string;
    host?: string | null;
    startedAtIso?: string | null;
};
export type SeToday = {
    generatedAtIso: string;
    presence: number | null;
    storiesTomorrow?: number | null;
    daysWon: {
        total: number;
        thisWeek: number;
        sample?: boolean;
    } | null;
    broadcast: SeTodayBroadcast | null;
    rooms: SeTodayRoom[];
    week: SeTodayTalk[];
    cards: SeTodayCard[];
    unavailable: string[];
};
