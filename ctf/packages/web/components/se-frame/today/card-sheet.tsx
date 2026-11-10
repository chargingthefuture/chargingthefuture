'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SE_CARD_WORDS, seCardSheetLine, type SeCardAnswerKind, type SeCardConversation, type SeTodayCard } from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import { CardTalk } from './card-sheet-talk';
import { SheetYours } from './card-sheet-yours';
import { useCardConversation, type CardConversation } from './use-card-conversation';
import styles from './card-sheet.module.css';

// A Today card opened in place (the approved 3.1 board "a card opened in place"): a sheet rising
// over Today with the author, Share, ••• and Close; the title and body; who answered and how, each
// with Talk here; then the conversation, public or Just us two. Never a new page.

export function absoluteCardLink(href: string): string {
  return href.startsWith('http') ? href : `${window.location.origin}${href}`;
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} className={styles.round} onClick={onClick}>
      {children}
    </button>
  );
}

async function shareCard(card: SeTodayCard): Promise<boolean> {
  const url = absoluteCardLink(card.href);
  try {
    if (navigator.share) {
      await navigator.share({ title: card.title, url });
      return false;
    }
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // no-trace: the member closed the share sheet, or the browser refused the clipboard.
    return false;
  }
}

function SheetMenu({ card, talk, viewerId }: { card: SeTodayCard; talk: CardConversation; viewerId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const author = card.author && card.author.accountId !== viewerId ? card.author : null;
  if (!author) return null;
  const report = async () => setDone(await talk.report({ authorId: author.accountId }));
  return (
    <div className={styles.menuWrap}>
      <RoundButton label={SE_CARD_WORDS.more} onClick={() => setOpen((value) => !value)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </RoundButton>
      {open ? (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.menuItem} disabled={done} onClick={() => void report()}>
            {done ? SE_CARD_WORDS.reported : SE_CARD_WORDS.report}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SheetHead({ card, talk, viewerId, onClose, closeRef }: SheetProps & { talk: CardConversation; closeRef: React.RefObject<HTMLButtonElement | null> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.head}>
      {card.author ? <SeAvatar accountId={card.author.accountId} size={32} /> : null}
      <div className={styles.who}>
        {card.author ? <span className={styles.handle}>{card.author.handle}</span> : null}
        <span className={styles.when} style={{ color: `var(--se-kind-${card.kind})` }}>
          {seCardSheetLine(card)}
        </span>
      </div>
      <span className={styles.spacer} />
      <RoundButton label={copied ? SE_CARD_WORDS.linkCopied : SE_CARD_WORDS.share} onClick={() => void shareCard(card).then(setCopied)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
      </RoundButton>
      <SheetMenu card={card} talk={talk} viewerId={viewerId} />
      <button ref={closeRef} type="button" aria-label={SE_CARD_WORDS.close} className={styles.round} onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function Answers({ conversation, onTalk }: { conversation: SeCardConversation; onTalk: (accountId: string) => void }) {
  if (conversation.answers.length === 0) return null;
  return (
    <div className={styles.answers}>
      <span className={styles.answersTitle}>{SE_CARD_WORDS.answered(conversation.answers.length)}</span>
      {conversation.answers.map((answer, index) => {
        const mine = answer.accountId === conversation.viewerId;
        return (
          <div key={answer.accountId} className={styles.answer}>
            <SeAvatar accountId={answer.accountId} size={30} />
            <span className={styles.answerText}>
              <b>{mine ? SE_CARD_WORDS.you : answer.handle}</b> {SE_CARD_WORDS.answerLine(answer.kinds)}
            </span>
            {mine ? null : (
              <button type="button" className={index === 0 ? styles.talkPrimary : styles.talkButton} onClick={() => onTalk(answer.accountId)}>
                {SE_CARD_WORDS.talkHere}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Who answered and the conversation, public or Just us two: the part of a card that is the same
// wherever it is shown, in this sheet on Today and in the panel on the plugin's own page
// (card-conversation-panel.tsx), so 3.0 and 3.1 read and write one conversation.
export function CardConversationView({ talk }: { talk: CardConversation }) {
  const [partner, setPartner] = useState<string | null>(null);
  const talkTo = async (accountId: string) => {
    const open = talk.conversation?.pairs.some((pair) => pair.partnerId === accountId);
    if (open || (await talk.ask(accountId))) setPartner(accountId);
  };
  return (
    <>
      {talk.conversation ? <Answers conversation={talk.conversation} onTalk={(id) => void talkTo(id)} /> : null}
      <CardTalk talk={talk} partner={partner} onPartner={setPartner} onTalk={(id) => void talkTo(id)} />
    </>
  );
}

type SheetProps = { card: SeTodayCard; viewerId: string; onClose: () => void };

export function CardSheet({ card, viewerId, firstAnswer, onClose, onChanged }: SheetProps & { firstAnswer: SeCardAnswerKind | null; onChanged?: () => void }) {
  const talk = useCardConversation(card.id, firstAnswer);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => (event.key === 'Escape' ? onClose() : undefined);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={styles.backdrop}>
      {/* Tapping the dimmed Today behind the sheet closes it; the Close button and Escape do the same. */}
      <button type="button" className={styles.scrim} aria-label={SE_CARD_WORDS.close} tabIndex={-1} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={`${card.label}: ${card.title}`} className={styles.sheet}>
        <span className={styles.grip} aria-hidden="true" />
        <SheetHead card={card} talk={talk} viewerId={viewerId} onClose={onClose} closeRef={closeRef} />
        <div className={styles.text}>
          <h2 className={styles.title}>{card.title}</h2>
          {card.body ? <p className={styles.body}>{card.body}</p> : null}
          <Link href={card.href} className={styles.openIn}>
            {SE_CARD_WORDS.openIn(card.source)}
          </Link>
        </div>
        <SheetYours card={card} onChanged={onChanged} />
        <CardConversationView talk={talk} />
      </section>
    </div>
  );
}
