import type { SeTodayRoom } from './types';

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
} as const;

// Nobody is in the room and it is not live: the card says so with SE_ROOM_QUIET_TEXT, the same
// words the room screen uses, so a member sees Start a conversation and a visitor Sign up to talk
// as the way in.
export function seMainRoomEmpty(room: Pick<SeTodayRoom, 'live' | 'members' | 'guests' | 'speakers'>): boolean {
  return !room.live && room.members + room.guests + room.speakers === 0;
}

// readings: open the room and play the readings loop. listen: open the live room and listen.
// start: open the room and join its call. bring: share the signed-out Today. sign-up: go to sign-up.
export type SeMainRoomPrimary = 'readings' | 'listen';
export type SeMainRoomSecondary = 'start' | 'bring' | 'sign-up';

export type SeMainRoomButtons = {
  primary: { action: SeMainRoomPrimary; label: string };
  secondary: { action: SeMainRoomSecondary; label: string };
};

export function seMainRoomButtons(live: boolean, signedIn: boolean): SeMainRoomButtons {
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

// What the public room read says: whether it is live and how many are in it.
export type SeGuestRoomRead = { isLive: boolean; participantCount: number; guestCount: number };

// The Main Room as a visitor's card shows it: the talk and faces from signed-out Today (null until
// it loads), with live and the counts from the public room read, which is the newer of the two.
const SE_GUEST_MAIN_ROOM: SeTodayRoom = {
  key: 'main',
  name: 'Main Room',
  live: false,
  members: 0,
  guests: 0,
  speakers: 0,
  faces: [],
  href: '/today',
  nextTalk: null,
};

export function seGuestMainRoom(room: SeTodayRoom | null, read: SeGuestRoomRead): SeTodayRoom {
  const base = room ?? SE_GUEST_MAIN_ROOM;
  const members = Math.max(0, read.participantCount);
  return {
    ...base,
    key: 'main',
    live: read.isLive,
    members,
    guests: Math.max(0, read.guestCount),
    speakers: Math.min(base.speakers, members),
  };
}
