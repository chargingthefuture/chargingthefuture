'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  SE_ARCHITECT_WORDS,
  SE_NEW_KINDS,
  SE_NEW_SHEET_WORDS as W,
  SE_OFFER_CHOICES,
  SE_OFFER_WORDS,
  SE_ROOM_RULE,
  SE_STORY_WORDS,
  SE_TALK_WORDS,
  type SeNewKind,
} from '@ctf/shared';
import { AskForm } from './ask-form';
import { ArchitectSection } from './architect-section';
import { TalkForm } from './talk-form';
import styles from './new.module.css';
import sheet from './sheet.module.css';

// + New, to the approved boards "New post", "Schedule a talk" and "Schedule a talk, not yet
// verified": a sheet with Close, an Ask / Offer / Story / Talk switch, and the chosen kind under it.
// Ask is posted here; Talk books a TI Radio slot; an Offer or a Story opens where it is made. Ask the
// architect opens from the line under the switch, since the board's switch has four choices.

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// Close on the left; on the right, the community guidelines, or the room rule while booking a talk.
function SheetTop({ talk, onClose }: { talk: boolean; onClose: () => void }) {
  const [rule, setRule] = useState(false);
  return (
    <>
      <div className={sheet.top}>
        <button type="button" className={sheet.close} aria-label={W.close} onClick={onClose}>
          <CloseIcon />
        </button>
        {talk ? (
          <button type="button" className={sheet.topLink} aria-expanded={rule} aria-controls="se-new-room-rule" onClick={() => setRule((value) => !value)}>
            {SE_TALK_WORDS.roomRule}
          </button>
        ) : (
          <Link href={W.guidelinesHref} className={sheet.topLink}>
            {W.guidelines}
          </Link>
        )}
      </div>
      {talk && rule ? (
        <p id="se-new-room-rule" className={sheet.rule}>
          {SE_ROOM_RULE}
        </p>
      ) : null}
    </>
  );
}

function KindSwitch({ kind, onKind }: { kind: SeNewKind; onKind: (_kind: SeNewKind) => void }) {
  return (
    <div role="group" aria-label={W.kinds} className={sheet.kinds}>
      {SE_NEW_KINDS.map((item) => (
        <button key={item.key} type="button" aria-pressed={kind === item.key} className={sheet.kind} onClick={() => onKind(item.key)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function OfferBody() {
  return (
    <>
      <p className={styles.text}>{SE_OFFER_WORDS.intro}</p>
      <div className={styles.choices}>
        {SE_OFFER_CHOICES.map((choice) => (
          <Link key={choice.key} href={choice.href} className={styles.choice}>
            <span className={styles.choiceTitle}>{choice.label}</span>
            <span className={styles.text}>{choice.text}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function StoryBody() {
  return (
    <>
      <p className={styles.text}>{SE_STORY_WORDS.intro}</p>
      <Link href={SE_STORY_WORDS.href} className={styles.choice}>
        <span className={styles.choiceTitle}>{SE_STORY_WORDS.open}</span>
      </Link>
    </>
  );
}

function ArchitectBody() {
  return (
    <>
      <div className={sheet.headLeft}>
        <h1 className={sheet.titleSmall}>{SE_ARCHITECT_WORDS.title}</h1>
        <p className={sheet.sub}>{SE_ARCHITECT_WORDS.intro}</p>
      </div>
      <ArchitectSection />
    </>
  );
}

const BODIES: Record<SeNewKind, () => React.ReactElement> = {
  ask: AskForm,
  offer: OfferBody,
  story: StoryBody,
  talk: TalkForm,
  architect: ArchitectBody,
};

export function NewScreen({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<SeNewKind>('ask');
  const Body = BODIES[kind];
  // Ask, Offer and Story share "Post something" above the switch; Talk and the architect carry
  // their own heading under it.
  const posting = kind === 'ask' || kind === 'offer' || kind === 'story';
  return (
    <section aria-label={W.label} className={sheet.sheet}>
      <SheetTop talk={kind === 'talk'} onClose={onClose} />
      {posting ? (
        <div className={sheet.head}>
          <h1 className={sheet.title}>{W.heading}</h1>
          <p className={sheet.sub}>{W.intro}</p>
        </div>
      ) : null}
      <KindSwitch kind={kind} onKind={setKind} />
      {kind === 'architect' ? null : (
        <button type="button" className={sheet.architect} onClick={() => setKind('architect')}>
          {W.architect}
        </button>
      )}
      <Body />
    </section>
  );
}
