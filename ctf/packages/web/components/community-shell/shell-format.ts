// Compact number formatting shared across the community shell (hero stats, sidebar footer count).
// Renders large counts as "4.9M" / "$300B" so a big member count or economy value stays readable in
// a small stat block instead of a long digit string. Extracted here so the chat panel and the
// sidebar format identically from one source.
// A missing value (not loaded yet) and a non-finite one both render as "0" — but they are checked
// separately from a real 0 so the guard says what it means. A genuine 0 falls through to the normal
// formatting path below rather than being caught by a truthiness test.
export function formatScaledValue(value: number | null | undefined, prefix = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return `${prefix}0`;
  if (value >= 1_000_000_000) return `${prefix}${(value / 1_000_000_000).toFixed(0)}B`;
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
  return `${prefix}${value.toLocaleString()}`;
}
