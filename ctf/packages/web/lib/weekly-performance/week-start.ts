// A week here starts on an ISO Monday (DATE_TRUNC('week', ...) in the repository). A value that is
// not a real calendar date makes every `$1::date` cast throw, and each metric then reads 0, so a bad
// date has to be refused before any query runs rather than answered with a set of zeros.
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Why `value` is not a usable week start, or null when it is one. `name` is the query parameter, so
// the 400 message names the value the caller has to fix.
export function weekStartProblem(name: string, value: string): string | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return `${name} must be an ISO date (YYYY-MM-DD); got "${value}".`;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return `${name} is not a real calendar date; got "${value}".`;
  }
  if (date.getUTCDay() !== 1) {
    return `${name} must be the Monday a week starts on; "${value}" is not a Monday.`;
  }
  return null;
}
