import type { FeedbackTotalRow } from './repository';

// The Adoption screen's "What members finish and pass on": per card source and kind, Done, Not for
// me, and the share that is Not for me, most marks first. Shaped here so the screen and the copied
// text say the same thing.

export type FeedbackLine = FeedbackTotalRow & { total: number; notForMeShare: number };

export function feedbackLines(rows: readonly FeedbackTotalRow[]): FeedbackLine[] {
  return rows
    .map((row) => {
      const total = row.done + row.notForMe;
      return { ...row, total, notForMeShare: total === 0 ? 0 : Math.round((row.notForMe / total) * 100) };
    })
    .filter((line) => line.total > 0)
    .sort((a, b) => b.total - a.total || a.source.localeCompare(b.source) || a.kind.localeCompare(b.kind));
}

export function feedbackText(lines: readonly FeedbackLine[], days: number): string {
  const head = `What members finish and pass on, last ${days} days (counts only, nobody named)`;
  if (lines.length === 0) return `${head}\nNo cards marked yet.`;
  const body = lines.map((l) => `${l.source} · ${l.kind}: ${l.done} done, ${l.notForMe} not for me (${l.notForMeShare}% not for me)`);
  return [head, ...body].join('\n');
}
