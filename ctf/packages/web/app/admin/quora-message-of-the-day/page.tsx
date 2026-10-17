import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { QuoraMotdShell, type QuoraMotdDay } from '@/components/quora-motd/quora-motd-shell';
import { motdProtestDay, motdToday, quoraMotdSchedule, quoraMotdAll } from 'lib/quora-motd/select';
import { motdDayLine } from 'lib/quora-motd/types';

// Admin-only, and deliberately not public. Every message here is written to be pasted into the
// Skills Economy space before it appears anywhere else, and a page listing the pool in advance
// would put the text on the open web first — which is the thing the blog's paste sheets exist to
// avoid, so that a rebuilt account can post the same piece without it matching something already
// published.

export const dynamic = 'force-dynamic';

const UPCOMING_DAYS = 14;

function label(date: string): string {
  const [y, m, d] = date.split('-').map((part) => Number.parseInt(part, 10));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export default async function QuoraMessageOfTheDayPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps');
  }

  const now = new Date();
  const schedule = quoraMotdSchedule(motdToday(now), UPCOMING_DAYS + 1);
  // Today reads the clock as it stands now; each later row is one more than the row before it.
  const protestDay = motdProtestDay(now);
  const days: QuoraMotdDay[] = schedule.map((pick, offset) => ({
    date: pick.date,
    label: label(pick.date),
    day: protestDay + offset,
    dayLine: motdDayLine(protestDay + offset),
    message: pick.message,
  }));

  return (
    <QuoraMotdShell today={days[0]} upcoming={days.slice(1)} poolSize={quoraMotdAll().length} />
  );
}
