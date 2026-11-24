import { seDaysWonTrend } from '@ctf/shared';
import styles from './today.module.css';

const W = 96;
const H = 40;

// This week's days won added up day by day, beside the number: one line and a dot where it ends,
// no axes. Decorative; the sentence under it says the same in words.
export function DaysWonTrend({ days }: { days: number[] | undefined }) {
  const trend = seDaysWonTrend(days, W, H);
  if (!trend) return null;
  return (
    <svg className={styles.daysWonTrend} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-testid="days-won-trend">
      <polyline points={trend.points} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={trend.end.x} cy={trend.end.y} r={3} fill="currentColor" />
    </svg>
  );
}
