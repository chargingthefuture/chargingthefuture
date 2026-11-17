// The Main Room card on Today, one card signed in and signed out (owner decision, 2026-11-17),
// shared by web and Android. Both show the room's name and audience, the next talk with its host,
// time and Add to calendar, and the faces and counts ("Quiet right now" when nobody is in). Only
// the button words differ: a visitor's second button leads to sign-up.
export const SE_MAIN_ROOM_CARD_WORDS = {
    playReadings: 'Play readings',
    listen: 'Listen in',
    startTalk: 'Start a conversation',
    signUpToTalk: 'Sign up to talk',
    bring: 'Bring someone in',
    signUpToSpeak: 'Sign up to speak',
    liveLabel: 'Live room',
    // Shown in place of the player when the readings loop is switched off or could not be read.
    readingsOff: 'No readings are playing right now.',
};
export function seMainRoomButtons(live, signedIn) {
    const W = SE_MAIN_ROOM_CARD_WORDS;
    if (live) {
        return {
            primary: { action: 'listen', label: W.listen },
            secondary: signedIn ? { action: 'bring', label: W.bring } : { action: 'sign-up', label: W.signUpToSpeak },
        };
    }
    return {
        primary: { action: 'readings', label: W.playReadings },
        secondary: signedIn ? { action: 'start', label: W.startTalk } : { action: 'sign-up', label: W.signUpToTalk },
    };
}
// The Main Room as a visitor's card shows it: the talk and faces from signed-out Today (null until
// it loads), with live and the counts from the public room read, which is the newer of the two.
export function seGuestMainRoom(room, read) {
    const members = Math.max(0, read.participantCount);
    return {
        key: 'main',
        name: room?.name ?? 'Main Room',
        live: read.isLive,
        members,
        guests: Math.max(0, read.guestCount),
        speakers: Math.min(room?.speakers ?? 0, members),
        faces: room?.faces ?? [],
        href: room?.href ?? '/today',
        nextTalk: room?.nextTalk ?? null,
    };
}
