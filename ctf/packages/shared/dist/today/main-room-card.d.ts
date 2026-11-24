import type { SeTodayRoom } from './types';
export declare const SE_MAIN_ROOM_CARD_WORDS: {
    readonly playReadings: "Play readings";
    readonly listen: "Listen in";
    readonly startTalk: "Start a conversation";
    readonly signUpToTalk: "Sign up to talk";
    readonly bring: "Bring someone in";
    readonly signUpToSpeak: "Sign up to speak";
    readonly liveLabel: "Live room";
    readonly readingsOff: "No readings are playing right now.";
};
export declare function seMainRoomEmpty(room: Pick<SeTodayRoom, 'live' | 'members' | 'guests' | 'speakers'>): boolean;
export type SeMainRoomPrimary = 'readings' | 'listen';
export type SeMainRoomSecondary = 'start' | 'bring' | 'sign-up';
export type SeMainRoomButtons = {
    primary: {
        action: SeMainRoomPrimary;
        label: string;
    };
    secondary: {
        action: SeMainRoomSecondary;
        label: string;
    };
};
export declare function seMainRoomButtons(live: boolean, signedIn: boolean): SeMainRoomButtons;
export type SeGuestRoomRead = {
    isLive: boolean;
    participantCount: number;
    guestCount: number;
};
export declare function seGuestMainRoom(room: SeTodayRoom | null, read: SeGuestRoomRead): SeTodayRoom;
