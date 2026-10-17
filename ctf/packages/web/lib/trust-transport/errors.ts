// A requester accepting a ServiceCredits offer without the credits it settles for (owner decision,
// 2026-10-17; issue #2866). Carries both numbers so the refusal can say what the member has and needs;
// only the requester sees it, because only the requester presses accept.
export class InsufficientTripCreditsError extends Error {
  constructor(
    readonly available: number,
    readonly needed: number,
  ) {
    super('insufficient_trip_credits');
    this.name = 'InsufficientTripCreditsError';
  }
}
