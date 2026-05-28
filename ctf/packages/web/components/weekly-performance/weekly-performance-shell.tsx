import { getCurrentWeek, getWeekMetrics, listWeeks } from 'lib/weekly-performance/repository';
import { WeeklyPerformanceBrowser } from './weekly-performance-browser';

type WeeklyPerformanceShellProps = {
  isAdmin: boolean;
};

export async function WeeklyPerformanceShell({ isAdmin }: WeeklyPerformanceShellProps) {
  const [weeks, currentWeek] = await Promise.all([
    listWeeks().catch(() => []),
    getCurrentWeek().catch(() => null),
  ]);

  const initialMetrics = currentWeek
    ? await getWeekMetrics(currentWeek.weekStartDate).catch(() => [])
    : [];

  return (
    <WeeklyPerformanceBrowser
      initialWeeks={weeks}
      initialMetrics={initialMetrics}
      isAdmin={isAdmin}
    />
  );
}
