'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SE_CARD_WORDS, SE_MUTE_WORDS, seCardAnswerKind, seCardOpensSheet, type SeCardAnswerKind, type SeTodayCard } from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import { QuestionsPanel, isQuestionsCard } from './questions-panel';
import { CardSheet } from './card-sheet';
import { cardPath } from './use-card-conversation';
import styles from './today.module.css';

// One card in Today. On an ask, offer or story, tapping the text opens the card in place as a sheet
// (card-sheet.tsx), and an answer button (I can help, I know someone, I'd like this, It helped me
// too) records the answer and opens the sheet; other buttons open the item where it lives. Every
// other card expands in place as before. The timeline dot marks it done, and tapping it again marks
// it not done. The ••• menu holds Copy link, Hide and, on a card with an author, Mute and Report.

// The 21 Questions card keeps its lines and is never cut short: it says how matching works.
function bodyClass(card: SeTodayCard, open: boolean): string {
  if (card.source === 'questions') return `${styles.body} ${styles.bodyLines}`;
  return open ? styles.body : `${styles.body} ${styles.bodyClosed}`;
}

function doneLabel(card: SeTodayCard, done: boolean): string {
  if (card.done) return `Done: ${card.title}`;
  return done ? `Done: ${card.title}. Tap to mark not done` : `Mark done: ${card.title}`;
}

function absolute(href: string): string {
  return href.startsWith('http') ? href : `${window.location.origin}${href}`;
}

async function reportCard(card: SeTodayCard): Promise<string> {
  const res = await fetch(cardPath(card.id, '/report'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ authorId: card.author?.accountId }),
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as { message?: string } | null;
  return res?.ok ? SE_CARD_WORDS.reported : (data?.message ?? 'The report was not sent: the app could not be reached.');
}

function menuLabel(onMute: unknown, canReport: boolean): string {
  const items = ['copy link', 'hide', ...(onMute ? ['mute'] : []), ...(canReport ? ['report'] : [])];
  return `More: ${items.join(', ')}`;
}

type MenuProps = { card: SeTodayCard; viewerId: string; onHide: () => void; onMute?: () => void };

function CardMenu({ card, viewerId, onHide, onMute }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState<string | null>(null);
  const canReport = Boolean(card.author && card.author.accountId !== viewerId);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absolute(card.href));
      setCopied(true);
    } catch {
      // no-trace: the browser refused the clipboard; the link stays on the card's own button.
      setCopied(false);
    }
  };
  return (
    <div className={styles.menuWrap}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label={menuLabel(onMute, canReport)}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.menuItem} onClick={() => void copy()}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={onHide}>
            Hide
          </button>
          {onMute && card.author ? (
            <button type="button" role="menuitem" className={styles.menuItem} onClick={onMute}>
              {SE_MUTE_WORDS.mutePerson(card.author.handle)}
            </button>
          ) : null}
          {canReport ? (
            <button type="button" role="menuitem" className={styles.menuItem} disabled={reported !== null} onClick={() => void reportCard(card).then(setReported)}>
              {reported ?? SE_CARD_WORDS.report}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// The timeline dot. A card the server marks done (a 21 Questions answer) stays done: the answer is final.
function DoneDot({ card, done, color, onToggleDone }: { card: SeTodayCard; done: boolean; color: string; onToggleDone: () => void }) {
  return (
    <button
      type="button"
      className={styles.dot}
      style={{ background: color }}
      aria-pressed={done}
      aria-label={doneLabel(card, done)}
      onClick={card.done ? undefined : onToggleDone}
      disabled={card.done === true}
    >
      {done ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--se-bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5 9-10" />
            </svg>
      ) : null}
    </button>
  );
}

function CardHead({ card, viewerId, color, onHide, onMute }: MenuProps & { color: string }) {
  return (
    <div className={styles.cardHead}>
      {card.author ? <SeAvatar accountId={card.author.accountId} size={28} /> : null}
      {card.author ? <span className={styles.handle}>{card.author.handle}</span> : null}
      <span className={styles.label} style={{ color }}>
        {card.label}
      </span>
      <span className={styles.spacer} />
      <CardMenu card={card} viewerId={viewerId} onHide={onHide} onMute={onMute} />
    </div>
  );
}

type Sheet = { firstAnswer: SeCardAnswerKind | null } | null;

function CardActions({ card, onAnswer }: { card: SeTodayCard; onAnswer: ((kind: SeCardAnswerKind) => void) | null }) {
  if (card.actions.length === 0) return null;
  return (
    <div className={styles.actions}>
      {card.actions.map((item) => {
        const answer = onAnswer ? seCardAnswerKind(item.kind) : null;
        return answer && onAnswer ? (
          <button key={item.kind + item.label} type="button" aria-haspopup="dialog" className={styles.actionButton} onClick={() => onAnswer(answer)}>
            {item.label}
          </button>
        ) : (
          <Link key={item.kind + item.label} href={item.href} className={styles.actionButton}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function TodayCard({
  card,
  viewerId,
  read,
  onToggleDone,
  onHide,
  onMute,
  onChanged,
}: {
  card: SeTodayCard;
  // The signed-in member, so the card offers Report only on somebody else's card.
  viewerId: string;
  read: boolean;
  onToggleDone: () => void;
  onHide: () => void;
  onMute?: () => void;
  // A card that changes something (a 21 Questions answer) asks Today to read again.
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const color = `var(--se-kind-${card.kind})`;
  // A card the server marks done (a 21 Questions answer) stays done: the answer is final.
  const done = read || card.done === true;
  const opensSheet = seCardOpensSheet(card);
  const toggle = () => (opensSheet ? setSheet({ firstAnswer: null }) : setOpen((value) => !value));
  return (
    <article className={styles.card}>
      <DoneDot card={card} done={done} color={color} onToggleDone={onToggleDone} />
      <CardHead card={card} viewerId={viewerId} color={color} onHide={onHide} onMute={onMute} />
      <button type="button" className={styles.textButton} aria-expanded={opensSheet ? undefined : open} aria-haspopup={opensSheet ? 'dialog' : undefined} onClick={toggle}>
        <span className={styles.cardTitle}>{card.title}</span>
        {card.body ? <span className={bodyClass(card, open)}>{card.body}</span> : null}
      </button>
      {isQuestionsCard(card) ? <QuestionsPanel card={card} open={open} onOpen={() => setOpen(true)} onChanged={onChanged ?? (() => undefined)} /> : null}
      <CardActions card={card} onAnswer={opensSheet ? (kind) => setSheet({ firstAnswer: kind }) : null} />
      {sheet ? <CardSheet card={card} viewerId={viewerId} firstAnswer={sheet.firstAnswer} onClose={() => setSheet(null)} /> : null}
    </article>
  );
}
