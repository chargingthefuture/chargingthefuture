'use client';

import Link from 'next/link';
import styles from './admin-landing.module.css';

export type AdminAreaTile = {
  href: string;
  name: string;
  // The area's stable slug (the last path segment). Used to mark the area seen; also the key the
  // server keys the "new to review" signal on. Areas with no review queue simply never set hasNew.
  slug: string;
  hasNew: boolean;
};

// The admin landing tile grid. A client component (the server page computes hasNew) so opening a tile
// can mark that area seen — which clears its "new to review" dot. Marking seen is fire-and-forget: a
// failure is harmless (the dot just shows again next time until a mark lands).
export function AdminAreaGrid({ areas }: { areas: AdminAreaTile[] }) {
  const markSeen = (slug: string) => {
    void fetch('/api/admin/area-seen', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ areaSlug: slug }),
    }).catch(() => undefined);
  };

  return (
    <ul className={styles.grid}>
      {areas.map((area) => (
        <li key={area.href}>
          <Link
            href={area.href}
            className={styles.card}
            onClick={() => markSeen(area.slug)}
            aria-label={area.hasNew ? `${area.name} — new items to review` : undefined}
          >
            {area.hasNew ? <span className={styles.newDot} aria-hidden="true" /> : null}
            <span className={styles.cardName}>{area.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
