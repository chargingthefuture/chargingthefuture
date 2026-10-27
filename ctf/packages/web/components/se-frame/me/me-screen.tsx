'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  SE_AVEN_DEFINITION,
  SE_AVENHOOD,
  SE_AVENHOOD_DEFINITION,
  SE_ME_LINKS,
  SE_ME_TILES,
  SE_ME_WORDS as W,
} from '@ctf/shared';
import type { ShellCurrentUser } from '../../community-shell/shell-types';
import { SeAvatar } from '../../shared/se-avatar';
import { ThemePicker } from './theme-picker';
import { useCredits } from './use-credits';
import type { SeThemeChoice } from '@ctf/shared';
import styles from './me.module.css';

// Me holds only what is the member's own: the profile, ServiceCredits, the private tools, About,
// Settings and, for the owner, the System Architect entry. Making things is + New; reading is Today.

// Receive copies the member's handle, which is what somebody types to send to them.
function ReceiveButton({ handle }: { handle: string | null }) {
  const [note, setNote] = useState<string | null>(null);
  const copy = () => {
    if (!handle) return setNote(W.receiveNoHandle);
    void navigator.clipboard
      .writeText(handle)
      .then(() => setNote(W.receiveCopied(handle)))
      .catch(() => setNote(handle));
  };
  return (
    <>
      <button type="button" className={styles.pillButton} onClick={copy}>
        {W.receive}
      </button>
      {note ? (
        <p role="status" className={styles.text}>
          {note}
        </p>
      ) : null}
    </>
  );
}

function CreditsCard({ handle }: { handle: string | null }) {
  const credits = useCredits();
  return (
    <section className={styles.card} aria-labelledby="se-me-credits">
      <p id="se-me-credits" className={styles.label}>
        {W.credits}
      </p>
      {credits.kind === 'ready' ? <p className={styles.big}>{W.creditsUnit(credits.available)}</p> : null}
      {credits.kind === 'error' ? <p className={styles.text}>{W.creditsFailed}</p> : null}
      <div className={styles.row}>
        <Link href={`${SE_ME_LINKS.credits}?tab=send`} className={styles.pill}>
          {W.send}
        </Link>
        <Link href={`${SE_ME_LINKS.credits}?tab=wallet`} className={styles.pill}>
          {W.history}
        </Link>
        <ReceiveButton handle={handle} />
      </div>
    </section>
  );
}

function Tiles() {
  return (
    <div className={styles.tiles}>
      {SE_ME_TILES.map((tile) => (
        <Link key={tile.key} href={tile.href} className={styles.tile}>
          <span className={styles.tileTitle}>{tile.label}</span>
          <span className={styles.text}>{tile.text}</span>
        </Link>
      ))}
    </div>
  );
}

function AboutCard() {
  return (
    <section className={styles.card}>
      <p className={styles.label}>About</p>
      <p className={styles.title}>The {SE_AVENHOOD}</p>
      <p className={styles.text}>{SE_AVENHOOD_DEFINITION}</p>
      <p className={styles.text}>{SE_AVEN_DEFINITION}</p>
    </section>
  );
}

type SettingsProps = { theme: SeThemeChoice; onTheme: (_next: SeThemeChoice) => void; onBack: () => void; saving: boolean };

function SettingsCard({ theme, onTheme, onBack, saving }: SettingsProps) {
  return (
    <section className={styles.card} aria-labelledby="se-me-settings">
      <p id="se-me-settings" className={styles.label}>
        Settings
      </p>
      <ThemePicker theme={theme} onChange={onTheme} />
      <p className={styles.text}>{W.version}</p>
      <button type="button" className={styles.pillButton} onClick={onBack} disabled={saving}>
        {W.backTo30}
      </button>
      <nav className={styles.links} aria-label="Settings links">
        <Link href={SE_ME_LINKS.account}>{W.account}</Link>
        <Link href={SE_ME_LINKS.survey}>{W.survey}</Link>
        <a href={SE_ME_LINKS.wallpapers} target="_blank" rel="noreferrer">
          {W.wallpapers}
        </a>
        <a href={SE_ME_LINKS.androidApp} target="_blank" rel="noreferrer">
          {W.androidApp}
        </a>
      </nav>
    </section>
  );
}

type MeScreenProps = SettingsProps & { currentUser: ShellCurrentUser; isAdmin: boolean };

export function MeScreen({ currentUser, isAdmin, ...settings }: MeScreenProps) {
  return (
    <>
      <section className={styles.card}>
        <div className={styles.profile}>
          <SeAvatar accountId={currentUser.userId} size={56} />
          <span className={styles.handle}>{currentUser.displayName}</span>
        </div>
      </section>
      <CreditsCard handle={currentUser.username ? `@${currentUser.username}` : null} />
      <Tiles />
      <AboutCard />
      <SettingsCard {...settings} />
      {isAdmin ? (
        <Link href={SE_ME_LINKS.architect} className={styles.tile}>
          <span className={styles.tileTitle}>{W.architect}</span>
          <span className={styles.text}>{W.architectText}</span>
        </Link>
      ) : null}
    </>
  );
}
