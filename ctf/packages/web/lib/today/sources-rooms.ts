import type { SeTodayRoom, SeTodayTalk } from '@ctf/shared';
import { getPublicRoomLiveState, readRoomFaces } from 'lib/chyme/repository';
import { CHYME_CONTRIBUTORS_ROOM_KEY } from 'lib/chyme/constants';
import { getContributorAccessConfig, isMemberEligible } from 'lib/contributor-access/repository';
import { getGuide } from 'lib/ti-radio/repository';
import type { TodayViewer } from './card';

// The two rooms at the top of Today: the Main Room, with the TI Radio talk that is on or next, and
// the Weavers of the Commons room for the members who may enter it. Nobody else is told it exists,
// the same rule the room itself keeps.

const WEEK_MS = 7 * 86_400_000;

// Every booked talk that has not ended, through the next 7 days, oldest first: the week strip, and
// the first of them is the room card's talk.
export async function weekTalks(now = new Date()): Promise<SeTodayTalk[]> {
  const guide = await getGuide({ userId: null, canHost: false, isAdmin: false });
  const nowMs = now.getTime();
  const talks: SeTodayTalk[] = [];
  for (const slot of guide.slots) {
    if (!slot.booking || Date.parse(slot.slotEndIso) <= nowMs || Date.parse(slot.slotStartIso) > nowMs + WEEK_MS) continue;
    talks.push({ title: slot.booking.title, host: slot.booking.hostUsername, startIso: slot.slotStartIso, endIso: slot.slotEndIso, onAir: slot.isOnAir });
  }
  return talks.sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso));
}

export async function nextTalk(week: Promise<SeTodayTalk[]>): Promise<SeTodayTalk | null> {
  return (await week)[0] ?? null;
}

// `withFaces` is false on signed-out Today, which never names who is in the room.
export async function mainRoom(talk: Promise<SeTodayTalk | null>, withFaces = true): Promise<SeTodayRoom> {
  const [state, stage] = await Promise.all([getPublicRoomLiveState(), withFaces ? readRoomFaces() : null]);
  return {
    key: 'main',
    name: state.roomName,
    live: state.callActive,
    members: state.participantCount,
    guests: state.guestCount,
    speakers: stage?.speakers ?? 0,
    faces: stage?.faces ?? [],
    href: '/apps/chyme',
    // A schedule that fails to read leaves the line off rather than the room.
    nextTalk: await talk.catch(() => null),
  };
}

export async function weaversRoom(viewer: TodayViewer): Promise<SeTodayRoom | null> {
  const [config, eligible] = await Promise.all([getContributorAccessConfig(), isMemberEligible(viewer.userId)]);
  if (!config.channelOpen || (!eligible && !viewer.isAdmin)) return null;
  const stage = await readRoomFaces(CHYME_CONTRIBUTORS_ROOM_KEY);
  return {
    key: 'weavers',
    name: 'Weavers of the Commons',
    live: stage.members > 0,
    members: stage.members,
    guests: 0,
    speakers: stage.speakers,
    faces: stage.faces,
    href: '/apps/chyme',
    nextTalk: null,
  };
}
