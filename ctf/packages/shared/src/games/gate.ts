// Who may play the puzzle of the day (owner decision, 2026-11-10): any signed-in member, approved or
// not ("3.1 open sign-up use"). Anyone may open it and read what today's puzzle is; the play itself
// is sent only to a signed-in member whose account is not restricted. Web decides on the server
// (lib/games/play-gate.ts); Android from whether the app is signed in.

export type SeDailyGate = 'play' | 'sign-in' | 'closed' | 'unavailable';

export const SE_DAILY_GATE_WORDS = {
  about:
    'One puzzle a day, the same for everyone, taking turns between the word of the day, the picture of the day and the word ladder. No timer, no streak, no ranking, and no way to fail.',
  'sign-in': { title: 'Sign in to play', body: "Anyone can see what today's puzzle is. Playing it is for members.", button: 'Sign in' },
  closed: { title: 'Playing is closed for this account', body: 'This account is restricted, so the puzzle cannot be played from it.', button: null },
  unavailable: { title: 'Could not check whether you can play', body: 'Try again in a moment.', button: null },
} as const;

// What an access decision means for the puzzle: no session is Sign in, and any other refusal (a
// restricted account) is closed.
export function seDailyGateFor(decision: { allowed: boolean; status?: number; reason?: string }): SeDailyGate {
  if (decision.allowed) return 'play';
  if (decision.status === 401) return 'sign-in';
  return 'closed';
}
