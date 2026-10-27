import type { SeTodayRoom, SeTodayTalk } from '@ctf/shared';
import { countRoomMembers, getPublicRoomLiveState } from 'lib/chyme/repository';
import { CHYME_CONTRIBUTORS_ROOM_KEY } from 'lib/chyme/constants';
import { getContributorAccessConfig, isMemberEligible } from 'lib/contributor-access/repository';
import { getGuide } from 'lib/ti-radio/repository';
import type { TodayViewer } from './card';

// The two rooms at the top of Today: the Main Room, with the TI Radio talk that is on or next, and
// the Weavers of the Commons room for the members who may enter it. Nobody else is told it exists,
// the same rule the room itself keeps.

export async function nextTalk(now = new Date()): Promise<SeTodayTalk | null> {
  const guide = await getGuide({ userId: null, canHost: false, isAdmin: false });
  const nowMs = now.getTime();
  const slot = guide.slots.find((item) => item.booking && Date.parse(item.slotEndIso) > nowMs);
  if (!slot?.booking) return null;
  return {
    title: slot.booking.title,
    host: slot.booking.hostUsername,
    startIso: slot.slotStartIso,
    endIso: slot.slotEndIso,
    onAir: slot.isOnAir,
  };
}

export async function mainRoom(talk: Promise<SeTodayTalk | null>): Promise<SeTodayRoom> {
  const state = await getPublicRoomLiveState();
  return {
    key: 'main',
    name: state.roomName,
    live: state.callActive,
    members: state.participantCount,
    guests: state.guestCount,
    href: '/apps/chyme',
    // A schedule that fails to read leaves the line off rather than the room.
    nextTalk: await talk.catch(() => null),
  };
}

export async function weaversRoom(viewer: TodayViewer): Promise<SeTodayRoom | null> {
  const [config, eligible] = await Promise.all([getContributorAccessConfig(), isMemberEligible(viewer.userId)]);
  if (!config.channelOpen || (!eligible && !viewer.isAdmin)) return null;
  const members = await countRoomMembers(CHYME_CONTRIBUTORS_ROOM_KEY);
  return {
    key: 'weavers',
    name: 'Weavers of the Commons',
    live: members > 0,
    members,
    guests: 0,
    href: '/apps/chyme',
    nextTalk: null,
  };
}
