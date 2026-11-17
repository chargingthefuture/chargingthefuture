import { describe, expect, it } from 'vitest';
import { SE_MAIN_ROOM_CARD_WORDS as W, seGuestMainRoom, seMainRoomButtons } from '@ctf/shared';
import type { SeTodayRoom } from '@ctf/shared';

describe('seMainRoomButtons', () => {
  it('offers the readings first while the room is quiet', () => {
    expect(seMainRoomButtons(false, true)).toEqual({
      primary: { action: 'readings', label: W.playReadings },
      secondary: { action: 'start', label: W.startTalk },
    });
    expect(seMainRoomButtons(false, false).secondary).toEqual({ action: 'sign-up', label: W.signUpToTalk });
  });

  it('offers Listen in while the room is live', () => {
    expect(seMainRoomButtons(true, true)).toEqual({
      primary: { action: 'listen', label: W.listen },
      secondary: { action: 'bring', label: W.bring },
    });
    expect(seMainRoomButtons(true, false).secondary).toEqual({ action: 'sign-up', label: W.signUpToSpeak });
  });

  it('keeps the first button the same signed in and signed out', () => {
    expect(seMainRoomButtons(false, false).primary).toEqual(seMainRoomButtons(false, true).primary);
    expect(seMainRoomButtons(true, false).primary).toEqual(seMainRoomButtons(true, true).primary);
  });
});

describe('seGuestMainRoom', () => {
  const talk = { title: 'Talk', host: 'host', startIso: '2026-11-18T23:00:00Z', endIso: '2026-11-19T00:30:00Z', onAir: false };
  const today: SeTodayRoom = { key: 'main', name: 'Main Room', live: false, members: 0, guests: 0, speakers: 3, faces: [], href: '/x', nextTalk: talk };

  it('takes the talk from Today and live and counts from the room read', () => {
    const room = seGuestMainRoom(today, { isLive: true, participantCount: 2, guestCount: 4 });
    expect(room).toMatchObject({ live: true, members: 2, guests: 4, speakers: 2, nextTalk: talk, href: '/x' });
  });

  it('stands in a plain Main Room before Today loads', () => {
    const room = seGuestMainRoom(null, { isLive: false, participantCount: 0, guestCount: 0 });
    expect(room).toMatchObject({ name: 'Main Room', live: false, members: 0, speakers: 0, faces: [], nextTalk: null });
  });
});
