// The lock-screen text of an instant-call ring. With discreet pings on (the default for every
// member), the ring says what the shared notifications path says, `Charging The Future` / `You have
// a new update.` (maybeSendDevicePush in lib/notifications/repository.ts), so a shared or monitored
// phone shows neither who is calling nor through which service. The data block is not shown on the
// lock screen; it keeps the ring's tap target and its stay-on-screen behavior in the service worker.
export type RingPushPayload = {
  title: string;
  body: string;
  data: { type: 'foundation.instant_call.ring'; callId: string; url: string };
};

export function buildRingPushPayload(input: {
  callerName: string;
  callId: string;
  url: string;
  discreet: boolean;
}): RingPushPayload {
  const data = { type: 'foundation.instant_call.ring' as const, callId: input.callId, url: input.url };
  if (input.discreet) {
    return { title: 'Charging The Future', body: 'You have a new update.', data };
  }
  return { title: 'Incoming call', body: `${input.callerName} is calling you on Foundation`, data };
}
