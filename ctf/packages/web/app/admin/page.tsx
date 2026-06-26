import { evaluatePluginAccess } from 'lib/auth/server-authz';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import styles from './admin-landing.module.css';
import { AdminAiStatusBadge } from './admin-ai-status-badge';

export const dynamic = 'force-dynamic';

// The admin landing page: a single directory of every admin area. Each link points at a
// route that is itself server-role-gated, so this page only renders for admins. Keep this
// list in step with the pages under app/admin/* — add a row when a new admin area ships.
const ADMIN_AREAS: { href: string; name: string; description: string }[] = [
  { href: '/admin/unlock', name: 'Unlock', description: 'Review and decide who gets full access to the app.' },
  { href: '/admin/directory', name: 'Directory', description: 'Manage member directory listings and visibility.' },
  { href: '/admin/socketrelay', name: 'SocketRelay', description: 'Moderate mutual-aid requests and offers.' },
  { href: '/admin/lighthouse', name: 'LightHouse', description: 'Manage LightHouse listings and review reports.' },
  { href: '/admin/trust-transport', name: 'TrustTransport', description: 'Oversee transport coordination and disputes.' },
  { href: '/admin/comic', name: 'AI Assistant', description: 'Review answers from the @comic assistant before they post.' },
  { href: '/admin/what-works', name: 'WhatWorks', description: 'Curate problems and the products that solve them.' },
  { href: '/admin/skills-hunt', name: 'SkillsHunt', description: 'Manage missions, scouts, and the leaderboard.' },
  { href: '/admin/peer-programming', name: 'PeerProgramming', description: 'Set topics and manage pairing assignments.' },
  { href: '/admin/levelup', name: 'LevelUp', description: 'Run skills-training cohorts and stipend milestones.' },
  { href: '/admin/weekly-performance', name: 'Weekly Performance', description: 'Manage weekly performance reporting.' },
  { href: '/admin/workforce', name: 'Workforce', description: 'Manage workforce records and assignments.' },
  { href: '/admin/foundation', name: 'Foundation', description: 'Manage foundation-level settings and records.' },
  { href: '/admin/contributions', name: 'Contributions', description: 'Run fundraising drives and review the donation queue.' },
  { href: '/admin/service-credits', name: 'ServiceCredits', description: 'Treasury, disputes, and governance for the credits ledger.' },
  { href: '/admin/gdp', name: 'GDP', description: 'Manage GDP figures.' },
  { href: '/admin/gdp/rates', name: 'GDP Rates', description: 'Manage GDP exchange and conversion rates.' },
  { href: '/admin/feed-announcements', name: 'Feed Announcements', description: 'Post and manage announcements in the community feed.' },
  { href: '/admin/beacon', name: 'Beacon', description: 'Go live and run broadcast events; manage recordings.' },
  { href: '/admin/bug-reports', name: 'Bug Reports', description: 'Review reports flagged for a human and track ones sent to triage.' },
  { href: '/admin/safety', name: 'Safety Reports', description: 'Review members flagged as a safety concern when blocked.' },
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

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconChip}>
            <ShieldCheck size={18} color="#6366F1" />
          </div>
          <div>
            <div className={styles.title}>Admin</div>
            <div className={styles.subtitle}>Pick an area to manage. Each area is restricted to admins.</div>
          </div>
          <span className={styles.badge}>ADMIN</span>
        </div>

        <AdminAiStatusBadge />

        <ul className={styles.grid}>
          {ADMIN_AREAS.map((area) => (
            <li key={area.href}>
              <Link href={area.href} className={styles.card}>
                <span className={styles.cardName}>{area.name}</span>
                <span className={styles.cardDesc}>{area.description}</span>
              </Link>
            </li>
          ))}
        </ul>

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
