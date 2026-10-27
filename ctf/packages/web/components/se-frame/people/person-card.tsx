'use client';

import Link from 'next/link';
import { SE_PEOPLE_WORDS as W, sePersonLinks, type SePerson } from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import styles from './people.module.css';

// One person: Foundation offerings filled, Directory listings outlined. Request a quote only when
// they offer something.
export function PersonCard({ person }: { person: SePerson }) {
  const links = sePersonLinks(person);
  const listed = person.listed.filter((skill) => !person.offering.includes(skill));
  return (
    <article className={styles.card} aria-label={person.name}>
      <div className={styles.head}>
        <SeAvatar accountId={person.id} size={44} />
        <div className={styles.who}>
          <span className={styles.name}>{person.name}</span>
          {person.jobTitle || person.headline ? <span className={styles.meta}>{person.jobTitle ?? person.headline}</span> : null}
        </div>
      </div>
      {person.offering.length > 0 ? (
        <div className={styles.skills} aria-label={W.offering}>
          {person.offering.map((skill) => (
            <span key={skill} className={styles.offering}>
              {skill}
            </span>
          ))}
        </div>
      ) : null}
      {listed.length > 0 ? (
        <div className={styles.skills} aria-label={W.listed}>
          {listed.map((skill) => (
            <span key={skill} className={styles.listed}>
              {skill}
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.actions}>
        <Link href={links.profile} className={styles.button}>
          {W.profile}
        </Link>
        {links.quote ? (
          <Link href={links.quote} className={styles.primary}>
            {W.quote}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
