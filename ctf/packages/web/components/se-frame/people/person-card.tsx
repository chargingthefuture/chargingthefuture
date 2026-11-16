'use client';

import { SE_PEOPLE_WORDS as W, SE_PERSON_SHEET_WORDS as S, sePersonLine, sePersonLinks, sePersonListedOnly, type SePerson } from '@ctf/shared';
import { ShareLink } from '@/components/shared/share-link';
import { SeAvatar } from '../../shared/se-avatar';
import { SE_PILL_STYLE } from './pill-style';
import styles from './people.module.css';

// One person, built to the approved board "People, verified": the face, the name with Member (a
// claimed profile) or Listed, the job title and place, Foundation offerings filled and Directory
// listings outlined. Under them, as the Directory has them: Profile (opens the person's profile in a
// sheet), the Quora profile when there is one (the shared link control: see the address, copy it or
// open it), and Request a quote only when they offer something (the Foundation request, in a sheet).
// Nothing here opens a 3.0 page.

export type PersonSheet = { kind: 'profile' | 'quote'; person: SePerson };

export function PersonCard({ person, onSheet }: { person: SePerson; onSheet: (_sheet: PersonSheet) => void }) {
  const links = sePersonLinks(person);
  const listed = sePersonListedOnly(person);
  const line = sePersonLine(person);
  return (
    <article className={styles.card} aria-label={person.name}>
      <span className={styles.face} aria-hidden="true">
        <SeAvatar accountId={person.id} size={48} />
      </span>
      <div className={styles.body}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{person.name}</span>
          <span className={styles.tag}>{person.claimed ? W.member : W.listedTag}</span>
        </div>
        {line ? <span className={styles.line}>{line}</span> : null}
        {person.offering.length > 0 ? <Skills label={W.offering} skills={person.offering} offering /> : null}
        {listed.length > 0 ? <Skills label={W.listed} skills={listed} /> : null}
        <div className={styles.actions}>
          {links.canQuote ? (
            <button type="button" className={styles.quote} aria-label={S.openQuote(person.name)} onClick={() => onSheet({ kind: 'quote', person })}>
              {W.quote}
            </button>
          ) : null}
          <button type="button" className={styles.quote} aria-label={S.openProfile(person.name)} onClick={() => onSheet({ kind: 'profile', person })}>
            {W.profile}
          </button>
          {links.quora ? (
            <ShareLink url={links.quora} title={S.quoraTitle} ariaLabel={S.quoraFor(person.name)} className={styles.quote} triggerStyle={SE_PILL_STYLE}>
              {W.quora}
            </ShareLink>
          ) : null}
        </div>
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
