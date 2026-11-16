'use client';

import { useId } from 'react';
import { SE_TRUST_WORDS as W, seTrustLineDate, seTrustLineText, summarizeTrustEvidenceForPeer, type SeTrustItem, type SeTrustView } from '@ctf/shared';
import styles from './trust.module.css';

// The trust lines, in the 3.1 look, for Me → Trust and a profile in People. On the member's own
// trust: their lines, then exactly the lines another member gets, made by the same function the
// route runs. On anybody else's: the one list the route answered. Never a score.

function Line({ item }: { item: SeTrustItem }) {
  const date = seTrustLineDate(item);
  return (
    <li className={styles.line}>
      <span className={styles.lineHead}>
        <svg className={styles.tick} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12l5 5 9-10" />
        </svg>
        <span className={styles.lineText}>{seTrustLineText(item)}</span>
        {date && item.createdAt ? (
          <time className={styles.date} dateTime={item.createdAt}>
            {date}
          </time>
        ) : null}
      </span>
      {item.details ? <span className={styles.details}>{item.details}</span> : null}
    </li>
  );
}

function Lines({ items }: { items: readonly SeTrustItem[] }) {
  return (
    <ul className={styles.lines}>
      {items.map((item, index) => (
        <Line key={`${item.type}-${index}`} item={item} />
      ))}
    </ul>
  );
}

function Empty({ own }: { own: boolean }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{W.emptyTitle}</p>
      <p className={styles.soft}>{own ? W.emptyOwn : W.emptyOther}</p>
      {own ? (
        <ul className={styles.steps}>
          {W.steps.map((step) => (
            <li key={step} className={styles.step}>
              <span className={styles.ring} aria-hidden="true" />
              {step}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MembersSee({ evidence }: { evidence: readonly SeTrustItem[] }) {
  const rows = summarizeTrustEvidenceForPeer(evidence);
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h3 id={id} className={styles.label}>
        {W.membersSee}
      </h3>
      <p className={styles.soft}>{W.membersSeeText}</p>
      {rows.length === 0 ? (
        <p className={styles.soft}>{W.membersSeeEmpty}</p>
      ) : (
        <>
          <p className={styles.note}>{W.summaryNote}</p>
          <Lines items={rows} />
        </>
      )}
    </section>
  );
}

export function TrustLines({ view, own }: { view: SeTrustView; own: boolean }) {
  const id = useId();
  if (view.evidence.length === 0) return <Empty own={own} />;
  if (!own) {
    return (
      <>
        {view.disclosure === 'summary' ? <p className={styles.note}>{W.summaryNote}</p> : null}
        <Lines items={view.evidence} />
      </>
    );
  }
  return (
    <>
      <section className={styles.section} aria-labelledby={id}>
        <h3 id={id} className={styles.label}>
          {W.yours}
        </h3>
        <Lines items={view.evidence} />
      </section>
      <MembersSee evidence={view.evidence} />
    </>
  );
}
