'use client';

import { useEffect, useRef, useState } from 'react';
import { SE_CARD_WORDS, SE_GUEST_WORDS as W, seAgo, seGuestEmptyLine, seStoryPostHref, type SeGuestConversation, type SeTodayCard } from '@ctf/shared';
import styles from './card-sheet.module.css';

// A card opened on signed-out Today (owner decision, 2026-11-10): read only. A story shows its post's
// Fireside comments; a sample ask or offer shows a sample conversation, tagged as sample; a member's
// story shows only the replies whose writers agreed that visitors may read them, or says its
// conversation is for members. Just us two is shown as private, with a sign-in, and nothing in it is
// read. A blog story shows its teaser and Read the post, to the post, above the conversation.

type Read = { kind: 'loading' } | { kind: 'ready'; conversation: SeGuestConversation } | { kind: 'failed'; message: string };

function useGuestConversation(cardId: string): Read {
  const [read, setRead] = useState<Read>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    fetch(`/api/today/public/cards/${encodeURIComponent(cardId)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { conversation?: SeGuestConversation; message?: string } | null;
        if (!live) return;
        if (res.ok && body?.conversation) setRead({ kind: 'ready', conversation: body.conversation });
        else setRead({ kind: 'failed', message: body?.message ?? `The conversation did not load (status ${res.status}).` });
      })
      .catch((error: unknown) => live && setRead({ kind: 'failed', message: `The conversation did not load: ${error instanceof Error ? error.message : String(error)}` }));
    return () => {
      live = false;
    };
  }, [cardId]);
  return read;
}

function Messages({ read, sampleTag, empty }: { read: Read; sampleTag: React.ReactNode; empty: string }) {
  if (read.kind === 'loading') return <p className={styles.quiet}>{W.loadingConversation}</p>;
  if (read.kind === 'failed') return <p role="alert" className={styles.quiet}>{read.message}</p>;
  if (read.conversation.messages.length === 0) return <p className={styles.quiet}>{empty}</p>;
  return (
    <>
      {read.conversation.sample ? sampleTag : null}
      {read.conversation.messages.map((message) => (
        <div key={message.id} className={styles.bubbleRow}>
          <p className={styles.bubble}>{message.body}</p>
          <span className={styles.bubbleMeta}>
            {message.handle} · {seAgo(message.createdAtIso)}
            {message.editedAtIso ? ` · ${SE_CARD_WORDS.edited}` : ''}
          </span>
        </div>
      ))}
    </>
  );
}

export function GuestSheet({ card, signInUrl, sampleTag, onClose }: { card: SeTodayCard; signInUrl: string; sampleTag: React.ReactNode; onClose: () => void }) {
  const read = useGuestConversation(card.id);
  const postHref = seStoryPostHref(card);
  const [pair, setPair] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => (event.key === 'Escape' ? onClose() : undefined);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={styles.backdrop}>
      <button type="button" className={styles.scrim} aria-label={W.close} tabIndex={-1} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={`${card.label}: ${card.title}`} className={styles.sheet}>
        <span className={styles.grip} aria-hidden="true" />
        <div className={styles.head}>
          <span className={styles.talkTitle}>{card.label}</span>
          <button ref={closeRef} type="button" className={`${styles.round} ${styles.closeEnd}`} aria-label={W.close} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.text}>
          <h2 className={styles.title}>{card.title}</h2>
          {card.body ? <p className={styles.body}>{card.body}</p> : null}
          {postHref ? (
            <a href={postHref} className={styles.openIn} aria-label={`${W.readPost}: ${card.title}`}>
              {W.readPost}
            </a>
          ) : null}
        </div>
        <div className={styles.talk}>
          <div className={styles.talkHead}>
            <span className={styles.talkTitle}>{W.conversation}</span>
            <div role="group" aria-label={SE_CARD_WORDS.whoReads} className={styles.switch}>
              <button type="button" aria-pressed={!pair} className={!pair ? styles.switchOn : styles.switchOff} onClick={() => setPair(false)}>
                {SE_CARD_WORDS.public}
              </button>
              <button type="button" aria-pressed={pair} className={pair ? styles.switchOn : styles.switchOff} onClick={() => setPair(true)}>
                {SE_CARD_WORDS.pair}
              </button>
            </div>
          </div>
          <div className={styles.messages}>{pair ? <p className={styles.quiet}>{W.pairEmpty}</p> : <Messages read={read} sampleTag={sampleTag} empty={seGuestEmptyLine(card)} />}</div>
          <a href={signInUrl} className={`${styles.talkPrimary} ${styles.guestSignIn}`}>
            {pair ? W.pairSignIn : W.signInToWrite}
          </a>
        </div>
      </section>
    </div>
  );
}
