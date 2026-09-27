// What to set as the money goal of a Contributions drive so that it covers the running costs.
// Pure and import-safe from a client component, like summary.ts beside it.
//
// The suggestion is the monthly total at the high end of every range, times the length of the drive
// in months, rounded up to a whole dollar. Lines not priced yet and one-off payments are not in it,
// and the screen says so, because a goal set from an incomplete list is set too low.

import { formatDollars, type ExpenseSummary } from './summary';

// Drives run about three months (Contributions inventory §2), so that is the length suggested for
// when none is open.
export const DEFAULT_DRIVE_MONTHS = 3;
const DAYS_PER_MONTH = 365.25 / 12;

// The open Contributions drive, as the expenses route sends it. Dollars here are whole US dollars,
// the unit Contributions stores its goal and its confirmed gift-card money in.
export type DriveProgress = {
  startsAt: string;
  endsAt: string;
  moneyGoalUsd: number;
  moneyConfirmedUsd: number;
};

export type FundraisingSuggestion = {
  // The drive the suggestion is for; null when no drive is open, in which case it is for a
  // DEFAULT_DRIVE_MONTHS drive.
  drive: DriveProgress | null;
  months: number;
  suggestedGoalCents: number;
  // Only while a drive is open: the goal it has now, what is confirmed, and what is still needed to
  // cover the costs over the drive (never below zero).
  currentGoalCents: number | null;
  confirmedCents: number | null;
  stillNeededCents: number | null;
  // Recurring lines without an amount, which the suggestion cannot include.
  unpricedCount: number;
};

function driveMonths(drive: DriveProgress): number {
  const days = (Date.parse(drive.endsAt) - Date.parse(drive.startsAt)) / 86_400_000;
  return Math.max(0, days / DAYS_PER_MONTH);
}

function roundUpToDollar(cents: number): number {
  return Math.ceil(cents / 100) * 100;
}

export function suggestFundraisingGoal(summary: ExpenseSummary, drive: DriveProgress | null): FundraisingSuggestion {
  const months = drive ? driveMonths(drive) : DEFAULT_DRIVE_MONTHS;
  const suggestedGoalCents = roundUpToDollar(summary.monthlyHighCents * months);
  const confirmedCents = drive ? Math.round(drive.moneyConfirmedUsd * 100) : null;
  return {
    drive,
    months,
    suggestedGoalCents,
    currentGoalCents: drive ? Math.round(drive.moneyGoalUsd * 100) : null,
    confirmedCents,
    stillNeededCents: confirmedCents === null ? null : Math.max(0, suggestedGoalCents - confirmedCents),
    unpricedCount: summary.unpriced.length,
  };
}

// "3.0 months" reads as precise; a drive is planned in whole weeks at best, so one decimal.
export function formatMonths(months: number): string {
  const rounded = Math.round(months * 10) / 10;
  return `${rounded} month${rounded === 1 ? '' : 's'}`;
}

export function fundraisingAsPlainText(suggestion: FundraisingSuggestion): string[] {
  const lines = ['', 'Contributions money goal'];
  const goal = formatDollars(suggestion.suggestedGoalCents);
  if (!suggestion.drive) {
    lines.push(`No drive is open. To cover the costs over a ${formatMonths(suggestion.months)} drive, set the goal to ${goal}.`);
  } else {
    lines.push(`Open drive: ${suggestion.drive.startsAt.slice(0, 10)} to ${suggestion.drive.endsAt.slice(0, 10)} (${formatMonths(suggestion.months)})`);
    lines.push(`Suggested goal: ${goal} · goal set now: ${formatDollars(suggestion.currentGoalCents ?? 0)}`);
    lines.push(`Confirmed so far: ${formatDollars(suggestion.confirmedCents ?? 0)} · still needed: ${formatDollars(suggestion.stillNeededCents ?? 0)}`);
  }
  if (suggestion.unpricedCount > 0) {
    lines.push(`Does not include ${suggestion.unpricedCount} cost${suggestion.unpricedCount === 1 ? '' : 's'} not priced yet.`);
  }
  return lines;
}
