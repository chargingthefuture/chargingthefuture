// Types and plain-text formatting for the Unlock help log (lib/comic/unlock-help-log.ts). Kept apart
// from the database read so the admin screen, a client component, can import them without pulling the
// database client into the browser bundle.

export type UnlockHelpOutcome = 'approved' | 'waiting' | 'not_approved' | 'no_submission';

export type UnlockHelpLogRow = {
  turnId: string;
  askedAtIso: string;
  helpCase: string;
  question: string;
  userId: string;
  username: string | null;
  reviewStatus: string | null;
  answer: string | null;
  outcome: UnlockHelpOutcome;
  // Full days from asking to approval; null unless approved. Can be negative for a member approved
  // before a question that was still in flight.
  daysToApproval: number | null;
};

export type UnlockHelpCaseSummary = {
  helpCase: string;
  asked: number;
  answered: number;
  corrected: number;
  approvedAfter: number;
};

export type UnlockHelpLog = {
  rows: UnlockHelpLogRow[];
  summary: UnlockHelpCaseSummary[];
  truncated: boolean;
};

// One line per case, counted across the rows shown. `answered` is a reply the member actually got
// (approved as drafted or corrected); `corrected` is how often the reviewer had to change it.
export function summarizeUnlockHelp(rows: readonly UnlockHelpLogRow[]): UnlockHelpCaseSummary[] {
  const byCase = new Map<string, UnlockHelpCaseSummary>();
  for (const row of rows) {
    const entry = byCase.get(row.helpCase) ?? { helpCase: row.helpCase, asked: 0, answered: 0, corrected: 0, approvedAfter: 0 };
    entry.asked += 1;
    if (row.reviewStatus === 'approved' || row.reviewStatus === 'corrected') entry.answered += 1;
    if (row.reviewStatus === 'corrected') entry.corrected += 1;
    if (row.outcome === 'approved') entry.approvedAfter += 1;
    byCase.set(row.helpCase, entry);
  }
  return [...byCase.values()].sort((a, b) => b.asked - a.asked);
}

const OUTCOME_LABEL: Record<UnlockHelpOutcome, string> = {
  approved: 'approved',
  waiting: 'submitted, waiting for review',
  not_approved: 'submitted, not approved',
  no_submission: 'no submission yet',
};

export function describeUnlockHelpOutcome(row: UnlockHelpLogRow): string {
  if (row.outcome !== 'approved' || row.daysToApproval === null) return OUTCOME_LABEL[row.outcome];
  if (row.daysToApproval <= 0) return 'approved the same day';
  return `approved ${row.daysToApproval} day${row.daysToApproval === 1 ? '' : 's'} later`;
}

// The entire log as plain text, for the copy button: short enough to paste into a message from a
// phone, one block per conversation.
export function formatUnlockHelpLogText(log: UnlockHelpLog): string {
  const summary = log.summary
    .map((s) => `${s.helpCase}: ${s.asked} asked, ${s.answered} answered (${s.corrected} corrected), ${s.approvedAfter} approved`)
    .join('\n');
  const rows = log.rows
    .map((row) => {
      const who = row.username ? `@${row.username}` : row.userId;
      const answer = row.answer ? `A: ${row.answer}` : `A: (${row.reviewStatus ?? 'no review row'})`;
      return `${row.askedAtIso.slice(0, 10)} · ${row.helpCase} · ${who} · ${describeUnlockHelpOutcome(row)}\nQ: ${row.question}\n${answer}`;
    })
    .join('\n\n');
  return `Unlock help log\n\n${summary}\n\n${rows}`;
}
