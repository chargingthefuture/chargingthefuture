import { describe, expect, it } from 'vitest';
import { buildRingPushPayload } from './ring-push';

describe('buildRingPushPayload', () => {
  const base = { callerName: 'river_m', callId: 'call-1', url: '/apps/foundation' };

  it('names neither the caller nor Foundation when discreet pings are on', () => {
    const payload = buildRingPushPayload({ ...base, discreet: true });
    expect(payload.title).toBe('Charging The Future');
    expect(payload.body).toBe('You have a new update.');
    expect(`${payload.title} ${payload.body}`).not.toMatch(/river_m|Foundation|call/i);
  });

  it('keeps the tap target and ring type either way', () => {
    for (const discreet of [true, false]) {
      expect(buildRingPushPayload({ ...base, discreet }).data).toEqual({
        type: 'foundation.instant_call.ring',
        callId: 'call-1',
        url: '/apps/foundation',
      });
    }
  });

  it('names the caller when the member turned discreet pings off', () => {
    const payload = buildRingPushPayload({ ...base, discreet: false });
    expect(payload.title).toBe('Incoming call');
    expect(payload.body).toBe('river_m is calling you on Foundation');
  });
});
