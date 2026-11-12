'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { SE_CARD_WORDS, SE_MUTE_WORDS, seCanSave, seCardAnswerKind, seIsMoodCard, seCardOpensSheet, seNewCommentsLine, type SeCardAnswerKind, type SeTodayCard } from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import { QuestionsPanel, isQuestionsCard } from './questions-panel';
import { CardSheet } from './card-sheet';
import { GoalCard } from './goal-card';
import { MoodFaces, SaveHideIcons } from './card-quick-actions';
import { CardFigures } from './card-figures';
import { cardPath } from './use-card-conversation';
import styles from './today.module.css';

// One card in Today. On an ask, offer or story, tapping the text opens the card in place as a sheet
// (card-sheet.tsx), and an answer button (I can help, I know someone, I'd like this, It helped me
// too) records the answer and opens the sheet; other buttons open the item where it lives. Every
// other card expands in place as before. The timeline dot marks it done, and tapping it again marks
// it not done. A story or replay carries Save for later and Hide as icons in its button row, and the
// Mood card its five faces. The ••• menu holds Copy link, Not for me (the card leaves Today on this device),
// Mute this post (the card leaves Today and its conversation sends no notices) on somebody else's
// card and, on a card with an author, Mute and Report.

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

function menuLabel(onMute: unknown, canMutePost: boolean, canReport: boolean): string {
  const items = ['copy link', 'not for me', ...(canMutePost ? ['mute this post'] : []), ...(onMute ? ['mute'] : []), ...(canReport ? ['report'] : [])];
  return `More: ${items.join(', ')}`;
}

type MenuProps = { card: SeTodayCard; viewerId: string; onHide: () => void; onMute?: () => void; onMutePost?: () => void };

// Mute this post is offered on every card but the member's own.
function canMutePost(card: SeTodayCard, viewerId: string, onMutePost?: () => void): onMutePost is () => void {
  return Boolean(onMutePost) && card.author?.accountId !== viewerId;
}

function CardMenu({ card, viewerId, onHide, onMute, onMutePost }: MenuProps) {
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
        aria-label={menuLabel(onMute, canMutePost(card, viewerId, onMutePost), canReport)}
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
            {SE_CARD_WORDS.notForMe}
          </button>
          {canMutePost(card, viewerId, onMutePost) ? (
            <button type="button" role="menuitem" className={styles.menuItem} onClick={onMutePost}>
              {SE_MUTE_WORDS.mutePost}
            </button>
          ) : null}
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

function CardHead({ card, viewerId, color, onHide, onMute, onMutePost }: MenuProps & { color: string }) {
  return (
    <div className={styles.cardHead}>
      {card.author ? <SeAvatar accountId={card.author.accountId} size={28} /> : null}
      {card.author ? <span className={styles.handle}>{card.author.handle}</span> : null}
      <span className={styles.label} style={{ color }}>
        {card.label}
      </span>
      <span className={styles.spacer} />
      <CardMenu card={card} viewerId={viewerId} onHide={onHide} onMute={onMute} onMutePost={onMutePost} />
    </div>
  );
}

type Sheet = { firstAnswer: SeCardAnswerKind | null } | null;

function CardActions({ card, onAnswer, trailing }: { card: SeTodayCard; onAnswer: ((kind: SeCardAnswerKind) => void) | null; trailing?: ReactNode }) {
  if (card.actions.length === 0 && !trailing) return null;
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
      {trailing}
    </div>
  );
}

// Under the text: the Mood faces on the Mood card, then the buttons, with Save and Hide on a story
// or replay.
type FootProps = { card: SeTodayCard; onAnswer: ((kind: SeCardAnswerKind) => void) | null; onSave?: () => void; onHide: () => void };

function CardFoot({ card, onAnswer, onSave, onHide }: FootProps) {
  return (
    <>
      {seIsMoodCard(card) ? <MoodFaces /> : null}
      <CardActions card={card} onAnswer={onAnswer} trailing={onSave && seCanSave(card) ? <SaveHideIcons card={card} onSave={onSave} onHide={onHide} /> : undefined} />
    </>
  );
}

// The title and text, or a card's figures in their place (card-figures.tsx), then the line about
// new comments on a story marked done that came back.
function CardText({ card, open, color }: { card: SeTodayCard; open: boolean; color: string }) {
  const lead = card.figures?.length ? (
    <>
      <span className={styles.srOnly}>{card.title}</span>
      <CardFigures card={card} />
    </>
  ) : (
    <>
      <span className={styles.cardTitle}>{card.title}</span>
      {card.body ? <span className={bodyClass(card, open)}>{card.body}</span> : null}
    </>
  );
  return (
    <>
      {lead}
      {card.newComments ? <span className={styles.label} style={{ color }}>{seNewCommentsLine(card.newComments)}</span> : null}
    </>
  );
}

function PlainCard({
  card,
  viewerId,
  read,
  onToggleDone,
  onHide,
  onMute,
  onMutePost,
  onSave,
  onChanged,
}: TodayCardProps) {
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
      <CardHead card={card} viewerId={viewerId} color={color} onHide={onHide} onMute={onMute} onMutePost={onMutePost} />
      <button type="button" className={styles.textButton} aria-expanded={opensSheet ? undefined : open} aria-haspopup={opensSheet ? 'dialog' : undefined} onClick={toggle}>
        <CardText card={card} open={open} color={color} />
      </button>
      {isQuestionsCard(card) ? <QuestionsPanel card={card} open={open} onOpen={() => setOpen(true)} onChanged={onChanged ?? (() => undefined)} /> : null}
      <CardFoot card={card} onAnswer={opensSheet ? (kind) => setSheet({ firstAnswer: kind }) : null} onSave={onSave} onHide={onHide} />
      {sheet ? (
        <CardSheet card={card} viewerId={viewerId} firstAnswer={sheet.firstAnswer} onClose={() => setSheet(null)} onChanged={onChanged} onMutePost={onMutePost} />
      ) : null}
    </article>
  );
}

type TodayCardProps = {
  card: SeTodayCard;
  // The signed-in member, so the card offers Report only on somebody else's card.
  viewerId: string;
  read: boolean;
  onToggleDone: () => void;
  onHide: () => void;
  onMute?: () => void;
  // Mute this post: the card leaves Today and its conversation sends no notices.
  onMutePost?: () => void;
  // Save for later on a story or replay; absent where there is no account to save to.
  onSave?: () => void;
  // A card that changes something (a 21 Questions answer) asks Today to read again.
  onChanged?: () => void;
};

// The member's own goal draws as the "Your goal" card (goal-card.tsx); every other card as above.
export function TodayCard(props: TodayCardProps) {
  const { card } = props;
  if (!card.goal) return <PlainCard {...props} />;
  const dot = <DoneDot card={card} done={props.read} color={`var(--se-kind-${card.kind})`} onToggleDone={props.onToggleDone} />;
  return <GoalCard card={{ ...card, goal: card.goal }} viewerId={props.viewerId} dot={dot} onChanged={props.onChanged} />;
}
