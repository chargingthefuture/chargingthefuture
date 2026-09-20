// The participant count under the room name, and when the cap belongs in it.
//
// The room read always carries the cap in force, but printing "1 of 50 participants" all day reads
// as a claim — that the room is capped at 50, or that 50 people ought to be there (owner report,
// 2026-09-19). The cap only means something once the room is filling up and somebody may be turned
// away, so the line names it only then: from 80% of the cap it reads "41 of 50 participants ·
// nearly full", and at the cap "50 of 50 participants · full". Below that it is the plain count.

export const CHYME_CAPACITY_ADVISORY_SHARE = 0.8;

export function chymeCapacityAdvisory(current: number, max: number): 'none' | 'nearly_full' | 'full' {
  if (max <= 0) return 'none';
  if (current >= max) return 'full';
  if (current >= Math.ceil(max * CHYME_CAPACITY_ADVISORY_SHARE)) return 'nearly_full';
  return 'none';
}

export function chymeParticipantLine(current: number, max: number, guests: number = 0): string {
  const advisory = chymeCapacityAdvisory(current, max);
  const members =
    advisory === 'full'
      ? `${current} of ${max} participants · full`
      : advisory === 'nearly_full'
        ? `${current} of ${max} participants · nearly full`
        : `${current} ${current === 1 ? 'participant' : 'participants'}`;
  // Guests are counted against their own cap, not the member cap, so they are named after the
  // capacity part rather than folded into it: "40 of 50 participants · nearly full" stays a
  // statement about the member cap, and the guests are a second, separate number.
  if (guests <= 0) return members;
  return `${members} · ${guests} ${guests === 1 ? 'guest' : 'guests'} listening`;
}

// Who is in the room, for a reader who is not inside the member roster — the signed-out listener's
// own line (owner report, 2026-09-20: the page said "1 member in the room" to a guest who was
// there too, so the count under-reported the room by exactly the person reading it).
//
// Members and guests are different things — a member can speak, a guest can only listen — so the
// line gives both rather than one merged number, and leads with the total so the size of the room
// is the first thing read. With nobody signed out there is no split worth printing, so the line
// falls back to the plain member count it has always been.
export function chymeAttendanceLine(memberCount: number, guestCount: number): string {
  const members = Math.max(0, memberCount);
  const guests = Math.max(0, guestCount);
  const total = members + guests;
  if (total === 0) return 'nobody in the room yet';
  if (guests === 0) return `${members} ${members === 1 ? 'member' : 'members'} in the room`;
  if (members === 0) return `${guests} ${guests === 1 ? 'guest' : 'guests'} listening`;
  return `${total} in the room · ${members} ${members === 1 ? 'member' : 'members'}, ${guests} ${guests === 1 ? 'guest' : 'guests'}`;
}
