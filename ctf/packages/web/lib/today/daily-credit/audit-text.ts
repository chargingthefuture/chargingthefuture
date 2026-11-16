import {
  dailyCreditStatusLabel,
  type DailyCreditLogRow,
  type DailyCreditSummaries,
} from './audit-summary';

// The visible page of the daily credit audit log as plain text, for the copy control: pasted into a
// message from a phone, it reads without any formatting. Credits are counted, never priced.

export type NameOf = (userId: string) => string;

function rowLines(row: DailyCreditLogRow, nameOf: NameOf): string[] {
  const helpers = row.helpers.length > 0 ? row.helpers.map((helper, index) => `${index + 1}. ${nameOf(helper.userId)}`).join(', ') : 'nobody';
  const picked = row.pickedUserId
    ? `${nameOf(row.pickedUserId)}${row.pickedFirst ? ' (first to answer)' : row.pickedAnswered ? ' (not the first to answer)' : ' (did not answer I can help)'}`
    : 'nobody yet';
  const lines = [
    `${row.day} · card ${row.cardId}`,
    `  Asker: ${nameOf(row.askerUserId)}`,
    `  I can help: ${helpers}`,
    `  Picked: ${picked}${row.confirmedAt ? ` at ${row.confirmedAt}` : ''}`,
    `  Credit: ${dailyCreditStatusLabel(row)}${row.grantedAt ? ` at ${row.grantedAt}` : ''}`,
  ];
  if (row.flagged) lines.push(`  Flag: this asker picked this helper ${row.pairCount} times`);
  return lines;
}

function summaryLines(summaries: DailyCreditSummaries, nameOf: NameOf): string[] {
  const lines = ['', 'Pairs picked three or more times:'];
  if (summaries.repeatPairs.length === 0) lines.push('  none');
  summaries.repeatPairs.forEach((pair) => lines.push(`  ${nameOf(pair.askerUserId)} → ${nameOf(pair.helperUserId)}: ${pair.count}`));
  lines.push('', 'Askers (cards closed · distinct helpers picked · picked someone other than the first answer):');
  if (summaries.askers.length === 0) lines.push('  none');
  summaries.askers.forEach((entry) => lines.push(`  ${nameOf(entry.askerUserId)}: ${entry.closed} · ${entry.distinctHelpers} · ${entry.pickedNotFirst}`));
  lines.push('', 'Helpers (credits granted · held for Unlock · distinct askers):');
  if (summaries.helpers.length === 0) lines.push('  none');
  summaries.helpers.forEach((entry) => lines.push(`  ${nameOf(entry.helperUserId)}: ${entry.granted} · ${entry.held} · ${entry.distinctAskers}`));
  return lines;
}

export function dailyCreditLogAsPlainText(input: {
  page: number;
  pageCount: number;
  total: number;
  rows: DailyCreditLogRow[];
  summaries: DailyCreditSummaries;
  nameOf: NameOf;
}): string {
  const lines = [`Daily credit log, page ${input.page} of ${input.pageCount} (${input.total} days in all)`, ''];
  input.rows.forEach((row) => lines.push(...rowLines(row, input.nameOf), ''));
  lines.push(...summaryLines(input.summaries, input.nameOf));
  return lines.join('\n');
}
