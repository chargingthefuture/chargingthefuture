import { evaluatePluginAccess } from 'lib/auth/server-authz';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import styles from './admin-landing.module.css';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getAdminAreaAttention } from 'lib/admin/area-attention';
import { AdminAreaGrid, type AdminAreaTile } from './admin-area-grid';
import { AdminRefreshButton } from './admin-refresh-button';

// The area's stable slug is the last segment of its href (e.g. /admin/bug-reports → 'bug-reports'),
// which is the key the attention signal and the seen-marker are keyed on.
function areaSlug(href: string): string {
  return href.split('/').filter(Boolean).pop() ?? href;
}

export const dynamic = 'force-dynamic';

// The admin landing page: a single directory of every admin area. Each link points at a
// route that is itself server-role-gated, so this page only renders for admins. Keep this
// list in step with the pages under app/admin/* — add a row when a new admin area ships.
// Compact launcher (owner decision, 2026-07-19): names only — no descriptions — so two columns
// fit even at phone width and the list needs far less scrolling. Alphabetical, except Unlock
// and AI Assistant pinned to the top (the two areas checked constantly).
const ADMIN_AREAS: { href: string; name: string }[] = [
  { href: '/admin/unlock', name: 'Unlock' },
  { href: '/admin/comic', name: 'AI Assistant' },
  { href: '/admin/beacon', name: 'Beacon' },
  { href: '/admin/bug-reports', name: 'Bug Reports' },
  { href: '/admin/click-log', name: 'ClickLog Trends' },
  { href: '/admin/contributions', name: 'Contributions' },
  { href: '/admin/contributor-access', name: 'Contributor Access' },
  { href: '/admin/directory', name: 'Directory' },
  // Moderating member-authored Commons posts and replies (hide / put back). Kept separate from Feed
  // Announcements, which is an authoring tool for the owner's own announcements — this one carries a
  // different power, over someone else's words.
  { href: '/admin/commons', name: 'Commons Moderation' },
  { href: '/admin/feed-announcements', name: 'Feed Announcements' },
  // Review of member-contributed writing for the assistant's library. Its own area rather than a tab
  // inside AI Assistant: it has its own queue, and a contribution waiting to be read should show up
  // in the admin directory on its own.
  { href: '/admin/comic/contributions', name: 'Contributed Writing' },
  // Curation of the assistant's grounding library: switch what the assistant can quote off/on.
  { href: '/admin/comic/knowledge', name: 'AI Knowledge Base' },
  { href: '/admin/foundation', name: 'Foundation' },
  { href: '/admin/level-up', name: 'LevelUp' },
  { href: '/admin/lighthouse', name: 'LightHouse' },
  // Read-only review of who confirms whose recurring arrangements — the two-sided confirmation rule
  // stops one member inflating their own standing, not a small group confirming each other's.
  { href: '/admin/recurring-activity', name: 'Recurring Activity Review' },
  // Mutual Time has no /admin/* route — its admin dashboard (create/manage polls) lives at
  // /apps/mutual-time (MutualTimeAdmin renders there for admins), so this row points there.
  { href: '/apps/mutual-time', name: 'Mutual Time' },
  { href: '/admin/peer-programming', name: 'PeerProgramming' },
  { href: '/admin/safety', name: 'Safety Reports' },
  { href: '/admin/service-credits', name: 'ServiceCredits' },
  { href: '/admin/skills-hunt', name: 'SkillsHunt' },
  { href: '/admin/socket-relay', name: 'SocketRelay' },
  // Verification review: set a member's trust status (verified / flagged) with an evidence note.
  { href: '/admin/trust', name: 'Trust' },
  { href: '/admin/trust-transport', name: 'TrustTransport' },
  { href: '/admin/weekly-performance', name: 'Weekly Performance' },
  { href: '/admin/what-works', name: 'WhatWorks' },
  { href: '/admin/workforce', name: 'Workforce' },
];

export default async function AdminPage() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });

  if (!decision.allowed) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.header}>
            <div className={styles.iconChip}>
              <ShieldCheck size={18} color="#6366F1" />
            </div>
            <div>
              <div className={styles.title}>Admin access denied</div>
              <div className={styles.subtitle}>Request blocked by server-side role policy.</div>
            </div>
            <span className={styles.badge}>ADMIN</span>
          </div>

          <div className={styles.denyCard}>
            <div className={styles.denyRow}>
              <span className={styles.denyLabel}>HTTP status</span>
              <span>{decision.status}</span>
            </div>
            <div className={styles.denyRow}>
              <span className={styles.denyLabel}>Deny code</span>
              <span>{decision.code}</span>
            </div>
            <div className={styles.denyRow}>
              <span className={styles.denyLabel}>Reason</span>
              <span>{decision.reason}</span>
            </div>
          </div>

          <div className={styles.footer}>
            <Link className={styles.link} href="/">
              ← Return to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Per-area "new to review" flags for this admin. Best-effort: on any failure every tile simply shows
  // no dot (the landing must always render).
  const attention = await getAdminAreaAttention(decision.userId).catch(() => ({} as Record<string, boolean>));
  const tiles: AdminAreaTile[] = ADMIN_AREAS.map((area) => {
    const slug = areaSlug(area.href);
    return { href: area.href, name: area.name, slug, hasNew: attention[slug] === true };
  });

  return (
    <div className={styles.page}>
      {/* Consistent one-level-up back control: from the admin directory, back goes to the home hub.
          The shared header resolves the destination from the path (see resolveBackTarget). */}
      <MobileScreenHeader
        title="Admin"
        accent="#6366F1"
        icon={<ShieldCheck size={18} color="#6366F1" />}
        actions={<AdminRefreshButton />}
      />
      {/* No in-page title card here: the header above already names the screen and carries the icon
          and back control. Repeating it cost a screen of phone height for no new information (owner
          report, 2026-07-27) — every admin surface now goes straight to content after the nav bar. */}
      <div className={styles.inner}>
        <AdminAreaGrid areas={tiles} />

        <div className={styles.footer}>
          Signed in as <span className={styles.footerStrong}>{decision.userId}</span> · role{' '}
          <span className={styles.footerStrong}>{decision.role ?? 'not set'}</span> ·{' '}
          <Link className={styles.link} href="/">
            Return to home
          </Link>
        </div>
      </div>
    </div>
  );
}
