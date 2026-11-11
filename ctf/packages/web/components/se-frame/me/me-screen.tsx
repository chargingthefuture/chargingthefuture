'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  SE_AVEN_DEFINITION,
  SE_ME_BADGE_LABELS,
  SE_ME_CREDIT_ICONS,
  SE_ME_GEAR_ICON,
  SE_ME_LINKS,
  SE_ME_PROMPT_KEYS,
  SE_ME_PROMPT_LABELS,
  SE_ME_TOOL_INK,
  SE_ME_TOOLS,
  SE_ME_WORDS as W,
  SE_SETTINGS_WORDS,
  seMeName,
  seMeSince,
  type SeMeView,
  type SeReadingPrefs,
} from '@ctf/shared';
import type { ShellCurrentUser } from '../../community-shell/shell-types';
import { SeAvatar } from '../../shared/se-avatar';
import { SavedCard } from './saved-card';
import { useCredits } from './use-credits';
import type { MeProfileState } from './use-me-profile';
import styles from './me.module.css';

// Me, built to the approved board "Me": the member's name, since when they have been an Aven,
// their badges and the gear to Settings; their three profile lines; ServiceCredits; Saved, Read and
// Hidden; the Tools grid; and emoji rain. Making things is + New; reading is Today.

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Since({ sinceIso }: { sinceIso: string | null }) {
  const [open, setOpen] = useState(false);
  const since = seMeSince(sinceIso);
  if (!since) return null;
  return (
    <>
      <p className={styles.since}>
        <button type="button" className={styles.term} aria-expanded={open} aria-controls="se-me-aven" onClick={() => setOpen((value) => !value)}>
          {W.aven}
        </button>{' '}
        {W.since} {since}
      </p>
      {open ? (
        <p id="se-me-aven" className={styles.since}>
          {SE_AVEN_DEFINITION}
        </p>
      ) : null}
    </>
  );
}

function Head({ user, profile, onSettings }: { user: ShellCurrentUser; profile: MeProfileState; onSettings: () => void }) {
  const ready = profile.kind === 'ready' ? profile.profile : null;
  return (
    <div className={styles.head}>
      <span className={styles.avatar}>
        <SeAvatar accountId={user.userId} size={64} />
      </span>
      <div className={styles.who}>
        <h1 className={styles.name}>{seMeName(user.username)}</h1>
        {ready ? <Since sinceIso={ready.sinceIso} /> : null}
        {ready && ready.badges.length > 0 ? (
          <div className={styles.badges}>
            {ready.badges.map((badge) =>
              // The System Architect badge is also the way into the admin screens.
              badge === 'architect' ? (
                <Link key={badge} href={SE_ME_LINKS.architect} className={styles.badge}>
                  {SE_ME_BADGE_LABELS[badge]}
                </Link>
              ) : (
                <span key={badge} className={`${styles.badge} ${styles.badgeWeaver}`}>
                  {SE_ME_BADGE_LABELS[badge]}
                </span>
              ),
            )}
          </div>
        ) : null}
      </div>
      <button type="button" className={styles.gear} aria-label={W.settings} onClick={onSettings}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d={SE_ME_GEAR_ICON} />
          <circle cx="16" cy="7" r="2" />
          <circle cx="8" cy="17" r="2" />
        </svg>
      </button>
    </div>
  );
}

// The three profile lines. Only the ones written are shown; with none, a line to add them.
function Prompts({ profile, onEdit }: { profile: MeProfileState; onEdit: () => void }) {
  if (profile.kind === 'loading') return null;
  if (profile.kind === 'error') {
    return (
      <p role="alert" className={styles.status}>
        {profile.message}
      </p>
    );
  }
  const written = SE_ME_PROMPT_KEYS.filter((key) => profile.profile.prompts[key]);
  return (
    <div className={styles.card}>
      {written.map((key) => (
        <div key={key} className={styles.prompt}>
          <span className={styles.q}>{SE_ME_PROMPT_LABELS[key]}</span>
          <span className={styles.a}>{profile.profile.prompts[key]}</span>
        </div>
      ))}
      <button type="button" className={styles.textButton} onClick={onEdit}>
        {written.length > 0 ? W.promptsEdit : W.promptsAdd}
      </button>
    </div>
  );
}

// Receive copies the member's handle, which is what somebody types to send to them.
function useReceive(handle: string | null) {
  const [note, setNote] = useState<string | null>(null);
  const copy = () => {
    if (!handle) return setNote(W.receiveNoHandle);
    void navigator.clipboard
      .writeText(handle)
      .then(() => setNote(W.receiveCopied(handle)))
      .catch((error: unknown) => setNote(W.receiveCopyFailed(handle, error instanceof Error ? error.message : 'the browser refused')));
  };
  return { note, copy };
}

function CreditsCard({ handle }: { handle: string | null }) {
  const credits = useCredits();
  const receive = useReceive(handle);
  return (
    <>
      <section className={styles.credits} aria-label={W.credits}>
        <div className={styles.creditsText}>
          <span className={styles.label}>{W.credits}</span>
          <span className={styles.balance}>{credits.kind === 'ready' ? credits.available.toLocaleString('en-US') : '–'}</span>
          <span className={styles.note}>{W.creditsNote}</span>
        </div>
        <Link href={`${SE_ME_LINKS.credits}?tab=send`} className={styles.creditAction}>
          <span className={styles.creditIcon}>
            <Icon d={SE_ME_CREDIT_ICONS.send} size={17} />
          </span>
          {W.send}
        </Link>
        <button type="button" className={styles.creditAction} onClick={receive.copy}>
          <span className={styles.creditIcon}>
            <Icon d={SE_ME_CREDIT_ICONS.receive} size={17} />
          </span>
          {W.receive}
        </button>
        <Link href={`${SE_ME_LINKS.credits}?tab=wallet`} className={styles.creditAction}>
          <span className={styles.creditIcon}>
            <Icon d={SE_ME_CREDIT_ICONS.history} size={17} />
          </span>
          {W.history}
        </Link>
      </section>
      {credits.kind === 'error' ? (
        <p role="alert" className={styles.status}>
          {W.creditsFailed} {credits.message}
        </p>
      ) : null}
      {receive.note ? (
        <p role="status" className={styles.status}>
          {receive.note}
        </p>
      ) : null}
    </>
  );
}

function Tools() {
  return (
    <>
      <h2 className={styles.h2}>{W.tools}</h2>
      <div className={styles.tools}>
        {SE_ME_TOOLS.map((tool) => (
          <Link key={tool.key} href={tool.href} className={styles.tool}>
            <span className={styles.toolIcon} style={{ background: tool.tint, color: SE_ME_TOOL_INK }}>
              <Icon d={tool.icon} />
            </span>
            <span className={styles.toolLabel}>{tool.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export type MeScreenProps = {
  currentUser: ShellCurrentUser;
  profile: MeProfileState;
  reading: SeReadingPrefs;
  onReading: (_change: Partial<SeReadingPrefs>) => void;
  onOpen: (_view: SeMeView) => void;
  // Me → Saved is built separately; it goes first in the row, before Read and Hidden.
  saved?: ReactNode;
};

export function MeScreen({ currentUser, profile, reading, onReading, onOpen, saved }: MeScreenProps) {
  return (
    <div className={styles.stack}>
      <Head user={currentUser} profile={profile} onSettings={() => onOpen('settings')} />
      <Prompts profile={profile} onEdit={() => onOpen('prompts')} />
      <CreditsCard handle={currentUser.username ? `@${currentUser.username}` : null} />
      <div className={styles.shortcuts}>
        {saved ?? null}
        <button type="button" className={styles.shortcut} onClick={() => onOpen('read')}>
          {W.read}
        </button>
        <button type="button" className={styles.shortcut} onClick={() => onOpen('hidden')}>
          {W.hidden}
        </button>
      </div>
      <SavedCard />
      <Tools />
      <label className={styles.switchRow}>
        <span>{SE_SETTINGS_WORDS.emojiRain}</span>
        <input type="checkbox" role="switch" className={styles.switch} checked={reading.emojiRain} onChange={(event) => onReading({ emojiRain: event.target.checked })} />
      </label>
    </div>
  );
}
