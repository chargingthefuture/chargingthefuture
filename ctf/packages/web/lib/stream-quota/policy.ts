import {
  chymeMaxGuestListeners,
  chymeMaxParticipants,
  chymeRedBandMaxParticipants,
  type StreamQuotaBand,
} from './constants';

// What the app does at each band of the Stream Video meter (rule 110):
//
//   Green   nothing changes.
//   Yellow  members are told the month is getting tight; nothing is paused yet.
//   Orange  the optional Video consumers pause: guest listening (unauthenticated, unbounded) and
//           Back Channel 1:1 calls (a second Stream call per pair). Members keep the room.
//   Red     baseline first: the room itself stays up for a small number of members, the optional
//           consumers stay paused, and the notice says so.
//
// The member-facing notice says what is paused and why in plain words and nothing more. Rule 110
// keeps the meter's numbers off member screens; the admin usage screen carries them.

export type ChymeQuotaPolicy = {
  band: StreamQuotaBand;
  // How many members may be in one room at once under this band.
  memberCap: number;
  // How many signed-out listeners may be in the public room at once (0 while paused).
  guestCap: number;
  guestListenAllowed: boolean;
  backChannelAllowed: boolean;
  // Shown to members inside the room; null when there is nothing to say.
  memberNotice: string | null;
  // Shown to a signed-out visitor in place of the listen button while guests are paused.
  guestPausedReason: string | null;
};

export function resolveChymeQuotaPolicy(band: StreamQuotaBand): ChymeQuotaPolicy {
  const fullMemberCap = chymeMaxParticipants();
  const fullGuestCap = chymeMaxGuestListeners();

  switch (band) {
    case 'green':
      return {
        band,
        memberCap: fullMemberCap,
        guestCap: fullGuestCap,
        guestListenAllowed: true,
        backChannelAllowed: true,
        memberNotice: null,
        guestPausedReason: null,
      };
    case 'yellow':
      return {
        band,
        memberCap: fullMemberCap,
        guestCap: fullGuestCap,
        guestListenAllowed: true,
        backChannelAllowed: true,
        memberNotice:
          'Live audio is getting close to its monthly limit. If it gets closer, listening without an account and Back Channel calls pause until next month; the room itself stays open.',
        guestPausedReason: null,
      };
    case 'orange':
      return {
        band,
        memberCap: fullMemberCap,
        guestCap: 0,
        guestListenAllowed: false,
        backChannelAllowed: false,
        memberNotice:
          'Live audio is close to its monthly limit, so listening without an account and Back Channel calls are paused until next month. The room itself stays open.',
        guestPausedReason:
          'Listening without an account is paused until next month because live audio is close to its monthly limit. Sign in to join the room.',
      };
    case 'red': {
      const memberCap = Math.min(fullMemberCap, chymeRedBandMaxParticipants());
      return {
        band,
        memberCap,
        guestCap: 0,
        guestListenAllowed: false,
        backChannelAllowed: false,
        memberNotice: `Live audio is almost at its monthly limit. Until next month the room holds ${memberCap} people at a time, and listening without an account and Back Channel calls are paused.`,
        guestPausedReason:
          'Listening without an account is paused until next month because live audio is almost at its monthly limit. Sign in to join the room.',
      };
    }
  }
}
