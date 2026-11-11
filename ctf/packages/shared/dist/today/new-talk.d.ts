import type { SeTodayTalk } from './types';
import { type SeWeekDay } from './week';
export declare const SE_TALK_WORDS: {
    readonly heading: "Host a talk in the Main Room";
    readonly roomRule: "Room rule";
    readonly loading: "Reading the schedule…";
    readonly days: "Choose a day";
    readonly slots: "Times that day";
    readonly about: "What is it about?";
    readonly aboutPlaceholder: "Trading skills over the holidays";
    readonly pickFirst: "Pick a time above";
    readonly open: "Open";
    readonly take: "Take this slot";
    readonly yours: "Your talk";
    readonly picked: "Picked";
    readonly started: "Already started";
    readonly submit: "Book this slot";
    readonly submitting: "Booking…";
    readonly tryAgain: "Try again";
    readonly noneThisDay: "Nothing is left to book this day. Pick another day.";
    readonly failed: "Could not book the talk.";
    readonly loadFailed: "Could not read the TI Radio schedule.";
    readonly lockedTitle: "Booking a talk opens once you are verified";
    readonly lockedText: "A talk goes on the public schedule under your name, so it waits for one check. You can listen to every talk now.";
    readonly finishUnlock: "Finish Unlock";
    readonly unlockHref: "/plugin/unlock";
    readonly nextTalk: "Next talk";
    readonly nothingBooked: "Nothing is booked yet.";
};
export declare function seTalkIntro(now?: Date): string;
export declare function seTalkBooked(dayLabel: string): string;
export declare function seSlotDay(startIso: string): string;
export type SeTalkSlot = {
    slotStartIso: string;
    slotEndIso: string;
    state: 'open' | 'booked';
    isOnAir: boolean;
    booking: {
        hostUsername: string;
        title: string;
    } | null;
};
export type SeTalkRow = {
    time: string;
    title: string;
    sub: string;
    look: 'open' | 'booked' | 'picked';
    pickable: boolean;
};
export declare function seTalkRow(slot: SeTalkSlot, pickedIso: string | null): SeTalkRow;
export type SeTalkDay = SeWeekDay & {
    slots: SeTalkSlot[];
};
export declare function seTalkDays(slots: SeTalkSlot[], now?: Date): SeTalkDay[];
export declare function seTalkFirstOpenDay(days: SeTalkDay[]): string | null;
export declare function seTalkPickedSpan(startIso: string, endIso: string): string;
export declare function seNextTalk(slots: SeTalkSlot[], now?: Date): SeTodayTalk | null;
export declare function seNextTalkLine(talk: SeTodayTalk): string;
