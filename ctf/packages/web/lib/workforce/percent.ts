// Formatting for the Workforce overview's "% of goal" figure.
//
// The goal is the full headcount target (~2,000,000 people), so for a long time the percentage is a
// very small number: 100 people recruited is 0.005% of it. Rounded to one decimal place that
// printed as "0% of goal", which is not true — 100 people is not zero — and it read as failure next
// to a card showing 100. This keeps enough decimal places that any non-zero count shows a non-zero
// percentage, and stays short once the figure grows.
//
// What each count shows against a 2,000,000 goal:
//
// | Recruited | Shown      |
// |-----------|------------|
// | 1         | 0.0001%    |
// | 100       | 0.005%     |
// | 384       | 0.019%     |
// | 1,000     | 0.05%      |
// | 20,000    | 1%         |
// | 200,000   | 10%        |
//
// Under the previous one-decimal formatting it took 1,000 people before anything other than "0%"
// appeared. Nothing else changes: the number is the same true ratio, just printed with the decimal
// places it needs.

// The most decimal places worth printing. Four keeps a single person out of two million visible
// (0.0001%) without turning the figure into a wall of zeros.
const MAX_DECIMALS = 4;

export function formatPercentOfGoal(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) {
    return '0';
  }
  // Above 1%, one decimal place is plenty. Below it, use enough places to keep two meaningful
  // digits, so the figure never collapses to zero.
  const decimals = percent >= 1 ? 1 : Math.min(MAX_DECIMALS, Math.ceil(-Math.log10(percent)) + 1);
  const rounded = Number(percent.toFixed(decimals));
  if (rounded <= 0) {
    // Smaller than the most decimal places we are willing to print. Say that rather than "0".
    return `<${(10 ** -MAX_DECIMALS).toFixed(MAX_DECIMALS)}`;
  }
  return rounded.toLocaleString(undefined, { maximumFractionDigits: decimals });
}
