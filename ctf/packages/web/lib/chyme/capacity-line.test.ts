import { describe, expect, it } from 'vitest';
import { chymeAttendanceLine, chymeCapacityAdvisory, chymeParticipantLine } from './capacity-line';

// The cap is named only once it matters: from 80% of it, and at it. Below that the line is the
// plain count, so a quiet room never reads as "1 of 50".

describe('chymeParticipantLine', () => {
  it('prints the plain count well under the cap', () => {
    expect(chymeParticipantLine(1, 50)).toBe('1 participant');
    expect(chymeParticipantLine(39, 50)).toBe('39 participants');
  });

  it('names the cap from 80% of it', () => {
    expect(chymeCapacityAdvisory(40, 50)).toBe('nearly_full');
    expect(chymeParticipantLine(40, 50)).toBe('40 of 50 participants · nearly full');
  });

  it('says full at the cap and beyond', () => {
    expect(chymeParticipantLine(50, 50)).toBe('50 of 50 participants · full');
    expect(chymeCapacityAdvisory(51, 50)).toBe('full');
  });

  it('never names a cap of zero', () => {
    expect(chymeParticipantLine(3, 0)).toBe('3 participants');
  });

  it('names signed-out listeners after the capacity part, never inside it', () => {
    expect(chymeParticipantLine(1, 50, 1)).toBe('1 participant · 1 guest listening');
    expect(chymeParticipantLine(2, 50, 3)).toBe('2 participants · 3 guests listening');
    // The cap is the member cap, so guests never move the "N of M" or the advisory.
    expect(chymeParticipantLine(50, 50, 4)).toBe('50 of 50 participants · full · 4 guests listening');
  });

  it('says nothing about guests when there are none', () => {
    expect(chymeParticipantLine(2, 50, 0)).toBe('2 participants');
    expect(chymeParticipantLine(2, 50)).toBe('2 participants');
  });
});

// The listener's own line. It reads the room from outside the member roster, so it has to count
// the reader too: a guest listening beside one member is a room of two, not "1 member in the room".

describe('chymeAttendanceLine', () => {
  it('gives the total and the split when both kinds are present', () => {
    expect(chymeAttendanceLine(1, 1)).toBe('2 in the room · 1 member, 1 guest');
    expect(chymeAttendanceLine(3, 2)).toBe('5 in the room · 3 members, 2 guests');
  });

  it('falls back to the plain member count with nobody signed out', () => {
    expect(chymeAttendanceLine(1, 0)).toBe('1 member in the room');
    expect(chymeAttendanceLine(4, 0)).toBe('4 members in the room');
  });

  it('counts guests alone when no member is in the call', () => {
    expect(chymeAttendanceLine(0, 1)).toBe('1 guest listening');
    expect(chymeAttendanceLine(0, 3)).toBe('3 guests listening');
  });

  it('says the room is empty rather than printing a zero', () => {
    expect(chymeAttendanceLine(0, 0)).toBe('nobody in the room yet');
  });

  it('treats a negative count as none', () => {
    expect(chymeAttendanceLine(-2, 2)).toBe('2 guests listening');
  });
});
