import { evaluatePluginAccess } from 'lib/auth/server-authz';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import styles from './admin-landing.module.css';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getAdminAreaAttention } from 'lib/admin/area-attention';
import { AdminAreaGrid, type AdminAreaTile } from './admin-area-grid';

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
  // The Stream Video minute meter: how much of the month's live-audio allowance the Chyme rooms
  // have used, the band it puts the room under, and what the policy is pausing because of it.
  { href: '/admin/chyme', name: 'Chyme: Live Audio Usage' },
  { href: '/admin/click-log', name: 'ClickLog Trends' },
  { href: '/admin/contributions', name: 'Contributions' },
  // How many members traded with another member on a day, against the 384 target. Counts people
  // per day rather than accumulating a total, because the goal is a day's worth of members working
  // with each other, not a headcount that only ever rises. The Weavers of the Commons badge admin
  // (eligible members, weights, the gated channel) sits on the same screen, because both readings
  // score the same events with the same weights (owner decision, 2026-09-25).
  { href: '/admin/daily-exchange', name: 'Daily Exchange and Badge' },
  { href: '/admin/directory', name: 'Directory' },
  // Everybody listed in the Directory who does not have an invite post on the blog yet, with
  // their skills, and a control that copies the list as plain text. It had no row here, which
  // left it reachable only by typing the address.
  { href: '/admin/directory/invite-queue', name: 'Directory: Invite Queue' },
  // Every profile still carrying a free-text skill that was proposed and not promoted, with a
  // control to drop the chip. A non-promotion used to leave the chip on the profile for good, with
  // no way to clear it short of a statement against the database.
  { href: '/admin/directory/pending-skill-proposals', name: 'Directory: Pending Skill Proposals' },
  // Moderating member-authored Commons posts and replies (hide / put back). Kept separate from the
  // announcements area below, which is an authoring tool for the owner's own announcements — this
  // one carries a different power, over someone else's words.
  { href: '/admin/commons', name: 'Commons Moderation' },
  // Named for the Commons, the member-facing surface these announcements land on — the same name
  // the Account & Data screen uses for this service.
  { href: '/admin/feed-announcements', name: 'Commons: Feed & Announcements' },
  // Review of member-contributed writing for the assistant's library. Its own area rather than a tab
  // inside AI Assistant: it has its own queue, and a contribution waiting to be read should show up
  // in the admin directory on its own.
  { href: '/admin/comic/contributions', name: 'Contributed Writing' },
  // Curation of the assistant's grounding library: switch what the assistant can quote off/on.
  { href: '/admin/comic/knowledge', name: 'AI Knowledge Base' },
  // Read-only: each @comic question about Unlock from a member not yet approved, and whether that
  // member was approved afterward. What tells a working help path from one to rewrite.
  { href: '/admin/comic/unlock-help', name: 'Unlock Help Log' },
  // Moderating the conversation under the blog posts: the blog-export queue, every comment, the
  // conversations themselves, and the audit trail.
  { href: '/admin/fireside', name: 'Fireside' },
  { href: '/admin/foundation', name: 'Foundation' },
  { href: '/admin/skill-up', name: 'SkillUp' },
  // GDP's only admin surface, and it holds one control: the picture of the report to post. The
  // index itself is live with no publish step, so nothing here changes a figure.
  { href: '/admin/gdp', name: 'GDP' },
  { href: '/admin/lighthouse', name: 'LightHouse' },
  // Read-only review of who confirms whose recurring arrangements — the two-sided confirmation rule
  // stops one member inflating their own standing, not a small group confirming each other's.
  { href: '/admin/recurring-activity', name: 'Recurring Activity Review' },
  // Mutual Time has no /admin/* route — its admin dashboard (create/manage polls) lives at
  // /apps/mutual-time (MutualTimeAdmin renders there for admins), so this row points there.
  { href: '/apps/mutual-time', name: 'Mutual Time' },
  { href: '/admin/peer-programming', name: 'PeerProgramming' },
  // Self-reports from the public Quora account-deletion survey. The only place those responses are
  // readable, and the place the consent flags are checked before anything is quoted or named.
  { href: '/admin/quora-deletion-survey', name: 'Quora Deletion Survey' },
  // The observational half of the same research: fixed-date snapshots of accounts still standing,
  // coded by what they say. The survey records only what was removed, so the two answer different
  // questions and are read together.
  { href: '/admin/quora-live-census', name: 'Quora Live Account Census' },
  // One post a day for the Skills Economy space, written in advance so a short-lived account can
  // say one complete thing in the minutes it has. The ask rotates between the three Peace Battle 2
  // actions and nothing repeats until the pool is exhausted.
  { href: '/admin/quora-message-of-the-day', name: 'Quora Message of the Day' },
  { href: '/admin/safety', name: 'Safety Reports' },
  { href: '/admin/service-credits', name: 'ServiceCredits' },
  { href: '/admin/skills-hunt', name: 'SkillsHunt' },
  { href: '/admin/socket-relay', name: 'SocketRelay' },
  { href: '/admin/trust-transport', name: 'TrustTransport' },
  { href: '/admin/weekly-performance', name: 'Weekly Performance' },
  // The sign-in record behind the dashboard's Active Members rows, read as a health check: opening
  // it records the admin's own sign-in and shows what the database did with the write.
  { href: '/admin/weekly-performance/sign-in-record', name: 'Weekly Performance: Sign-in Record' },
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
