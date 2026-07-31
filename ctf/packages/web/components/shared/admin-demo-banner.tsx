import styles from './admin-demo-banner.module.css';

// Loud banner shown across every /admin screen when the signed-in operator is a demo participant.
// Admin tools (approve, retry rewards, mint, burn) run against whichever DB schema the caller's demo
// flag selects (getActivePool -> isDemoMode), so a demo-mode operator can act on demo data without
// realizing it — e.g. a governance burn that hits an empty demo wallet and fails as "Insufficient
// balance.". This makes the demo context impossible to miss. Rendered only in demo mode, so the normal
// production operator view is unchanged.
//
// Positioning (see the CSS module): fixed/overlay on desktop so it never shifts a shell's fixed 100dvh
// layout; sticky/in-flow on phones so it reserves its own height instead of covering the shell's header
// and back button (an installed PWA has no browser back to fall back on).
export function AdminDemoBanner() {
  return (
    <div role="status" aria-live="polite" className={styles.banner}>
      ⚠ Demo mode — you are acting on demo data, not production. Approvals, reward retries, mints, and
      burns here change the demo schema only. Turn off demo mode to operate production.
    </div>
  );
}
