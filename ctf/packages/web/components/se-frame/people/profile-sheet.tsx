'use client';

import { useState } from 'react';
import { SE_PERSON_SHEET_WORDS as W, SE_TRUST_WORDS, sePersonSheetPath, seTrustPath, type SePersonProfile } from '@ctf/shared';
import { ShareLink } from '@/components/shared/share-link';
import { BlockMemberButton } from '@/components/blocks/block-member-button';
import { SeAvatar } from '../../shared/se-avatar';
import { TrustReadView } from '../trust/trust-read-view';
import { useTrust } from '../trust/use-trust';
import { SE_PILL_STYLE } from './pill-style';
import { PersonSheetFrame } from './person-sheet-frame';
import { usePersonProfile } from './use-person-sheets';
import styles from './person-sheet.module.css';

// A person's profile, opened in place from People: what the Directory's profile page shows (name,
// username, headline, where the profile came from, sector, job title, place, the Quora profile,
// About, skills and, for a claimed profile, trust as the Directory profile shows it, never a score)
// and the actions it offers (Share, the Quora profile, Request a quote for somebody
// offering a skill, Block for a claimed profile that is not the viewer's own). Read from the
// Directory's own route; approved members only, as People is.

type Props = { profileId: string; name: string; viewerId: string | null; canQuote: boolean; onQuote: () => void; onClose: () => void };

function Identity({ p }: { p: SePersonProfile }) {
  return (
    <div className={styles.identity}>
      <span className={styles.face} aria-hidden="true">
        <SeAvatar accountId={p.id} size={64} />
      </span>
      <div className={styles.who}>
        <div className={styles.nameRow}>
          <h2 className={styles.name}>{p.name}</h2>
          <span className={styles.tag}>{p.claimedByUserId ? W.member : W.listed}</span>
          {p.weavers ? <span className={styles.tag}>{W.weavers}</span> : null}
        </div>
        {p.username ? <span className={styles.soft}>@{p.username}</span> : null}
        {p.headline ? <span className={styles.headline}>{p.headline}</span> : null}
        {p.communityGenerated && !p.claimedByUserId ? <span className={styles.origin}>{W.communityGenerated}</span> : null}
        {p.communityGenerated && p.nominatedBy ? <span className={styles.soft}>{W.nominatedBy(p.nominatedBy)}</span> : null}
        {[p.sector, p.jobTitle, p.place].some(Boolean) ? (
          <span className={styles.soft}>{[p.jobTitle, p.sector, p.place].filter(Boolean).join(' · ')}</span>
        ) : null}
      </div>
    </div>
  );
}

function Quora({ p }: { p: SePersonProfile }) {
  if (!p.quora) return null;
  return (
    <ShareLink url={p.quora} title={W.quoraTitle} label={W.quora} ariaLabel={W.quoraFor(p.name)} className={styles.pill} triggerStyle={SE_PILL_STYLE}>
      {W.quora}
    </ShareLink>
  );
}

function Skills({ p }: { p: SePersonProfile }) {
  return (
    <section className={styles.section} aria-label={W.skills}>
      <h3 className={styles.label}>{W.skills}</h3>
      {p.skills.length + p.pendingSkills.length === 0 ? <p className={styles.soft}>{W.noSkills}</p> : null}
      <div className={styles.chips}>
        {p.skills.map((skill) => (
          <span key={skill} className={styles.chip}>
            {skill}
          </span>
        ))}
        {p.pendingSkills.map((skill) => (
          <span key={`pending-${skill}`} className={styles.pending} title={W.pendingHint}>
            {skill} · {W.pending}
          </span>
        ))}
      </div>
    </section>
  );
}

// What another member gets of this person's trust; on the viewer's own profile, their own lines and
// what others get, as on the Directory's profile page. Only a claimed profile has trust.
function Trust({ userId, own }: { userId: string; own: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const read = useTrust(seTrustPath(userId, own), attempt);
  return (
    <section className={styles.section} aria-label={SE_TRUST_WORDS.title}>
      <h3 className={styles.label}>{SE_TRUST_WORDS.title}</h3>
      <TrustReadView read={read} own={own} onRetry={() => setAttempt((n) => n + 1)} />
    </section>
  );
}

function Body({ p, viewerId, canQuote, onQuote }: { p: SePersonProfile; viewerId: string | null; canQuote: boolean; onQuote: () => void }) {
  const own = viewerId !== null && p.claimedByUserId === viewerId;
  return (
    <>
      <Identity p={p} />
      <div className={styles.actions}>
        {canQuote ? (
          <button type="button" className={styles.primary} aria-label={W.openQuote(p.name)} onClick={onQuote}>
            {W.request}
          </button>
        ) : null}
        <Quora p={p} />
        <ShareLink url={sePersonSheetPath(p.id)} title={W.shareTitle} label={W.share} ariaLabel={W.shareFor(p.name)} className={styles.pill} triggerStyle={SE_PILL_STYLE}>
          {W.share}
        </ShareLink>
      </div>
      {p.quora ? null : (
        <div className={styles.quiet}>
          <strong>{W.noQuora}</strong> {W.noQuoraText}
        </div>
      )}
      {p.bio ? (
        <section className={styles.section} aria-label={W.about}>
          <h3 className={styles.label}>{W.about}</h3>
          <p className={styles.bio}>{p.bio}</p>
        </section>
      ) : null}
      <Skills p={p} />
      {p.claimedByUserId ? <Trust userId={p.claimedByUserId} own={own} /> : null}
      {p.claimedByUserId && !own ? <BlockMemberButton targetUserId={p.claimedByUserId} displayName={p.name} /> : null}
    </>
  );
}

export function ProfileSheet({ profileId, name, viewerId, canQuote, onQuote, onClose }: Props) {
  const [attempt, setAttempt] = useState(0);
  const read = usePersonProfile(profileId, attempt);
  return (
    <PersonSheetFrame title={W.profileTitle} label={`${W.profileTitle}: ${name}`} onClose={onClose}>
      {read.kind === 'loading' ? (
        <p className={styles.soft} role="status">
          {W.loadingProfile}
        </p>
      ) : null}
      {read.kind === 'failed' ? (
        <p role="alert" className={styles.soft}>
          {read.message}{' '}
          <button type="button" className={styles.textButton} onClick={() => setAttempt((n) => n + 1)}>
            {W.tryAgain}
          </button>
        </p>
      ) : null}
      {read.kind === 'ready' ? <Body p={read.value} viewerId={viewerId} canQuote={canQuote} onQuote={onQuote} /> : null}
    </PersonSheetFrame>
  );
}
