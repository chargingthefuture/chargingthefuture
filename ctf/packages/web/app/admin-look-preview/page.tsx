'use client';

import { useSearchParams } from 'next/navigation';
import { AdminSeScope } from '@/components/shared/admin-se-scope';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { AdminAreaGrid } from '../admin/admin-area-grid';
import { SafetyAdminShell } from '@/components/safety/safety-admin-shell';
import { AdoptionShell } from '@/components/adoption/adoption-shell';
import { DirectoryInviteQueueShell } from '@/components/directory/directory-invite-queue-shell';
import styles from '../admin/admin-landing.module.css';

export default function Preview() {
  const s = useSearchParams().get('s');
  return (
    <AdminSeScope>
      {s === 'safety' ? <SafetyAdminShell /> : s === 'adoption' ? <AdoptionShell /> : s === 'invite' ? <DirectoryInviteQueueShell /> : (
        <div className={styles.page}>
          <MobileScreenHeader title="System Architect" backHref="/" />
          <div className={styles.inner}>
            <AdminAreaGrid areas={['Adoption', 'Unlock', 'AI Assistant', 'Beacon', 'Bug Reports', 'Daily Posts'].map((name, i) => ({ href: '/admin/x' + i, name, slug: 'x' + i, hasNew: i === 1 }))} />
          </div>
        </div>
      )}
    </AdminSeScope>
  );
}
