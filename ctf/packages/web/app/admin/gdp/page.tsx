import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import GdpShell from '@/components/gdp/gdp-shell';

// The GDP admin page, which exists for one thing: the control that turns this report into a
// picture to post (owner directive, 2026-09-20 — that control belongs in admin, and GDP had no
// admin page to put it on).
//
// It renders the **member screen itself**, not an admin version of it, with the share control
// switched on. That is deliberate and is what keeps the picture one to one with what a member sees
// (rule 130): there is no second layout here that could drift from the one being advertised.
//
// It brings back no governance controls. The Community Value Index has been live with no publish
// step since 2026-07-11, when the currency-rate admin surface was removed because the contribution
// weights became fixed in code. Nothing on this page changes a figure; it only takes a picture of
// them.
export const dynamic = 'force-dynamic';

export default async function GdpAdminPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps/gross-domestic-product');
  }

  return <GdpShell sharePicture />;
}
