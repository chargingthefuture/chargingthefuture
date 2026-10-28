export type SeRoomWords = {
    join: string;
    leave: string;
    backChannel: string;
    guestNotice: string | null;
};
export declare const SE_ROOM_WORDS_MAIN: SeRoomWords;
export declare const SE_ROOM_WORDS_WEAVERS: SeRoomWords;
export type SeRoomScope = 'main' | 'contributors';
export type SeRoomView = {
    words: SeRoomWords;
    name: string;
    audience: string;
    talkLine: string | null;
    joined: boolean;
    quiet: boolean;
    minimizeLabel: string;
    rule: string;
};
export declare const SE_ROOM_RULE = "Stay on topic: economics and collective action. Somebody who keeps going off topic can be removed from the room; their account is not affected.";
export declare function seRoomView(scope: SeRoomScope, room: {
    joined: boolean;
    name: string | null;
    count: number | null;
}, talkLine: string | null): SeRoomView;
export declare function seRoomWords(scope: SeRoomScope): SeRoomWords;
export declare const SE_ROOM_QUIET = "Quiet right now";
export declare const SE_ROOM_QUIET_TEXT = "Nobody is in the room. Play a reading while you wait, or come back for the next talk.";
export declare const SE_ROOM_MAIN_AUDIENCE = "Open to everyone";
export declare const SE_ROOM_WEAVERS_AUDIENCE = "Private to Weavers of the Commons";
export declare const SE_TALK_WORDS: {
    title: string;
    intro: string;
    needsUnlock: string;
    finishUnlock: string;
    loading: string;
    when: string;
    choose: string;
    about: string;
    detail: string;
    submit: string;
    submitting: string;
    tryAgain: string;
    noOpen: string;
};
export declare function seTalkBooked(dayLabel: string): string;
export declare function seSlotLabel(startIso: string, endIso: string): string;
export declare function seSlotDay(startIso: string): string;
