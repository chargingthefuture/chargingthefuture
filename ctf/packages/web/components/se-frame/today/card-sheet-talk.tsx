'use client';

import { useState } from 'react';
import { SE_CARD_MESSAGE_MAX, SE_CARD_WORDS, seAgo, type SeCardMessage, type SeCardPairThread } from '@ctf/shared';
import type { CardConversation } from './use-card-conversation';
import styles from './card-sheet.module.css';

// The conversation half of a card's sheet: the Public / Just us two switch, the messages, the
// requests to talk just you two, and the composer. Text only for now.

type TalkProps = {
  talk: CardConversation;
  // Null shows the public conversation; an account id (or '' before any pair exists) shows Just us two.
  partner: string | null;
  onPartner: (partnerId: string | null) => void;
  onTalk: (accountId: string) => void;
};

function Bubble({ message, talk, onTalk, publicThread }: { message: SeCardMessage; talk: CardConversation; onTalk: (id: string) => void; publicThread: boolean }) {
  const [reported, setReported] = useState(false);
  const report = async () => setReported(await talk.report({ messageId: message.id }));
  return (
    <div className={message.mine ? `${styles.bubbleRow} ${styles.bubbleRowMine}` : styles.bubbleRow}>
      <p className={message.mine ? `${styles.bubble} ${styles.bubbleMine}` : styles.bubble}>{message.body}</p>
      <span className={styles.bubbleMeta}>
        {message.mine ? SE_CARD_WORDS.you : message.handle} · {seAgo(message.createdAtIso)}
        {!message.mine && publicThread && !talk.locked ? (
          <button type="button" className={styles.linkButton} onClick={() => onTalk(message.authorId)}>
            {SE_CARD_WORDS.askPair}
          </button>
        ) : null}
        {!message.mine && !talk.locked ? (
          <button type="button" className={styles.linkButton} disabled={reported} onClick={() => void report()}>
            {reported ? SE_CARD_WORDS.reported : SE_CARD_WORDS.reportMessage}
          </button>
        ) : null}
      </span>
    </div>
  );
}

function PairPills({ talk, pairs }: { talk: CardConversation; pairs: SeCardPairThread[] }) {
  const pending = pairs.filter((pair) => pair.state !== 'open');
  return (
    <>
      {pending.map((pair) =>
        pair.state === 'asked-me' ? (
          <span key={pair.partnerId} className={styles.pill}>
            {SE_CARD_WORDS.askedMe(pair.partnerHandle)} ·{' '}
            <button type="button" className={styles.pillButton} disabled={talk.busy || talk.locked} onClick={() => void talk.agree(pair.partnerId)}>
              {SE_CARD_WORDS.agree}
            </button>
          </span>
        ) : (
          <span key={pair.partnerId} className={styles.pill}>
            {SE_CARD_WORDS.waiting(pair.partnerHandle)}
          </span>
        ),
      )}
    </>
  );
}

function Switch({ partner, pairs, onPartner }: { partner: string | null; pairs: SeCardPairThread[]; onPartner: TalkProps['onPartner'] }) {
  return (
    <div className={styles.talkHead}>
      <span className={styles.talkTitle}>{SE_CARD_WORDS.conversation}</span>
      <div role="group" aria-label={SE_CARD_WORDS.whoReads} className={styles.switch}>
        <button type="button" aria-pressed={partner === null} className={partner === null ? styles.switchOn : styles.switchOff} onClick={() => onPartner(null)}>
          {SE_CARD_WORDS.public}
        </button>
        <button
          type="button"
          aria-pressed={partner !== null}
          className={partner !== null ? styles.switchOn : styles.switchOff}
          onClick={() => onPartner(partner ?? pairs[0]?.partnerId ?? '')}
        >
          {SE_CARD_WORDS.pair}
        </button>
      </div>
    </div>
  );
}

function PartnerChips({ partner, pairs, onPartner }: { partner: string; pairs: SeCardPairThread[]; onPartner: TalkProps['onPartner'] }) {
  if (pairs.length < 2) return null;
  return (
    <div className={styles.chips} role="group" aria-label={SE_CARD_WORDS.pair}>
      {pairs.map((pair) => (
        <button key={pair.partnerId} type="button" aria-pressed={pair.partnerId === partner} className={pair.partnerId === partner ? styles.switchOn : styles.switchOff} onClick={() => onPartner(pair.partnerId)}>
          {pair.partnerHandle}
        </button>
      ))}
    </div>
  );
}

function Composer({ talk, partnerId, hint }: { talk: CardConversation; partnerId: string | null; hint: string }) {
  const [draft, setDraft] = useState('');
  if (talk.locked) return <p className={styles.hint}>{SE_CARD_WORDS.unlockLine}</p>;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.trim() && (await talk.write(draft.trim(), partnerId))) setDraft('');
  };
  return (
    <>
      <form className={styles.composer} onSubmit={(event) => void submit(event)}>
        <label className={styles.field}>
          <span className={styles.srOnly}>Message</span>
          <input className={styles.input} value={draft} maxLength={SE_CARD_MESSAGE_MAX} placeholder={SE_CARD_WORDS.composer} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <button type="submit" aria-label={SE_CARD_WORDS.send} className={styles.send} disabled={talk.busy || !draft.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
      <p className={styles.hint}>{hint}</p>
    </>
  );
}

function Messages({ messages, empty, talk, onTalk, publicThread }: { messages: SeCardMessage[]; empty: string; talk: CardConversation; onTalk: (id: string) => void; publicThread: boolean }) {
  if (messages.length === 0) return <p className={styles.quiet}>{empty}</p>;
  return (
    <>
      {messages.map((message) => (
        <Bubble key={message.id} message={message} talk={talk} onTalk={onTalk} publicThread={publicThread} />
      ))}
    </>
  );
}

function PairView({ talk, thread }: { talk: CardConversation; thread: SeCardPairThread | undefined }) {
  if (!thread) return <p className={styles.quiet}>{SE_CARD_WORDS.pairNone}</p>;
  if (thread.state !== 'open') return <PairPills talk={talk} pairs={[thread]} />;
  return <Messages messages={thread.messages} empty={SE_CARD_WORDS.noPairMessages} talk={talk} onTalk={() => undefined} publicThread={false} />;
}

type ThreadProps = { talk: CardConversation; partner: string | null; pairs: SeCardPairThread[]; thread: SeCardPairThread | undefined; onTalk: (id: string) => void };

function Thread({ talk, partner, pairs, thread, onTalk }: ThreadProps) {
  const conversation = talk.conversation;
  if (!conversation) return talk.note || talk.locked ? null : <p className={styles.quiet}>{SE_CARD_WORDS.loading}</p>;
  if (partner !== null) return <PairView talk={talk} thread={thread} />;
  return (
    <>
      <Messages messages={conversation.messages} empty={SE_CARD_WORDS.noMessages} talk={talk} onTalk={onTalk} publicThread />
      <PairPills talk={talk} pairs={pairs} />
    </>
  );
}

function Foot({ talk, partner, thread }: { talk: CardConversation; partner: string | null; thread: SeCardPairThread | undefined }) {
  const openThread = thread?.state === 'open' ? thread : null;
  if (partner !== null && !openThread && !talk.locked) return null;
  const hint = openThread ? SE_CARD_WORDS.pairHint(openThread.partnerHandle) : SE_CARD_WORDS.publicHint;
  return <Composer talk={talk} partnerId={openThread?.partnerId ?? null} hint={hint} />;
}

export function CardTalk({ talk, partner, onPartner, onTalk }: TalkProps) {
  const pairs = talk.conversation?.pairs ?? [];
  const thread = pairs.find((pair) => pair.partnerId === partner);
  return (
    <div className={styles.talk}>
      <Switch partner={partner} pairs={pairs} onPartner={onPartner} />
      {partner !== null ? <PartnerChips partner={partner} pairs={pairs} onPartner={onPartner} /> : null}
      <div className={styles.messages}>
        <Thread talk={talk} partner={partner} pairs={pairs} thread={thread} onTalk={onTalk} />
        {talk.note ? (
          <p role="alert" className={styles.quiet}>
            {talk.note}
          </p>
        ) : null}
      </div>
      <Foot talk={talk} partner={partner} thread={thread} />
    </div>
  );
}
