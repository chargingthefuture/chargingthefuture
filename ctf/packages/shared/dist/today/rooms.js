// The words the 3.1 rooms use, shared by web and Android so the two read the same. 3.0's Chyme
// screens keep their own labels.
export const SE_ROOM_WORDS_MAIN = {
    join: 'Listen in',
    leave: 'Leave quietly',
    backChannel: 'Bring someone in',
    guestNotice: 'Guests may be listening. Anyone can hear this room without an account.',
};
export const SE_ROOM_WORDS_WEAVERS = { ...SE_ROOM_WORDS_MAIN, guestNotice: null };
const ROOM_NAMES = { main: 'Main Room', contributors: 'Weavers of the Commons' };
// What the room screen shows, shared by web and Android. `count` is null until the room is read.
export function seRoomView(scope, room, talkLine) {
    const main = scope === 'main';
    return {
        words: main ? SE_ROOM_WORDS_MAIN : SE_ROOM_WORDS_WEAVERS,
        name: room.name ?? ROOM_NAMES[scope],
        audience: main ? SE_ROOM_MAIN_AUDIENCE : SE_ROOM_WEAVERS_AUDIENCE,
        talkLine: main ? talkLine : null,
        joined: room.joined,
        quiet: !room.joined && room.count === 0,
        minimizeLabel: room.joined ? 'Keep listening and browse' : 'Back',
    };
}
export function seRoomWords(scope) {
    return scope === 'main' ? SE_ROOM_WORDS_MAIN : SE_ROOM_WORDS_WEAVERS;
}
export const SE_ROOM_QUIET = 'Quiet right now';
export const SE_ROOM_QUIET_TEXT = 'Nobody is in the room. Play a reading while you wait, or come back for the next talk.';
export const SE_ROOM_MAIN_AUDIENCE = 'Open to everyone';
export const SE_ROOM_WEAVERS_AUDIENCE = 'Private to Weavers of the Commons';
// + New → Talk: booking a TI Radio slot, held in the Main Room.
export const SE_TALK_WORDS = {
    title: 'Talk',
    intro: 'Host 90 minutes in the Main Room. Anyone can listen; your name and topic go on the schedule.',
    needsUnlock: 'Booking a talk needs Unlock approval.',
    finishUnlock: 'Finish Unlock',
    loading: 'Reading the schedule…',
    when: 'When (90 minutes, your time)',
    choose: 'Choose a time',
    about: 'What it is about',
    detail: 'More detail (optional)',
    submit: 'Book the talk',
    submitting: 'Booking…',
    tryAgain: 'Try again',
    noOpen: 'Every time this week is booked. New times open each day.',
};
export const SE_NEW_LATER = {
    title: 'Ask, Offer, Story',
    text: 'These are still being built. Until then they are where they are in 3.0.',
};
export function seTalkBooked(dayLabel) {
    return `Booked for ${dayLabel}. It shows on Today and in the TI Radio schedule.`;
}
// "Mon, Sep 14 · 7:30 PM – 9:00 PM", in the reader's own timezone.
export function seSlotLabel(startIso, endIso) {
    const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const day = new Date(startIso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `${day} · ${time(startIso)} – ${time(endIso)}`;
}
export function seSlotDay(startIso) {
    return new Date(startIso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
