import { redirect } from 'next/navigation';

// The badge's admin sections live on the Daily exchange screen, beside the daily count they share
// their events and weights with (owner decision, 2026-09-25). This address stays so an old link or
// bookmark still lands there; that screen does its own admin check.
export default function ContributorAccessAdminPage() {
  redirect('/admin/daily-exchange#weavers');
}
