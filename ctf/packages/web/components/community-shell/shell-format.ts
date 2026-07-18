// Compact number formatting shared across the community shell (hero stats, sidebar footer count).
// Renders large counts as "4.9M" / "$300B" so a big member count or economy value stays readable in
// a small stat block instead of a long digit string. Extracted here so the chat panel and the
// sidebar format identically from one source.
export function formatScaledValue(value: number | null, prefix = ''): string {
  if (!value) return `${prefix}0`;
  if (value >= 1_000_000_000) return `${prefix}${(value / 1_000_000_000).toFixed(0)}B`;
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
  return `${prefix}${value.toLocaleString()}`;
}
