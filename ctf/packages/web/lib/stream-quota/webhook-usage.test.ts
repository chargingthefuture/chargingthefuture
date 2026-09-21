import { describe, expect, it } from 'vitest';
import { participantLeftUsage, surfaceForCallCid } from './webhook-usage';

// The webhook meter credits the calls that have no heartbeat and never the ones that do: a Chyme
// minute must not be counted twice, and an odd payload must be ignored rather than thrown on.

describe('surfaceForCallCid', () => {
  it('names the three heartbeat-less surfaces by call id prefix', () => {
    expect(surfaceForCallCid('livestream:beacon-abc')).toBe('beacon');
    expect(surfaceForCallCid('default:pp-cohort-1')).toBe('peer-programming');
    expect(surfaceForCallCid('default:foundation-call-123')).toBe('foundation');
  });

  it('skips Chyme rooms and Back Channel calls, which the heartbeats meter', () => {
    expect(surfaceForCallCid('default:chyme-main-room')).toBeNull();
    expect(surfaceForCallCid('default:back-channel-9')).toBeNull();
  });

  it('files an unknown call under other and ignores a missing cid', () => {
    expect(surfaceForCallCid('default:something-new')).toBe('other');
    expect(surfaceForCallCid(undefined)).toBeNull();
  });
});

describe('participantLeftUsage', () => {
  it('reads entire seconds from a participant-left event', () => {
    expect(participantLeftUsage({ type: 'call.session_participant_left', call_cid: 'default:pp-1', duration_seconds: 125.9 })).toEqual({
      surface: 'peer-programming',
      seconds: 125,
    });
  });

  it('ignores other events, zero durations, and heartbeat-metered calls', () => {
    expect(participantLeftUsage({ type: 'call.session_participant_joined', call_cid: 'default:pp-1', duration_seconds: 10 })).toBeNull();
    expect(participantLeftUsage({ type: 'call.session_participant_left', call_cid: 'default:pp-1', duration_seconds: 0 })).toBeNull();
    expect(participantLeftUsage({ type: 'call.session_participant_left', call_cid: 'default:chyme-main-room', duration_seconds: 60 })).toBeNull();
    expect(participantLeftUsage({ type: 'call.session_participant_left', call_cid: 'default:pp-1' })).toBeNull();
  });
});
