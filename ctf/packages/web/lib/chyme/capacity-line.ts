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

export function chymeParticipantLine(current: number, max: number): string {
  const advisory = chymeCapacityAdvisory(current, max);
  if (advisory === 'full') return `${current} of ${max} participants · full`;
  if (advisory === 'nearly_full') return `${current} of ${max} participants · nearly full`;
  return `${current} ${current === 1 ? 'participant' : 'participants'}`;
}
