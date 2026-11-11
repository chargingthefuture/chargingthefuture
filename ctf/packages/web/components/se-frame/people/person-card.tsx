'use client';

import Link from 'next/link';
import { SE_PEOPLE_WORDS as W, sePersonLine, sePersonLinks, sePersonListedOnly, type SePerson } from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import styles from './people.module.css';

// One person, built to the approved board "People, verified": the face, the name with Member (a
// claimed profile) or Listed, the job title and place, Foundation offerings filled and Directory
// listings outlined, and Request a quote only when they offer something. The card itself opens the
// Directory profile: the name is the link and covers the card, with Request a quote above it.
export function PersonCard({ person }: { person: SePerson }) {
  const links = sePersonLinks(person);
  const listed = sePersonListedOnly(person);
  const line = sePersonLine(person);
  return (
    <article className={styles.card}>
      <span className={styles.face} aria-hidden="true">
        <SeAvatar accountId={person.id} size={48} />
      </span>
      <div className={styles.body}>
        <div className={styles.nameRow}>
          <Link href={links.profile} className={styles.name}>
            {person.name}
          </Link>
          <span className={styles.tag}>{person.claimed ? W.member : W.listedTag}</span>
        </div>
        {line ? <span className={styles.line}>{line}</span> : null}
        {person.offering.length > 0 ? <Skills label={W.offering} skills={person.offering} offering /> : null}
        {listed.length > 0 ? <Skills label={W.listed} skills={listed} /> : null}
        {links.quote ? (
          <Link href={links.quote} className={styles.quote}>
            {W.quote}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function Skills({ label, skills, offering }: { label: string; skills: string[]; offering?: boolean }) {
  return (
    <div className={styles.skills}>
      <span className={offering ? styles.offeringLabel : styles.skillsLabel}>{label}</span>
      {skills.map((skill) => (
        <span key={skill} className={offering ? styles.offering : styles.listed}>
          {skill}
        </span>
      ))}
    </div>
  );
}
