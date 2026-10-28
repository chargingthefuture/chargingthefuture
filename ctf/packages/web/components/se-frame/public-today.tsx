'use client';

import { SE_AVENHOOD } from '@ctf/shared';
import { TodayScreen } from './today/today-screen';
import { useSeTheme } from './use-se-theme';
import { seThemeVars } from './se-theme-vars';
import styles from './se-frame.module.css';

// The 3.1 frame's look, with Today alone and a sign-in button where the tabs would be.
export function PublicToday({ signInUrl }: { signInUrl: string }) {
  const { theme } = useSeTheme();
  return (
    <div className={styles.frame} style={seThemeVars(theme.color, theme.mode)}>
      <main className={styles.screen}>
        <header className={styles.header}>
          <h1 className={styles.title}>Today in the {SE_AVENHOOD}</h1>
          <p className={styles.eyebrow}>What is happening now. Sign in to post, answer and take part.</p>
        </header>
        <a href={signInUrl} className={styles.signInButton}>
          Sign in
        </a>
        <TodayScreen accountId={null} />
      </main>
    </div>
  );
}
