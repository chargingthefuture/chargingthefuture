// The words the 3.1 rooms use, shared by web and Android so the two read the same. 3.0's Chyme
// screens keep their own labels.
import { seTalkLine } from './view';
import { SE_TODAY_ROOM_WORDS, seTalkOnAirLine } from './week';
// "Bring someone in" on the live room's bar shares the signed-out Today (SE_TODAY_ROOM_WORDS), so
// the one-to-one call keeps its own name, Back Channel, here too.
export const SE_ROOM_WORDS_MAIN = {
    join: 'Listen in',
    leave: 'Leave quietly',
    backChannel: 'Back Channel',
    guestNotice: 'Guests may be listening',
};
export const SE_ROOM_WORDS_WEAVERS = { ...SE_ROOM_WORDS_MAIN, guestNotice: null };
// The live room's own labels, from the approved board "Live room".
export const SE_LIVE_ROOM_WORDS = {
    back: 'Back to Today',
    live: 'LIVE',
    more: 'More',
    moreTitle: 'Room',
    close: 'Close',
    refresh: 'Refresh the room',
    refreshing: 'Refreshing…',
    people: 'People in the room',
    noPeople: 'Nobody else is in the room.',
    readRule: 'Read it',
    hideRule: 'Show less',
    speaking: 'Speaking',
    listening: 'Listening',
    you: 'You',
    speakingNow: 'speaking',
    muted: 'muted',
    guest: 'Guest',
    handUp: 'hand raised',
    raiseHand: 'Raise hand',
    lowerHand: 'Lower hand',
    unmute: 'Unmute',
    mute: 'Mute',
    joining: 'Joining…',
    loading: 'Loading room…',
    connecting: 'Connecting to the audio room…',
    connectFailed: 'Could not connect to the audio room.',
    listenOnlyHandRaise: 'Listening. Raise your hand to ask to speak.',
    listenOnlyUnlock: 'Listening. Speaking opens once Unlock is done.',
    reconnecting: 'Reconnecting to the live room… the room cannot hear you until this clears.',
    connectionLost: 'The live connection dropped. Nobody can hear the room from this screen until you leave and join again.',
    handRaiseMode: 'Hand-raise mode: everyone listens until an admin lets them speak. Raise your hand to ask.',
};
// Somebody removed from a room for breaking it keeps their account; removal is from that room only.
export const SE_ROOM_RULE = 'Stay on topic: economics and collective action. Somebody who keeps going off topic can be removed from the room; their account is not affected.';
// The rule as the live room shows it before "Read it" opens the full text.
export const SE_ROOM_RULE_SHORT = 'Room rule: stay on topic, economics and collective action.';
const ROOM_NAMES = { main: 'Main Room', contributors: 'Weavers of the Commons' };
function capitalized(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
// The lines at the top of the room: while a talk is on the air, its title under "Main Room · open
// to everyone" and who hosts it when; otherwise the room's name under its audience, and the next talk.
function roomTitle(main, name, talk) {
    const audience = main ? SE_TODAY_ROOM_WORDS.mainAudience : SE_TODAY_ROOM_WORDS.weaversAudience;
    const onAir = main && talk?.onAir ? talk : null;
    if (onAir)
        return { eyebrowName: name, audience, heading: onAir.title, talkLine: seTalkOnAirLine(onAir) };
    return { eyebrowName: null, audience: capitalized(audience), heading: name, talkLine: main ? seTalkLine(talk) : null };
}
// What the room screen shows, shared by web and Android. `count` is null until the room is read.
export function seRoomView(scope, room, talk) {
    const main = scope === 'main';
    const name = room.name ?? ROOM_NAMES[scope];
    return {
        words: seRoomWords(scope),
        name,
        ...roomTitle(main, name, talk),
        joined: room.joined,
        quiet: !room.joined && room.count === 0,
        backLabel: SE_LIVE_ROOM_WORDS.back,
        rule: SE_ROOM_RULE,
        ruleShort: SE_ROOM_RULE_SHORT,
    };
}
export function seRoomWords(scope) {
    return scope === 'main' ? SE_ROOM_WORDS_MAIN : SE_ROOM_WORDS_WEAVERS;
}
// A name as the live room shows it: "farah", without the "@" Chyme's handles carry.
export function seRoomName(handle) {
    return handle.startsWith('@') ? handle.slice(1) : handle;
}
// "Listening · 4".
export function seListeningLabel(count) {
    return `${SE_LIVE_ROOM_WORDS.listening} · ${count}`;
}
// Whether somebody sits under Speaking or under Listening: their microphone is on, or an admin let
// them speak in hand-raise mode. Everybody else listens, guests included.
export function seRoomOnStage(person, speakMode) {
    if (person.guest)
        return false;
    return person.micOn || (speakMode === 'hand_raise' && person.role === 'speaker');
}
// The room bar's second line: "farah is speaking · you are listening".
export function seRoomBarLine(speakers, selfSpeaking) {
    const self = selfSpeaking ? 'you are speaking' : 'you are listening';
    if (speakers.length === 0)
        return capitalized(self);
    const who = speakers.length === 1
        ? `${speakers[0]} is speaking`
        : speakers.length === 2
            ? `${speakers[0]} and ${speakers[1]} are speaking`
            : `${speakers[0]} and ${speakers.length - 1} others are speaking`;
    return `${who} · ${self}`;
}
export const SE_ROOM_QUIET = 'Quiet right now';
export const SE_ROOM_QUIET_TEXT = 'Nobody is in the room. Play a reading while you wait, or come back for the next talk.';
export const SE_ROOM_MAIN_AUDIENCE = 'Open to everyone';
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
