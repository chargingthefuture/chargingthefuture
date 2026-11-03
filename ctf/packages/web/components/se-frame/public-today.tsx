'use client';

import { SE_SIGNED_OUT_THEME, SE_GUEST_WORDS as W } from '@ctf/shared';
import { GuestToday } from './today/guest-today';
import { seThemeVars } from './se-theme-vars';
import styles from './se-frame.module.css';

// Today for a visitor who is not signed in, to the approved "Today, signed out" board: the Skills
// Economy name with Sign in, the guest Today, and a bar along the bottom with Sign up.
export function PublicToday({ signInUrl, signUpUrl }: { signInUrl: string; signUpUrl: string }) {
  const theme = SE_SIGNED_OUT_THEME;
  return (
    <div className={styles.frame} style={seThemeVars(theme.color, theme.mode)}>
      <main className={styles.screen}>
        <header className={styles.guestHeader}>
          <span className={styles.wordmark}>{W.brand}</span>
          <a href={signInUrl} className={styles.guestSignIn}>
            {W.signIn}
          </a>
        </header>
        <GuestToday signUpUrl={signUpUrl} />
      </main>
      <nav aria-label="Main" className={styles.guestBar}>
        <span className={styles.guestBarText}>{W.bar}</span>
        <a href={signUpUrl} className={styles.guestBarButton}>
          {W.signUp}
        </a>
      </nav>
    </div>
  );
}
